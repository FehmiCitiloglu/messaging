import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { config } from "./config.js";
import {
  conversationParticipantIds,
  findMessageById,
  findUserById,
  isParticipant,
  sql,
  touchLastSeen,
} from "./db.js";
import type { MessageRow } from "./db.js";
import { ApiError, ErrorCode, errors } from "./lib/errors.js";
import { isIdLike, newId, UUID_RE } from "./lib/ids.js";
import { verifyAccessToken } from "./lib/jwt.js";
import { RateLimiter } from "./lib/rateLimit.js";
import { formatZodIssues } from "./lib/http.js";
import {
  presenceOf,
  socketConnected,
  socketDisconnected,
} from "./presence.js";
import { toMessage } from "./serializers.js";

const sendMessageSchema = z.strictObject({
  conversationId: z.string().refine(isIdLike),
  clientId: z.string().regex(UUID_RE),
  content: z
    .string()
    .min(1)
    .max(config.maxMessageLength)
    .refine((s) => s.trim().length > 0, "message content cannot be blank"),
  type: z.literal("text"),
});

const readReceiptSchema = z.strictObject({
  conversationId: z.string().refine(isIdLike),
  messageId: z.string().refine(isIdLike),
});

const typingSchema = z.strictObject({
  conversationId: z.string().refine(isIdLike),
});

const joinSchema = z.strictObject({
  conversationId: z.string().refine(isIdLike),
});

type Ack = (response: unknown) => void;

function ackOk(ack: Ack | undefined, message: unknown): void {
  if (ack) ack({ ok: true, message });
}

function ackErr(ack: Ack | undefined, err: ApiError): void {
  if (ack) ack({ ok: false, error: { code: err.code, message: err.message } });
}

export function setupSocket(io: Server): void {
  const messageLimiter = new RateLimiter(
    config.messageRateLimitWindowMs,
    config.messageRateLimitCount,
  );
  const readLimiter = new RateLimiter(60_000, 60);
  const typingLimiter = new RateLimiter(
    60_000,
    config.typingRateLimitPerMin,
  );
  const lastTypingEmit = new Map<string, number>();

  // ---- Handshake authentication (JWT) -------------------------------------
  io.use((socket, next) => {
    const raw = socket.handshake.auth["token"];
    if (typeof raw !== "string" || raw.length === 0) {
      next(new Error(ErrorCode.UNAUTHORIZED));
      return;
    }
    try {
      socket.data["userId"] = verifyAccessToken(raw);
      next();
    } catch {
      next(new Error(ErrorCode.UNAUTHORIZED));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data["userId"] as string;
    socket.join(`user:${userId}`);

    // Auto-subscribe to all current conversation rooms (server-enforced).
    const convIds = sql(
      `SELECT conversation_id FROM participants WHERE user_id = ? LIMIT 500`,
    ).all(userId) as Array<{ conversation_id: string }>;
    for (const row of convIds) socket.join(`conv:${row.conversation_id}`);

    const becameOnline = socketConnected(userId, socket.id);
    if (becameOnline) {
      broadcastPresence(io, userId);
    }

    // Presence heartbeat: refresh last-seen on engine ping packets (throttled).
    let lastTouch = 0;
    socket.conn.on("packet", (packet: { type?: string }) => {
      if (packet.type === "ping") {
        const now = Date.now();
        if (now - lastTouch > 30_000) {
          lastTouch = now;
          touchLastSeen(userId, new Date(now).toISOString());
        }
      }
    });

    socket.on("disconnect", () => {
      const becameOffline = socketDisconnected(userId, socket.id);
      if (becameOffline) {
        const now = new Date().toISOString();
        touchLastSeen(userId, now);
        emitToRelevantRooms(io, userId, "presence:update", {
          userId,
          presence: "offline",
          lastSeenAt: now,
        });
      }
    });

    // ---- message:send (persist THEN broadcast; ack) -----------------------
    socket.on(
      "message:send",
      (rawPayload: unknown, ack?: Ack): void => {
        try {
          const parsed = sendMessageSchema.safeParse(rawPayload);
          if (!parsed.success) {
            ackErr(ack, errors.validation(formatZodIssues(parsed.error)));
            return;
          }
          const payload = parsed.data;
          const verdict = messageLimiter.hit(userId);
          if (!verdict.allowed) {
            ackErr(
              ack,
              errors.rateLimited(
                `Message flood protection: max ${config.messageRateLimitCount} messages per ${config.messageRateLimitWindowMs}ms`,
              ),
            );
            return;
          }
          // Membership re-verified on EVERY send — never trust the client.
          if (!isParticipant(payload.conversationId, userId)) {
            ackErr(
              ack,
              errors.forbidden(
                "You are not a participant of this conversation",
              ),
            );
            return;
          }

          const trimmed = payload.content.trim();
          if (trimmed.length === 0) {
            ackErr(ack, errors.validation("Message content cannot be blank"));
            return;
          }
          const content =
            payload.content.length > config.maxMessageLength
              ? payload.content.slice(0, config.maxMessageLength)
              : payload.content;

          const id = newId();
          const createdAt = new Date().toISOString();
          sql(
            `INSERT INTO messages (id, conversation_id, sender_id, client_id, content, type, edited_at, created_at)
             VALUES (?, ?, ?, ?, ?, 'text', NULL, ?)`,
          ).run(id, payload.conversationId, userId, payload.clientId, content, createdAt);

          const row: MessageRow = {
            id,
            conversation_id: payload.conversationId,
            sender_id: userId,
            client_id: payload.clientId,
            content,
            type: "text",
            created_at: createdAt,
            edited_at: null,
          };
          const message = toMessage(row);

          // Sender joins the room defensively (e.g. brand-new conversation).
          socket.join(`conv:${payload.conversationId}`);

          // Mark delivery for peers whose sockets are in the room right now.
          const room = io.sockets.adapter.rooms.get(
            `conv:${payload.conversationId}`,
          );
          if (room) {
            const insertDelivery = sql(
              `INSERT OR IGNORE INTO message_deliveries (message_id, user_id, delivered_at)
               VALUES (?, ?, ?)`,
            );
            for (const sid of room) {
              const peer = io.sockets.sockets.get(sid);
              const peerId = peer?.data["userId"] as string | undefined;
              if (peerId && peerId !== userId) {
                insertDelivery.run(id, peerId, createdAt);
              }
            }
          }

          io.to(`conv:${payload.conversationId}`).emit("message:new", {
            message,
          });
          ackOk(ack, message);
        } catch (err) {
          ackErr(ack, toApiError(err));
        }
      },
    );

    // ---- message:read ------------------------------------------------------
    socket.on("message:read", (rawPayload: unknown, ack?: Ack): void => {
      try {
        const parsed = readReceiptSchema.safeParse(rawPayload);
        if (!parsed.success) {
          ackErr(ack, errors.validation(formatZodIssues(parsed.error)));
          return;
        }
        const payload = parsed.data;
        if (!readLimiter.hit(userId).allowed) {
          ackErr(ack, errors.rateLimited("Too many read receipts"));
          return;
        }
        if (!isParticipant(payload.conversationId, userId)) {
          ackErr(
            ack,
            errors.forbidden("You are not a participant of this conversation"),
          );
          return;
        }
        const message = findMessageById(payload.messageId);
        if (!message || message.conversation_id !== payload.conversationId) {
          ackErr(ack, errors.notFound("Message not found"));
          return;
        }

        const readAt = new Date().toISOString();
        sql(
          `UPDATE participants
           SET last_read_message_id = ?, last_read_at = ?
           WHERE conversation_id = ? AND user_id = ?
             AND (last_read_message_id IS NULL OR last_read_message_id < ?)`,
        ).run(payload.messageId, readAt, payload.conversationId, userId, payload.messageId);

        io.to(`conv:${payload.conversationId}`).emit("message:read", {
          conversationId: payload.conversationId,
          readerId: userId,
          messageId: payload.messageId,
          readAt,
        });
        ackOk(ack, { readAt });
      } catch (err) {
        ackErr(ack, toApiError(err));
      }
    });

    // ---- typing:start / typing:stop ---------------------------------------
    const handleTyping = (typing: boolean) => (rawPayload: unknown): void => {
      const parsed = typingSchema.safeParse(rawPayload);
      if (!parsed.success) return;
      const payload = parsed.data;
      const key = `${userId}|${payload.conversationId}`;
      const now = Date.now();
      const last = lastTypingEmit.get(key) ?? 0;
      if (now - last < config.typingMinIntervalMs) return; // heavy throttle
      if (!typingLimiter.hit(key).allowed) return;
      lastTypingEmit.set(key, now);
      if (!isParticipant(payload.conversationId, userId)) return; // enforced
      socket
        .to(`conv:${payload.conversationId}`)
        .emit("typing:update", {
          conversationId: payload.conversationId,
          userId,
          typing,
        });
    };
    socket.on("typing:start", handleTyping(true));
    socket.on("typing:stop", handleTyping(false));

    // ---- conversation:join (optional convenience; membership enforced) -----
    socket.on("conversation:join", (rawPayload: unknown, ack?: Ack): void => {
      try {
        const parsed = joinSchema.safeParse(rawPayload);
        if (!parsed.success) {
          ackErr(ack, errors.validation(formatZodIssues(parsed.error)));
          return;
        }
        const { conversationId } = parsed.data;
        if (!isParticipant(conversationId, userId)) {
          ackErr(
            ack,
            errors.forbidden("You are not a participant of this conversation"),
          );
          return;
        }
        socket.join(`conv:${conversationId}`);
        ackOk(ack, { conversationId });
      } catch (err) {
        ackErr(ack, toApiError(err));
      }
    });
  });
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return errors.internal();
}

/** Presence updates go to everyone sharing a conversation with this user. */
function broadcastPresence(
  io: Server,
  userId: string,
): void {
  const user = findUserById(userId);
  emitToRelevantRooms(io, userId, "presence:update", {
    userId,
    presence: presenceOf(userId),
    lastSeenAt: user?.last_seen_at ?? null,
  });
}

function emitToRelevantRooms(
  io: Server,
  userId: string,
  event: string,
  payload: unknown,
): void {
  const convIds = conversationParticipantIds(userId);
  for (const cid of convIds) {
    io.to(`conv:${cid}`).emit(event, payload);
  }
}
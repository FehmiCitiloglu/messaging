import { Router } from "express";
import type { Response } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { config } from "../config.js";
import {
  db,
  findMessageById,
  findUserById,
  isParticipant,
  sql,
} from "../db.js";
import type { MessageRow, UserRow } from "../db.js";
import { errors } from "../lib/errors.js";
import { isIdLike, newId } from "../lib/ids.js";
import { authenticatedUserId, requireAuth } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../lib/http.js";
import { toConversation, toMessage, toUserLite } from "../serializers.js";
import type { Conversation, Message, UserLite } from "../types.js";

const idParamSchema = z.strictObject({ id: z.string().refine(isIdLike) });

const createConversationSchema = z.strictObject({
  type: z.enum(["direct", "group"]),
  participantIds: z.array(z.string().refine(isIdLike)).min(1).max(400),
  title: z.string().min(1).max(80).optional(),
});

const messagesQuerySchema = z.strictObject({
  before: z.string().refine(isIdLike).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

interface ConversationRow {
  id: string;
  type: string;
  title: string | null;
  created_at: string;
}

function loadConversationOrThrow(conversationId: string): ConversationRow {
  const row = sql(
    `SELECT id, type, title, created_at FROM conversations WHERE id = ?`,
  ).get(conversationId) as ConversationRow | undefined;
  if (!row) throw errors.notFound("Conversation not found");
  return row;
}

export function requireMembership(
  conversationId: string,
  userId: string,
): void {
  loadConversationOrThrow(conversationId);
  if (!isParticipant(conversationId, userId)) {
    throw errors.forbidden("You are not a participant of this conversation");
  }
}

function participantLites(conversationId: string): UserLite[] {
  const rows = sql(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.last_seen_at, u.created_at
     FROM participants p JOIN users u ON u.id = p.user_id
     WHERE p.conversation_id = ?
     ORDER BY p.joined_at ASC`,
  ).all(conversationId) as UserRow[];
  return rows.map(toUserLite);
}

function lastMessageOf(conversationId: string): Message | null {
  const row = sql(
    `SELECT id, conversation_id, sender_id, client_id, content, type, created_at, edited_at
     FROM messages WHERE conversation_id = ?
     ORDER BY created_at DESC, id DESC LIMIT 1`,
  ).get(conversationId) as MessageRow | undefined;
  return row ? toMessage(row) : null;
}

function unreadCountOf(conversationId: string, userId: string): number {
  const row = sql(
    `SELECT COUNT(*) AS n
     FROM messages m
     JOIN participants p ON p.conversation_id = m.conversation_id AND p.user_id = ?
     WHERE m.conversation_id = ?
       AND m.sender_id != ?
       AND (p.last_read_message_id IS NULL OR m.id > p.last_read_message_id)`,
  ).get(userId, conversationId, userId) as { n: number };
  return row.n;
}

function conversationView(conversationId: string, meId: string): Conversation {
  const row = loadConversationOrThrow(conversationId);
  return toConversation({
    id: row.id,
    type: row.type,
    title: row.title,
    createdAt: row.created_at,
    participants: participantLites(conversationId),
    lastMessage: lastMessageOf(conversationId),
    unreadCount: unreadCountOf(conversationId, meId),
  });
}

/**
 * deliveryStatus (viewed by `meId`):
 *  - own message: "read" once every other participant's read pointer covers it,
 *    else "delivered" once it reached every other participant's live socket,
 *    else "sent".
 *  - received message: "read" if my read pointer covers it, else "delivered".
 */
export function attachDeliveryStatus(
  rows: MessageRow[],
  meId: string,
): Array<Message & { deliveryStatus: "sent" | "delivered" | "read" }> {
  if (rows.length === 0) return [];
  const conversationId = rows[0]!.conversation_id;

  const peers = sql(
    `SELECT user_id, last_read_message_id FROM participants
     WHERE conversation_id = ? AND user_id != ?`,
  ).all(conversationId, meId) as Array<{
    user_id: string;
    last_read_message_id: string | null;
  }>;

  const myPointerRow = sql(
    `SELECT last_read_message_id FROM participants
     WHERE conversation_id = ? AND user_id = ?`,
  ).get(conversationId, meId) as
    | { last_read_message_id: string | null }
    | undefined;
  const myPointer = myPointerRow?.last_read_message_id ?? null;

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(", ");
  const deliveryRows = sql(
    `SELECT message_id, user_id FROM message_deliveries
     WHERE message_id IN (${placeholders})`,
  ).all(...ids) as Array<{ message_id: string; user_id: string }>;
  const deliveries = new Set(
    deliveryRows.map((d) => `${d.message_id}|${d.user_id}`),
  );

  return rows.map((row) => {
    let deliveryStatus: "sent" | "delivered" | "read";
    if (row.sender_id === meId) {
      const allRead =
        peers.length === 0 ||
        peers.every(
          (p) =>
            p.last_read_message_id !== null &&
            p.last_read_message_id >= row.id,
        );
      const allDelivered =
        !allRead &&
        peers.every((p) => deliveries.has(`${row.id}|${p.user_id}`));
      deliveryStatus = allRead ? "read" : allDelivered ? "delivered" : "sent";
    } else {
      deliveryStatus =
        myPointer !== null && myPointer >= row.id ? "read" : "delivered";
    }
    return { ...toMessage(row), deliveryStatus };
  });
}

function messagesRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get(
    "/:id/messages",
    requireAuth,
    validateParams(idParamSchema),
    validateQuery(messagesQuerySchema),
    (req, res: Response): void => {
      const meId = authenticatedUserId(req);
      const { id: conversationId } = res.locals["params"] as z.infer<
        typeof idParamSchema
      >;
      const query = res.locals["query"] as z.infer<typeof messagesQuerySchema>;
      requireMembership(conversationId, meId);

      const limit = query.limit ?? 50;
      const params: Array<string | number> = [conversationId];
      let where = `conversation_id = ?`;
      if (query.before !== undefined) {
        const cursor = findMessageById(query.before);
        if (!cursor || cursor.conversation_id !== conversationId) {
          throw errors.notFound(
            "Cursor message not found in this conversation",
          );
        }
        where += " AND (created_at < ? OR (created_at = ? AND id < ?))";
        params.push(cursor.created_at, cursor.created_at, cursor.id);
      }
      params.push(limit + 1);

      const rows = sql(
        `SELECT id, conversation_id, sender_id, client_id, content, type, created_at, edited_at
         FROM messages WHERE ${where}
         ORDER BY created_at DESC, id DESC LIMIT ?`,
      ).all(...params) as MessageRow[];

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      res.json({ messages: attachDeliveryStatus(page, meId), hasMore });
    },
  );

  return router;
}

export function conversationsRouter(io: Server): Router {
  const router = Router();

  router.use(requireAuth);

  router.get("/", (req, res: Response): void => {
    const meId = authenticatedUserId(req);
    const rows = sql(
      `SELECT c.id, c.type, c.title, c.created_at,
              (SELECT m.id FROM messages m WHERE m.conversation_id = c.id
               ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_id,
              COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id
               ORDER BY m.created_at DESC, m.id DESC LIMIT 1), c.created_at) AS activity_at
       FROM conversations c
       JOIN participants me ON me.conversation_id = c.id AND me.user_id = ?
       ORDER BY activity_at DESC
       LIMIT 200`,
    ).all(meId) as Array<
      ConversationRow & { last_message_id: string | null }
    >;

    const conversations = rows.map((row) =>
      toConversation({
        id: row.id,
        type: row.type,
        title: row.title,
        createdAt: row.created_at,
        participants: participantLites(row.id),
        lastMessage:
          row.last_message_id !== null
            ? (() => {
                const m = findMessageById(row.last_message_id);
                return m ? toMessage(m) : null;
              })()
            : null,
        unreadCount: unreadCountOf(row.id, meId),
      }),
    );
    res.json({ conversations });
  });

  router.post(
    "/",
    validateBody(createConversationSchema),
    (req, res: Response): void => {
      const meId = authenticatedUserId(req);
      const body = req.body as z.infer<typeof createConversationSchema>;

      const otherIds = [...new Set(body.participantIds)].filter(
        (id) => id !== meId,
      );
      if (otherIds.length === 0) {
        throw errors.validation(
          "participantIds must contain at least one other user",
        );
      }
      for (const id of otherIds) {
        if (findUserById(id) === undefined) {
          throw errors.notFound("One or more participants do not exist");
        }
      }

      if (body.type === "direct") {
        if (otherIds.length !== 1) {
          throw errors.validation(
            "direct conversations require exactly one other participant",
          );
        }
        const otherId = otherIds[0]!;
        const existing = sql(
          `SELECT c.id FROM conversations c
           JOIN participants a ON a.conversation_id = c.id AND a.user_id = ?
           JOIN participants b ON b.conversation_id = c.id AND b.user_id = ?
           WHERE c.type = 'direct'
           LIMIT 1`,
        ).get(meId, otherId) as { id: string } | undefined;
        if (existing) {
          res
            .status(201)
            .json({ conversation: conversationView(existing.id, meId) });
          return;
        }
      }

      const memberCount = otherIds.length + 1;
      if (body.type === "group" && memberCount > config.maxGroupSize) {
        throw errors.validation(
          `Group conversations are limited to ${config.maxGroupSize} members`,
        );
      }

      const conversationId = newId();
      const now = new Date().toISOString();
      const insertConv = sql(
        `INSERT INTO conversations (id, type, title, created_by, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      );
      const insertPart = sql(
        `INSERT INTO participants (conversation_id, user_id, joined_at)
         VALUES (?, ?, ?)`,
      );
      db.transaction(() => {
        insertConv.run(
          conversationId,
          body.type,
          body.type === "group" ? (body.title ?? null) : null,
          meId,
          now,
        );
        insertPart.run(conversationId, meId, now);
        for (const id of otherIds) insertPart.run(conversationId, id, now);
      })();

      // Live sockets of every participant join the room immediately.
      for (const uid of [meId, ...otherIds]) {
        io.in(`user:${uid}`).socketsJoin(`conv:${conversationId}`);
      }

      res
        .status(201)
        .json({ conversation: conversationView(conversationId, meId) });
    },
  );

  router.use("/", messagesRouter());

  return router;
}
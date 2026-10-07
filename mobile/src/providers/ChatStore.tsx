"use client";

// Gerçek zamanlı sohbet durumu: konuşma listesi, varlıklar (presence),
// yazıyor göstergeleri ve socket olaylarının merkezi bağlantısı.
// (frontend/components/chat/ChatStore.tsx ile aynı davranış.)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import {
  connectSocket,
  emitRead,
  getSocket,
  subscribe,
} from "@/lib/socket";
import type {
  Conversation,
  Message,
  ParticipantSummary,
  Presence,
} from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { truncate } from "@/lib/utils";

export interface UserPresenceInfo {
  presence: Presence;
  lastSeenAt: string | null;
}

interface ChatStoreValue {
  conversations: Conversation[];
  loadingConversations: boolean;
  connected: boolean;
  presenceMap: Record<string, UserPresenceInfo>;
  /** conversationId → yazıyor olan diğer kullanıcıların kimlikleri */
  typingMap: Record<string, string[]>;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  upsertConversation: (conversation: Conversation) => void;
  patchMessageIntoConversation: (message: Message) => void;
  clearUnread: (conversationId: string) => void;
  /** Bilinen kullanıcıları (arama + presence) son görülme bilgisiyle birleştir. */
  rememberUsers: (
    users:
      | ParticipantSummary[]
      | { id: string; presence: Presence; lastSeenAt: string | null }[],
  ) => void;
  getLastSeen: (userId: string) => string | null;
}

const ChatStoreContext = createContext<ChatStoreValue | null>(null);

/** Konuşma sıralaması: son mesaj zamanına göre yeniden eskiye. */
function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const ta = a.lastMessage?.createdAt ?? a.createdAt;
    const tb = b.lastMessage?.createdAt ?? b.createdAt;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });
}

/** Doğrudan konuşmadaki karşı taraf. */
export function otherParticipant(
  conversation: Conversation,
  meId: string,
): ParticipantSummary | null {
  return conversation.participants.find((p) => p.id !== meId) ?? null;
}

/** Liste/başlık için görünen ad. */
export function conversationTitle(
  conversation: Conversation,
  meId: string,
): string {
  if (conversation.type === "group" && conversation.title)
    return conversation.title;
  const other = otherParticipant(conversation, meId);
  return other?.displayName ?? conversation.title ?? "Sohbet";
}

export function ChatStoreProvider({
  meId,
  children,
}: {
  meId: string;
  children: ReactNode;
}) {
  const { announce } = useToast();
  const { status } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [connected, setConnected] = useState(false);
  const [presenceMap, setPresenceMap] = useState<
    Record<string, UserPresenceInfo>
  >({});
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({});
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const activeIdRef = useRef<string | null>(null);
  // Ref güncellemesi render dışında yapılır (React 19 ref kuralı).
  useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const typingTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  // ---- Konuşmaları yükle ----
  const refreshConversations = useCallback(async () => {
    try {
      const { conversations: list } = await api.conversations();
      setConversations(sortConversations(list));
    } catch {
      // Ağ/backend yok: liste boş kalır (bağlantı durumu görünür).
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authed") return;
    const t = setTimeout(() => void refreshConversations(), 0);
    return () => clearTimeout(t);
  }, [status, refreshConversations]);

  // ---- Yardımcı güncelleyiciler ----
  const patchMessageIntoConversation = useCallback(
    (message: Message) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === message.conversationId);
        if (idx === -1) return prev;
        const conv = { ...prev[idx], lastMessage: message };
        const isActive = activeIdRef.current === message.conversationId;
        const mine = message.senderId === meId;
        if (!mine && !isActive) {
          conv.unreadCount = (prev[idx].unreadCount ?? 0) + 1;
        }
        const next = [...prev];
        next[idx] = conv;
        return sortConversations(next);
      });
    },
    [meId],
  );

  const upsertConversation = useCallback((conversation: Conversation) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conversation.id);
      const next = [...prev];
      if (idx === -1) next.push(conversation);
      else next[idx] = { ...next[idx], ...conversation };
      return sortConversations(next);
    });
  }, []);

  const clearUnread = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId && c.unreadCount !== 0
          ? { ...c, unreadCount: 0 }
          : c,
      ),
    );
  }, []);

  const rememberUsers = useCallback(
    (
      users:
        | ParticipantSummary[]
        | { id: string; presence: Presence; lastSeenAt: string | null }[],
    ) => {
      setPresenceMap((prev) => {
        const next = { ...prev };
        for (const u of users) {
          const info: UserPresenceInfo = {
            presence: u.presence,
            lastSeenAt:
              "lastSeenAt" in u
                ? u.lastSeenAt
                : (next[u.id]?.lastSeenAt ?? null),
          };
          next[u.id] = next[u.id]
            ? {
                presence: u.presence,
                lastSeenAt: info.lastSeenAt ?? next[u.id].lastSeenAt,
              }
            : info;
        }
        return next;
      });
    },
    [],
  );

  const getLastSeen = useCallback(
    (userId: string) => presenceMap[userId]?.lastSeenAt ?? null,
    [presenceMap],
  );

  // ---- Socket olayları ----
  useEffect(() => {
    if (status !== "authed") return;

    const socket = connectSocket();
    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    queueMicrotask(() => setConnected(socket.connected));

    const offs = [
      subscribe("message:new", (message: Message) => {
        patchMessageIntoConversation(message);
        if (message.senderId !== meId) {
          if (activeIdRef.current === message.conversationId) {
            // Aktif konuşma açık: okundu bildir.
            emitRead(message.conversationId, message.id);
          } else {
            announce(`Yeni mesaj: ${truncate(message.content, 60)}`);
          }
        }
      }),
      subscribe("presence:update", (update) => {
        rememberUsers([
          {
            id: update.userId,
            presence: update.presence,
            lastSeenAt: update.lastSeenAt,
          },
        ]);
        // Konuşma katılımcılarındaki rozeti de canlı tut.
        setConversations((prev) =>
          prev.map((c) => ({
            ...c,
            participants: c.participants.map((p) =>
              p.id === update.userId
                ? { ...p, presence: update.presence }
                : p,
            ),
          })),
        );
      }),
      subscribe("typing:update", (update) => {
        const key = `${update.conversationId}:${update.userId}`;
        if (typingTimers.current[key])
          clearTimeout(typingTimers.current[key]);
        setTypingMap((prev) => {
          const current = prev[update.conversationId] ?? [];
          const has = current.includes(update.userId);
          if (update.typing && !has) {
            return {
              ...prev,
              [update.conversationId]: [...current, update.userId],
            };
          }
          if (!update.typing && has) {
            return {
              ...prev,
              [update.conversationId]: current.filter(
                (id) => id !== update.userId,
              ),
            };
          }
          return prev;
        });
        if (update.typing) {
          // Güvenlik ağı: stop gelmezse 4 sn sonra kendiliğinden sönsün.
          typingTimers.current[key] = setTimeout(() => {
            setTypingMap((prev) => ({
              ...prev,
              [update.conversationId]: (
                prev[update.conversationId] ?? []
              ).filter((id) => id !== update.userId),
            }));
          }, 4000);
        }
      }),
    ];

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      offs.forEach((off) => off());
    };
  }, [status, meId, patchMessageIntoConversation, rememberUsers, announce]);

  const value = useMemo<ChatStoreValue>(
    () => ({
      conversations,
      loadingConversations,
      connected,
      presenceMap,
      typingMap,
      activeConversationId,
      setActiveConversationId,
      refreshConversations,
      upsertConversation,
      patchMessageIntoConversation,
      clearUnread,
      rememberUsers,
      getLastSeen,
    }),
    [
      conversations,
      loadingConversations,
      connected,
      presenceMap,
      typingMap,
      activeConversationId,
      refreshConversations,
      upsertConversation,
      patchMessageIntoConversation,
      clearUnread,
      rememberUsers,
      getLastSeen,
    ],
  );

  return (
    <ChatStoreContext.Provider value={value}>
      {children}
    </ChatStoreContext.Provider>
  );
}

export function useChatStore(): ChatStoreValue {
  const ctx = useContext(ChatStoreContext);
  if (!ctx)
    throw new Error("useChatStore, ChatStoreProvider içinde kullanılmalıdır.");
  return ctx;
}

export function useSocketReady(): boolean {
  return Boolean(getSocket());
}
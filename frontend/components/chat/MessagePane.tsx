"use client";

// Mesaj bölmesi: başlık (ad, varlık satırı, yazıyor göstergesi), kaydırılabilir
// mesaj akışı (sonsuz yukarı kaydırma, akıllı gün ayırıcıları, gruplama) ve
// besteci. Optimistik gönderim: clientId ile anında baloncuk, socket ack /
// message:new ile uzlaştırma (tekilleştirme), başarısızda yeniden dene.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Composer } from "@/components/chat/Composer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import {
  conversationTitle,
  otherParticipant,
  useChatStore,
} from "@/components/chat/ChatStore";
import { TypingDots } from "@/components/ui/TypingDots";
import {
  ChevronLeftIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { MessageStreamSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api";
import { ApiError, friendlyMessage } from "@/lib/errors";
import {
  formatDayDivider,
  formatLastSeen,
  isSameDay,
} from "@/lib/format";
import { emitRead, sendMessage, subscribe } from "@/lib/socket";
import { cx, newClientId, truncate } from "@/lib/utils";
import type { LocalMessage, Message } from "@/lib/types";

// SSR güvenli layout effect (sunucuda uyarı vermemesi için).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Aynı grupta mı? (gönderen + 5 dakika penceresi + aynı gün) */
function inSameGroup(a: LocalMessage, b: LocalMessage): boolean {
  return (
    a.senderId === b.senderId &&
    isSameDay(new Date(a.createdAt), new Date(b.createdAt)) &&
    Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) <
      5 * 60_000
  );
}

/** clientId/id ile tekilleştirerek birleştirir; varsa günceller, yoksa ekler. */
function mergeMessage(
  items: LocalMessage[],
  incoming: LocalMessage,
  fallbackStatus?: LocalMessage["status"],
): LocalMessage[] {
  const idxById = items.findIndex((m) => m.id === incoming.id);
  const idxByClient =
    idxById === -1
      ? items.findIndex((m) => m.clientId && m.clientId === incoming.clientId)
      : idxById;
  if (idxByClient === -1) return [...items, incoming];

  const prev = items[idxByClient];
  const merged: LocalMessage = {
    ...prev,
    ...incoming,
    // Okunduysa geri düşürme.
    status:
      prev.status === "read"
        ? "read"
        : (incoming.status ?? fallbackStatus ?? prev.status ?? "sent"),
  };
  const next = [...items];
  next[idxByClient] = merged;
  return next;
}

export function MessagePane({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const { toast, announce } = useToast();
  const router = useRouter();
  const {
    conversations,
    typingMap,
    presenceMap,
    clearUnread,
    patchMessageIntoConversation,
  } = useChatStore();

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId) ?? null,
    [conversations, conversationId],
  );

  const [items, setItems] = useState<LocalMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<LocalMessage[]>([]);
  const restoreRef = useRef<{ height: number; top: number } | null>(null);
  const nearBottomRef = useRef(true);
  const stickToBottomRef = useRef(true);

  // Ref aynası render dışında güncellenir (React 19 ref kuralı).
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // ---- İlk yükleme / konuşma değişimi ----
  const loadInitial = useCallback(async () => {
    setInitialLoading(true);
    setItems([]);
    setHasMore(false);
    setLoadError(null);
    nearBottomRef.current = true;
    stickToBottomRef.current = true;
    try {
      const res = await api.messages(conversationId, { limit: 50 });
      // Sözleşme: NEWEST-first → kronolojik sıraya çeviriyoruz.
      const ascending = [...res.messages].reverse();
      setItems(ascending);
      setHasMore(res.hasMore);
      clearUnread(conversationId);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.friendly : "Mesajlar yüklenemedi.",
      );
    } finally {
      setInitialLoading(false);
    }
  }, [conversationId, clearUnread]);

  useEffect(() => {
    // Yüklemeyi efekt gövdesi dışında başlat (senkron setState zincirlemesini önler).
    const t = setTimeout(() => void loadInitial(), 0);
    return () => clearTimeout(t);
  }, [loadInitial]);

  // ---- Okundu bildirimi ----
  const markReadLatest = useCallback(() => {
    if (typeof document !== "undefined" && !document.hasFocus()) return;
    const list = itemsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.senderId !== meId && !m.id.startsWith("local:")) {
        emitRead(conversationId, m.id);
        clearUnread(conversationId);
        return;
      }
    }
    clearUnread(conversationId);
  }, [conversationId, meId, clearUnread]);

  useEffect(() => {
    window.addEventListener("focus", markReadLatest);
    return () => window.removeEventListener("focus", markReadLatest);
  }, [markReadLatest]);

  // ---- Socket olayları (bu konuşma) ----
  useEffect(() => {
    const offNew = subscribe("message:new", (message: Message) => {
      if (message.conversationId !== conversationId) return;
      if (message.senderId !== meId) {
        announce(`Yeni mesaj geldi: ${truncate(message.content, 60)}`);
      }
      setItems((prev) =>
        mergeMessage(prev, { ...message, status: message.senderId === meId ? "sent" : undefined }),
      );
      // Kendi mesajımız geri geldiyse gönderiliyor → gönderildi.
      if (message.senderId === meId) {
        setItems((prev) =>
          prev.map((m) =>
            m.clientId === message.clientId && m.status === "sending"
              ? { ...m, status: "sent" }
              : m,
          ),
        );
      }
      markReadLatest();
    });

    const offRead = subscribe("message:read", (receipt) => {
      if (receipt.conversationId !== conversationId) return;
      if (receipt.readerId === meId) return;
      setItems((prev) => {
        const refIdx = prev.findIndex((m) => m.id === receipt.messageId);
        return prev.map((m, i) => {
          if (m.senderId !== meId || !m.status) return m;
          const covered = refIdx === -1 ? true : i <= refIdx;
          return covered && m.status !== "read" ? { ...m, status: "read" } : m;
        });
      });
    });

    return () => {
      offNew();
      offRead();
    };
  }, [conversationId, meId, conversation, announce, markReadLatest]);

  // ---- Akış davranışı: kaydırma konumu koruma + otomatik alt kısım ----
  useIsoLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const restore = restoreRef.current;
    if (restore) {
      // Eski mesajlar eklenince kaydırma yerini koru.
      el.scrollTop = restore.top + (el.scrollHeight - restore.height);
      restoreRef.current = null;
      return;
    }
    if (stickToBottomRef.current || nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items]);

  const loadOlder = useCallback(async () => {
    const list = itemsRef.current;
    if (!hasMore || loadingOlder || list.length === 0) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    restoreRef.current = el ? { height: el.scrollHeight, top: el.scrollTop } : null;
    try {
      const res = await api.messages(conversationId, {
        before: list[0].id,
        limit: 50,
      });
      const olderAscending = [...res.messages].reverse();
      setItems((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = olderAscending.filter((m) => !seen.has(m.id));
        return [...fresh, ...prev];
      });
      setHasMore(res.hasMore);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        restoreRef.current = null;
        toast(
          err instanceof ApiError ? err.friendly : "Daha eski mesajlar yüklenemedi.",
          "error",
        );
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, toast]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottomRef.current) stickToBottomRef.current = true;
    else stickToBottomRef.current = false;
    if (el.scrollTop < 48) void loadOlder();
  }, [loadOlder]);

  // ---- Gönderim (optimistik) ----
  const dispatchMessage = useCallback(
    (content: string, clientId: string, replaceId: string) => {
      const optimistic: LocalMessage = {
        id: replaceId,
        conversationId,
        senderId: meId,
        clientId,
        content,
        type: "text",
        createdAt: new Date().toISOString(),
        editedAt: null,
        status: "sending",
      };

      nearBottomRef.current = true;
      stickToBottomRef.current = true;
      setItems((prev) => mergeMessage(prev, optimistic, "sending"));

      const timeout = setTimeout(() => {
        setItems((prev) =>
          prev.map((m) =>
            m.clientId === clientId && m.status === "sending"
              ? { ...m, status: "failed", errorCode: "NETWORK" }
              : m,
          ),
        );
      }, 10_000);

      const ok = sendMessage(
        { conversationId, clientId, content, type: "text" },
        (response) => {
          clearTimeout(timeout);
          if (response.ok && response.message) {
            patchMessageIntoConversation(response.message);
            setItems((prev) =>
              mergeMessage(
                prev,
                { ...response.message, status: "sent" } as LocalMessage,
                "sent",
              ),
            );
          } else {
            const code = response.error?.code;
            setItems((prev) =>
              prev.map((m) =>
                m.clientId === clientId
                  ? { ...m, status: "failed", errorCode: code }
                  : m,
              ),
            );
            toast(friendlyMessage(code), "error");
          }
        },
      );

      if (!ok) {
        clearTimeout(timeout);
        setItems((prev) =>
          prev.map((m) =>
            m.clientId === clientId ? { ...m, status: "failed", errorCode: "NETWORK" } : m,
          ),
        );
        toast(friendlyMessage("NETWORK"), "error");
      }
    },
    [conversationId, meId, patchMessageIntoConversation, toast],
  );

  const onSend = useCallback(
    (content: string) => {
      const clientId = newClientId();
      dispatchMessage(content, clientId, `local:${clientId}`);
    },
    [dispatchMessage],
  );

  const onRetry = useCallback(
    (message: LocalMessage) => {
      setItems((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, status: "sending", errorCode: undefined } : m,
        ),
      );
      dispatchMessage(message.content, message.clientId, message.id);
    },
    [dispatchMessage],
  );

  // ---- Başlık bilgileri ----
  const other = conversation ? otherParticipant(conversation, meId) : null;
  const title = conversation
    ? conversationTitle(conversation, meId)
    : "Sohbet";
  const typingUserIds = (typingMap[conversationId] ?? []).filter((id) => id !== meId);
  const typingNames = typingUserIds.map((id) => {
    const p = conversation?.participants.find((x) => x.id === id);
    return p?.displayName ?? "Birisi";
  });
  const isGroup = conversation?.type === "group";
  const onlineCount =
    conversation?.participants.filter((p) => p.presence === "online").length ?? 0;
  const presenceInfo = other ? presenceMap[other.id] : undefined;

  let presenceLine: string;
  if (typingNames.length === 1) presenceLine = "yazıyor…";
  else if (typingNames.length > 1) presenceLine = `${typingNames.length} kişi yazıyor…`;
  else if (isGroup)
    presenceLine = `${conversation?.participants.length ?? 0} üye · ${onlineCount} çevrimiçi`;
  else if (other?.presence === "online") presenceLine = "çevrimiçi";
  else if (presenceInfo?.lastSeenAt)
    presenceLine = `son görülme ${formatLastSeen(presenceInfo.lastSeenAt)}`;
  else presenceLine = "çevrimdışı";

  // ---- Akışın çizimi: gün ayırıcı + gruplama ----
  const rows = useMemo(() => {
    const out: React.ReactNode[] = [];
    items.forEach((m, i) => {
      const prev = items[i - 1];
      const next = items[i + 1];
      const newDay = !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
      const startsGroup = !prev || !inSameGroup(prev, m) || newDay;
      const endsGroup = !next || !inSameGroup(m, next);
      const groupPos = startsGroup && endsGroup ? "single" : startsGroup ? "first" : endsGroup ? "last" : "middle";
      const own = m.senderId === meId;

      if (newDay) {
        out.push(
          <div key={`day-${m.id}`} className="my-4 flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
            <span className="rounded-full bg-slate-100/90 px-3 py-1 text-2xs font-semibold tracking-wide text-slate-500 uppercase shadow-soft dark:bg-panelalt-dark dark:text-slate-400">
              {formatDayDivider(m.createdAt)}
            </span>
            <span className="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
          </div>,
        );
      }

      const senderName = conversation?.participants.find((p) => p.id === m.senderId)
        ?.displayName;
      out.push(
        <MessageBubble
          key={m.id}
          message={m}
          own={own}
          showSenderName={isGroup && !own && startsGroup}
          senderName={senderName}
          senderId={m.senderId}
          groupPos={groupPos}
          showAvatar={!own && isGroup && endsGroup}
          isLastInStream={i === items.length - 1}
          onRetry={onRetry}
        />,
      );
    });
    return out;
  }, [items, meId, isGroup, conversation, onRetry]);

  return (
    <>
      {/* ---- Başlık ---- */}
      <header className="safe-top flex items-center gap-3 border-b border-slate-200/80 bg-panel-light/85 px-3 py-2.5 backdrop-blur-xl dark:border-slate-800 dark:bg-panel-dark/85 sm:px-4">
        <button
          type="button"
          onClick={() => router.push("/chat")}
          aria-label="Konuşma listesine dön"
          className="-ml-1 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-panelalt-dark dark:hover:text-slate-100 md:hidden"
        >
          <ChevronLeftIcon className="size-5" />
        </button>

        {isGroup ? (
          <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/90 to-fuchsia-400/90 text-white">
            <UsersIcon className="size-5" />
          </span>
        ) : (
          <Avatar
            id={other?.id ?? conversationId}
            name={title}
            avatarUrl={other?.avatarUrl ?? null}
            size="md"
            presence={other?.presence ?? null}
          />
        )}

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <p
            className={cx(
              "flex items-center gap-1.5 truncate text-xs",
              typingNames.length > 0
                ? "font-medium text-brand-600 dark:text-brand-300"
                : !isGroup && other?.presence === "online"
                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400",
            )}
            aria-live="polite"
          >
            {typingNames.length > 0 ? (
              <>
                <TypingDots />
                {typingNames.length === 1
                  ? `${typingNames[0]} yazıyor…`
                  : `${typingNames[0]} ve ${typingNames.length - 1} kişi yazıyor…`}
              </>
            ) : (
              presenceLine
            )}
          </p>
        </div>
      </header>

      {/* ---- Mesaj akışı ---- */}
      {initialLoading ? (
        <MessageStreamSkeleton />
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          role="log"
          aria-label="Mesaj akışı"
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
        >
          {loadError ? (
            <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
              {loadError}
              <button
                type="button"
                onClick={() => void loadInitial()}
                className="ml-2 font-semibold underline underline-offset-2"
              >
                Tekrar dene
              </button>
            </div>
          ) : null}

          {hasMore ? (
            <div className="flex justify-center pb-3">
              {loadingOlder ? (
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="size-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  Daha eski mesajlar yükleniyor…
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-soft transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-panelalt-dark dark:text-slate-300 dark:hover:bg-panel-dark"
                >
                  Daha eski mesajları göster
                </button>
              )}
            </div>
          ) : null}

          {items.length === 0 && !loadError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-semibold">Henüz mesaj yok</p>
              <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
                Bu konuşmadaki ilk mesajı sen yaz — sohbet başlasın!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">{rows}</div>
          )}
        </div>
      )}

      <Composer conversationId={conversationId} onSend={onSend} />
    </>
  );
}
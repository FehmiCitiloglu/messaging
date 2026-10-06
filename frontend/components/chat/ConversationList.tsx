"use client";

// Konuşma listesi: arama (Ctrl/⌘+K), okunmamış rozetleri, son mesaj önizlemesi,
// göreli zaman, çevrimiçi noktaları ve ok tuşlarıyla klavye gezinmesi.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { ConversationListSkeleton } from "@/components/ui/Skeleton";
import { PencilIcon, SearchIcon, UsersIcon } from "@/components/ui/icons";
import { TypingDots } from "@/components/ui/TypingDots";
import { NewChatModal } from "@/components/chat/NewChatModal";
import {
  conversationTitle,
  otherParticipant,
  useChatStore,
} from "@/components/chat/ChatStore";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatRelative } from "@/lib/format";
import { cx, truncate } from "@/lib/utils";
import type { Conversation } from "@/lib/types";

export function ConversationList() {
  const {
    conversations,
    loadingConversations,
    typingMap,
    activeConversationId,
  } = useChatStore();
  const { user } = useAuth();
  const router = useRouter();
  const meId = user?.id ?? "";

  const [query, setQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Ctrl/⌘ + K → konuşma aramasına odaklan.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return conversations;
    return conversations.filter((c) => {
      const title = conversationTitle(c, meId).toLocaleLowerCase("tr-TR");
      const names = c.participants
        .map((p) => `${p.displayName} ${p.username}`)
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return title.includes(q) || names.includes(q);
    });
  }, [conversations, query, meId]);

  // Klavye gezinmesi: ↑ ↓ Home End + Enter/Space seçer (buton doğal davranışı).
  const onListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const count = filtered.length;
      if (count === 0) return;
      let next = focusIndex;
      if (e.key === "ArrowDown") next = Math.min(focusIndex + 1, count - 1);
      else if (e.key === "ArrowUp") next = Math.max(focusIndex - 1, 0);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = count - 1;
      else return;
      e.preventDefault();
      setFocusIndex(next);
      rowRefs.current[next]?.focus();
    },
    [filtered.length, focusIndex],
  );

  const selectConversation = useCallback(
    (c: Conversation) => {
      setFocusIndex(filtered.findIndex((f) => f.id === c.id));
      router.push(`/chat/${c.id}`);
    },
    [filtered, router],
  );

  const totalUnread = conversations.reduce((n, c) => n + (c.unreadCount ?? 0), 0);

  return (
    <div className="safe-top flex min-h-0 flex-1 flex-col">
      {/* Başlık */}
      <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sohbetler</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            {totalUnread > 0
              ? `${totalUnread} okunmamış mesaj`
              : conversations.length > 0
                ? `${conversations.length} konuşma`
                : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewChatOpen(true)}
          aria-label="Yeni sohbet başlat"
          title="Yeni sohbet"
          className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft transition-all duration-150 hover:bg-brand-700 active:scale-95"
        >
          <PencilIcon className="size-4.5" />
        </button>
      </header>

      {/* Arama */}
      <div className="px-3 pb-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            id="conversation-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocusIndex(0);
            }}
            placeholder="Konuşmalarda ara…"
            aria-label="Konuşmalarda ara"
            aria-keyshortcuts="Control+K Meta+K"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200/80 bg-slate-50 py-2 pr-3 pl-9 text-sm outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700/70 dark:bg-panelalt-dark dark:focus:bg-panelalt-dark"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-2xs text-slate-400 dark:border-slate-600 dark:bg-panel-dark md:block">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Liste */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        {loadingConversations ? (
          <ConversationListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyList hasQuery={Boolean(query.trim())} onNewChat={() => setNewChatOpen(true)} />
        ) : (
          <ul
            role="listbox"
            aria-label="Konuşma listesi"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            className="flex flex-col gap-0.5 outline-none"
          >
            {filtered.map((c, i) => {
              const title = conversationTitle(c, meId);
              const other = otherParticipant(c, meId);
              const isGroup = c.type === "group";
              const typingHere = (typingMap[c.id] ?? []).length > 0;
              const last = c.lastMessage;
              const mine = last?.senderId === meId;
              const unread = c.unreadCount ?? 0;
              const active = c.id === activeConversationId;

              return (
                <li key={c.id} role="option" aria-selected={active}>
                  <button
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    type="button"
                    tabIndex={i === Math.min(focusIndex, filtered.length - 1) ? 0 : -1}
                    onFocus={() => setFocusIndex(i)}
                    onClick={() => selectConversation(c)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150",
                      active
                        ? "bg-brand-50 dark:bg-brand-900/35"
                        : "hover:bg-slate-50 dark:hover:bg-panelalt-dark",
                    )}
                  >
                    {isGroup ? (
                      <span className="relative inline-flex shrink-0">
                        <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/90 to-fuchsia-400/90 text-white ring-1 ring-black/5 dark:ring-white/10">
                          <UsersIcon className="size-5" />
                        </span>
                      </span>
                    ) : (
                      <Avatar
                        id={other?.id ?? c.id}
                        name={title}
                        avatarUrl={other?.avatarUrl ?? null}
                        size="md"
                        presence={other?.presence ?? null}
                      />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cx(
                            "truncate text-sm",
                            unread > 0 ? "font-bold" : "font-semibold",
                          )}
                        >
                          {title}
                        </span>
                        <time
                          className={cx(
                            "shrink-0 text-2xs tabular-nums",
                            unread > 0
                              ? "font-semibold text-brand-600 dark:text-brand-300"
                              : "text-slate-400 dark:text-slate-500",
                          )}
                          dateTime={last?.createdAt ?? c.createdAt}
                        >
                          {formatRelative(last?.createdAt ?? c.createdAt)}
                        </time>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span
                          className={cx(
                            "min-w-0 flex-1 truncate text-xs",
                            typingHere
                              ? "font-medium text-brand-600 dark:text-brand-300"
                              : unread > 0
                                ? "font-medium text-slate-800 dark:text-slate-200"
                                : "text-slate-500 dark:text-slate-400",
                          )}
                        >
                          {typingHere ? (
                            <span className="inline-flex items-center gap-1.5">
                              <TypingDots /> yazıyor…
                            </span>
                          ) : last ? (
                            <>
                              {mine ? <span className="text-slate-400">Sen: </span> : null}
                              {truncate(last.content, 42)}
                            </>
                          ) : (
                            "Henüz mesaj yok — ilk mesajı sen yaz!"
                          )}
                        </span>
                        {unread > 0 ? (
                          <span
                            aria-label={`${unread} okunmamış mesaj`}
                            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-2xs font-bold text-white"
                          >
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} />
    </div>
  );
}

function EmptyList({
  hasQuery,
  onNewChat,
}: {
  hasQuery: boolean;
  onNewChat: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-panelalt-dark dark:text-slate-500">
        <SearchIcon className="size-6" />
      </span>
      <div>
        <p className="text-sm font-semibold">
          {hasQuery ? "Eşleşen konuşma yok" : "Henüz konuşma yok"}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hasQuery
            ? "Farklı bir kelime deneyebilirsin."
            : "Yeni bir sohbet başlatarak işe koyul."}
        </p>
      </div>
      {!hasQuery ? (
        <button
          type="button"
          onClick={onNewChat}
          className="mt-1 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
        >
          Yeni sohbet başlat
        </button>
      ) : null}
    </div>
  );
}
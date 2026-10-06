"use client";

// Yeni sohbet: kullanıcı arama (GET /api/users?q=), çoklu seçimle grup kurma.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonSpinner } from "@/components/ui/Skeleton";
import { SearchIcon, UsersIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { useToast } from "@/components/providers/ToastProvider";
import { useChatStore } from "@/components/chat/ChatStore";
import { inputClass, primaryButtonClass } from "@/components/auth/AuthShell";
import { cx, truncate } from "@/lib/utils";
import type { User } from "@/lib/types";

export function NewChatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const { upsertConversation, rememberUsers } = useChatStore();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Arama (300 ms geciktirmeli, önceki istek iptalli)
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    // Durum güncellemeleri zamanlayıcı geri çağrısında yapılır (senkron setState yok).
    debounceRef.current = setTimeout(async () => {
      if (!q) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { users } = await api.searchUsers(q, controller.signal);
        setResults(users);
        rememberUsers(users);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        toast(
          err instanceof ApiError ? err.friendly : "Arama sırasında bir sorun oluştu.",
          "error",
        );
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, toast, rememberUsers]);

  const reset = useCallback(() => {
    setQuery("");
    setResults([]);
    setGroupMode(false);
    setSelected([]);
    setGroupTitle("");
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const toggleSelect = (user: User) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    );
  };

  const startConversation = async (user: User | null) => {
    if (creating) return;
    setCreating(true);
    try {
      const isGroup = groupMode && selected.length >= 2;
      const participantIds = isGroup
        ? selected.map((u) => u.id)
        : user
          ? [user.id]
          : selected.map((u) => u.id);

      if (participantIds.length === 0) {
        setCreating(false);
        return;
      }

      const { conversation } = await api.createConversation({
        type: isGroup ? "group" : "direct",
        participantIds,
        ...(isGroup && groupTitle.trim() ? { title: groupTitle.trim() } : {}),
      });
      upsertConversation(conversation);
      rememberUsers(
        conversation.participants.map((p) => ({
          id: p.id,
          presence: p.presence,
          lastSeenAt: null,
        })),
      );
      close();
      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      toast(
        err instanceof ApiError ? err.friendly : "Sohbet oluşturulamadı. Tekrar dene.",
        "error",
      );
    } finally {
      setCreating(false);
    }
  };

  const selectableCount = selected.length;

  return (
    <Modal open={open} onClose={close} title="Yeni sohbet" wide>
      {/* Arama kutusu */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kullanıcı adı veya görünen ad ara…"
          aria-label="Kullanıcı ara"
          autoComplete="off"
          className={cx(inputClass, "pl-10")}
        />
      </div>

      {/* Grup modu anahtarı */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={groupMode}
            onChange={(e) => {
              setGroupMode(e.target.checked);
              if (!e.target.checked) setSelected([]);
            }}
            className="size-4 rounded border-slate-300 accent-brand-600"
          />
          <UsersIcon className="size-4" />
          Grup sohbeti oluştur
        </label>
        {groupMode ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {selectableCount} kişi seçildi
          </span>
        ) : null}
      </div>

      {groupMode ? (
        <input
          type="text"
          value={groupTitle}
          onChange={(e) => setGroupTitle(e.target.value)}
          placeholder="Grup adı (isteğe bağlı)"
          maxLength={40}
          aria-label="Grup adı"
          className={cx(inputClass, "mt-3")}
        />
      ) : null}

      {/* Seçilenler */}
      {groupMode && selected.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Seçilen kişiler">
          {selected.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => toggleSelect(u)}
                aria-label={`${u.displayName} seçimini kaldır`}
                className="flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-2 pl-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/70"
              >
                <Avatar id={u.id} name={u.displayName} size="xs" />
                {truncate(u.displayName, 18)}
                <span aria-hidden className="opacity-60">✕</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Sonuçlar */}
      <ul
        className="mt-3 max-h-64 overflow-y-auto"
        aria-label="Arama sonuçları"
        aria-busy={searching}
      >
        {searching ? (
          <li className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
            <ButtonSpinner /> Aranıyor…
          </li>
        ) : results.length === 0 ? (
          <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {query.trim()
              ? "Kimse bulunamadı. Farklı bir arama dene."
              : "Sohbet etmek için bir kullanıcı ara."}
          </li>
        ) : (
          results.map((u) => {
            const isSelected = selected.some((s) => s.id === u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => (groupMode ? toggleSelect(u) : void startConversation(u))}
                  aria-pressed={groupMode ? isSelected : undefined}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150",
                    isSelected
                      ? "bg-brand-50 dark:bg-brand-900/40"
                      : "hover:bg-slate-50 dark:hover:bg-panelalt-dark",
                  )}
                >
                  <Avatar
                    id={u.id}
                    name={u.displayName}
                    avatarUrl={u.avatarUrl}
                    size="sm"
                    presence={u.presence}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {u.displayName}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      @{u.username}
                    </span>
                  </span>
                  {groupMode && isSelected ? (
                    <span className="text-xs font-semibold text-brand-600 dark:text-brand-300">
                      Seçildi
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {groupMode ? (
        <button
          type="button"
          onClick={() => void startConversation(null)}
          disabled={creating || selectableCount < 2}
          className={cx(primaryButtonClass, "mt-4")}
        >
          {creating ? <ButtonSpinner /> : null}
          {creating ? "Grup oluşturuluyor…" : "Grup sohbeti oluştur"}
        </button>
      ) : null}
    </Modal>
  );
}
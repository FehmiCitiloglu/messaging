"use client";

// Konuşma seçili değilken gösterilen rafine boş durum.

import { useChatStore } from "@/components/chat/ChatStore";
import { LogoMark } from "@/components/ui/icons";

export default function EmptyChat() {
  const { conversations } = useChatStore();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-brand-100/80 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
        <LogoMark className="size-7" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Mesaj yazmak için bir konuşma seçin</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {conversations.length > 0
            ? "Soldaki listeden bir sohbet açabilir ya da yeni bir sohbet başlatabilirsin."
            : "Henüz konuşma yok — yeni bir sohbet başlatarak işe koyul."}
        </p>
      </div>
      <kbd className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-2xs text-slate-500 shadow-soft dark:border-slate-700 dark:bg-panelalt-dark dark:text-slate-400">
        Ctrl/⌘ + K · konuşmalarda ara
      </kbd>
    </div>
  );
}
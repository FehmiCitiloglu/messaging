"use client";

// Besteci: otomatik büyüyen textarea, Enter gönderir / Shift+Enter satır atlar,
// sınır yaklaşınca karakter sayacı, yazıyor… bildirimi (typing:start/stop).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { SendIcon } from "@/components/ui/icons";
import { emitTypingStart, emitTypingStop } from "@/lib/socket";
import { cx } from "@/lib/utils";

const MAX_LENGTH = 2000;
const COUNTER_THRESHOLD = 200;

interface ComposerProps {
  conversationId: string;
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function Composer({ conversationId, onSend, disabled }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingSentRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (typingSentRef.current) {
      emitTypingStop(conversationId);
      typingSentRef.current = false;
    }
  }, [conversationId]);

  // Konuşma değişince ya da bileşen kalkınca yazıyor durumunu kapat.
  useEffect(() => stopTyping, [stopTyping]);

  const autogrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 152)}px`;
  }, []);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    stopTyping();
    // Yüksekliği sıfırla.
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      textareaRef.current?.focus();
    });
  }, [value, disabled, onSend, stopTyping]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onChange = (next: string) => {
    setValue(next);
    autogrow();

    if (!typingSentRef.current && next.trim().length > 0) {
      emitTypingStart(conversationId);
      typingSentRef.current = true;
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(stopTyping, 2000);
  };

  const remaining = MAX_LENGTH - value.length;
  const showCounter = remaining <= COUNTER_THRESHOLD;
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="safe-bottom border-t border-slate-200/80 bg-panel-light/85 px-3 pt-2.5 backdrop-blur-xl dark:border-slate-800 dark:bg-panel-dark/85 sm:px-4">
      {showCounter ? (
        <p
          className={cx(
            "px-1 pb-1 text-right text-2xs tabular-nums",
            remaining <= 0
              ? "font-semibold text-red-600 dark:text-red-400"
              : remaining <= 50
                ? "font-medium text-amber-600 dark:text-amber-400"
                : "text-slate-400 dark:text-slate-500",
          )}
          aria-live="polite"
        >
          {remaining} karakter kaldı
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={stopTyping}
          placeholder="Mesaj yaz…"
          aria-label="Mesaj yaz"
          rows={1}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          className={cx(
            "min-h-11 flex-1 resize-none rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-2.5",
            "text-base leading-relaxed outline-none transition-colors duration-150",
            "placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20",
            "dark:border-slate-700/70 dark:bg-panelalt-dark dark:focus:bg-panelalt-dark",
            "max-h-[9.5rem] overflow-y-auto",
          )}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="Gönder"
          title="Gönder (Enter)"
          className={cx(
            "mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-soft",
            "transition-all duration-150 active:scale-95",
            canSend
              ? "bg-brand-600 hover:bg-brand-700"
              : "cursor-not-allowed bg-slate-300 dark:bg-slate-700",
          )}
        >
          <SendIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}
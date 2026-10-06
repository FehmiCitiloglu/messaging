"use client";

// Erişilebilir modal: Esc ile kapanır, arkaya odak tuzaklı, backdrop bulanıklı.

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/utils";
import { CloseIcon } from "@/components/ui/icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc ile kapat + fokus tuzağı + odak geri verme.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const t = window.setTimeout(
      () => panelRef.current?.querySelector<HTMLElement>("input, button")?.focus(),
      30,
    );
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(t);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className={cx(
        "fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:items-center",
      )}
      onMouseDown={onBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "w-full rounded-2xl border border-slate-200/80 bg-white shadow-pop animate-toast-in",
          "dark:border-slate-700/70 dark:bg-panel-dark",
          wide ? "max-w-lg" : "max-w-md",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-panelalt-dark dark:hover:text-slate-100"
          >
            <CloseIcon className="size-4.5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
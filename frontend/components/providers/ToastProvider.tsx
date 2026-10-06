"use client";

// Bildirimler (toast) + ekran okuyucu duyuru bölgesi (aria-live="polite").

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "@/lib/utils";
import { CloseIcon } from "@/components/ui/icons";

type ToastKind = "error" | "success" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  /** Ekran okuyuculara duyuru (yeni mesaj vb.). */
  announce: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "error") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const announce = useCallback((message: string) => {
    // Aynı metnin tekrarı duyurulsun diye önce boşla.
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(message), 30);
  }, []);

  const value = useMemo(() => ({ toast, announce }), [toast, announce]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Duyuru bölgesi */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
      {/* Toast yığını */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cx(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-pop backdrop-blur-xl animate-toast-in",
              "border text-sm",
              t.kind === "error" &&
                "border-red-200 bg-red-50/95 text-red-800 dark:border-red-900/60 dark:bg-red-950/90 dark:text-red-200",
              t.kind === "success" &&
                "border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/90 dark:text-emerald-200",
              t.kind === "info" &&
                "border-slate-200 bg-white/95 text-slate-800 dark:border-slate-700 dark:bg-panelalt-dark/95 dark:text-slate-100",
            )}
          >
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Bildirimi kapat"
              className="-m-1 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast, ToastProvider içinde kullanılmalıdır.");
  return ctx;
}
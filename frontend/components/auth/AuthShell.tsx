"use client";

// Giriş / kayıt ekranlarının ortak zarfı: marka, degrade fon, kart.

import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/icons";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden px-4 py-10 safe-top safe-bottom">
      {/* Dekoratif degrade lekeler */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-700/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -bottom-32 size-[26rem] rounded-full bg-fuchsia-300/25 blur-3xl dark:bg-fuchsia-900/20"
      />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-pop">
            <LogoMark className="size-6" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand-600 uppercase dark:text-brand-300">
              Vira
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="rounded-panel border border-slate-200/80 bg-white/85 p-6 shadow-soft backdrop-blur-xl dark:border-slate-700/60 dark:bg-panel-dark/85">
          {children}
        </div>

        <div className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          {footer}
        </div>
      </div>
    </main>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-slate-700 dark:bg-panelalt-dark dark:placeholder:text-slate-500";

export const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-150 hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";
"use client";

// 3 noktalı "yazıyor…" animasyonu.

export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-end gap-0.5 ${className}`} aria-hidden>
      <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:0ms]" />
      <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:160ms]" />
      <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:320ms]" />
    </span>
  );
}
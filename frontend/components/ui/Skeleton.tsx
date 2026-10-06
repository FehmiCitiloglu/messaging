"use client";

// Parıltılı iskelet blokları: konuşma listesi + mesaj akışı yüklenirken.

import { cx } from "@/lib/utils";

export function ConversationListSkeleton() {
  return (
    <ul className="flex flex-col gap-0.5 px-2" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl px-2.5 py-3">
          <span className="skeleton size-11 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={cx("skeleton h-3.5 rounded", i % 2 ? "w-2/5" : "w-3/5")} />
            <span className="skeleton h-3 w-4/5 rounded" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MessageStreamSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden p-5" aria-hidden>
      {[0, 1, 2, 3].map((i) => {
        const own = i % 2 === 1;
        return (
          <div key={i} className={cx("flex", own ? "justify-end" : "justify-start")}>
            <div
              className={cx(
                "skeleton h-12 rounded-2xl",
                own ? "w-52 rounded-br-md" : "w-64 rounded-bl-md",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

export function ButtonSpinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
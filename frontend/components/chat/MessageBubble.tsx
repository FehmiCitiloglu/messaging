"use client";

// Mesaj baloncuğu: gönderene göre gruplanmış, kendi mesajımız sağda (vurgu),
// diğerleri solda; saat bilgisi, iletim durumu ikonları (gönderiliyor →
// gönderildi → okundu) ve başarısız gönderimde yeniden dene düğmesi.

import { memo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  AlertIcon,
  CheckCheckIcon,
  CheckIcon,
  ClockIcon,
  RetryIcon,
} from "@/components/ui/icons";
import { formatClock } from "@/lib/format";
import { cx } from "@/lib/utils";
import type { LocalMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: LocalMessage;
  own: boolean;
  /** Grupta gönderen adı gösterilsin mi (ilk baloncuk). */
  showSenderName: boolean;
  senderName?: string;
  senderId: string;
  /** Grup içindeki sıra: yuvarlatma kuyrukları için. */
  groupPos: "single" | "first" | "middle" | "last";
  showAvatar: boolean;
  isLastInStream: boolean;
  onRetry: (message: LocalMessage) => void;
}

function StatusIcon({ message, onRetry }: { message: LocalMessage; onRetry: (m: LocalMessage) => void }) {
  if (message.status === "failed") {
    return (
      <span className="ml-1 inline-flex items-center gap-1 text-red-200">
        <AlertIcon className="size-3.5" aria-hidden />
        <span className="text-2xs">Gönderilemedi</span>
        <button
          type="button"
          onClick={() => onRetry(message)}
          aria-label="Mesajı yeniden gönder"
          title="Yeniden dene"
          className="rounded-md p-0.5 transition-colors hover:bg-white/20"
        >
          <RetryIcon className="size-3.5" />
        </button>
      </span>
    );
  }
  if (message.status === "sending") {
    return (
      <span title="gönderiliyor" className="ml-1 opacity-80">
        <ClockIcon className="size-3.5" aria-hidden />
        <span className="sr-only">gönderiliyor</span>
      </span>
    );
  }
  if (message.status === "read") {
    return (
      <span title="okundu" className="ml-1 text-sky-200">
        <CheckCheckIcon className="size-4" aria-hidden />
        <span className="sr-only">okundu</span>
      </span>
    );
  }
  return (
    <span title="gönderildi" className="ml-1 opacity-80">
      <CheckIcon className="size-3.5" aria-hidden />
      <span className="sr-only">gönderildi</span>
    </span>
  );
}

function BubbleImpl({
  message,
  own,
  showSenderName,
  senderName,
  senderId,
  groupPos,
  showAvatar,
  isLastInStream,
  onRetry,
}: MessageBubbleProps) {
  const rounded =
    own
      ? cx(
          "rounded-bubble bg-brand-600 text-white",
          groupPos === "single" && "rounded-br-md",
          groupPos === "first" && "rounded-br-md",
          groupPos === "middle" && "rounded-r-lg",
          groupPos === "last" && "rounded-r-lg",
        )
      : cx(
          "rounded-bubble bg-bubble-alt-light text-slate-900 dark:bg-bubble-alt-dark dark:text-slate-100",
          groupPos === "single" && "rounded-bl-md",
          groupPos === "first" && "rounded-bl-md",
          groupPos === "middle" && "rounded-l-lg",
          groupPos === "last" && "rounded-l-lg",
        );

  return (
    <div
      className={cx(
        "flex w-full items-end gap-2",
        own ? "justify-end pl-10" : "justify-start pr-10",
        isLastInStream ? "pb-1" : "",
      )}
    >
      {/* Karşı tarafın avatarı (yalnızca grubun son baloncuğunda) */}
      {!own ? (
        <span className="w-7 shrink-0 self-end">
          {showAvatar ? (
            <Avatar id={senderId} name={senderName ?? "?"} size="xs" />
          ) : null}
        </span>
      ) : null}

      <div className={cx("max-w-[min(78%,34rem)] min-w-0", own ? "items-end" : "items-start")}>
        {!own && showSenderName && senderName ? (
          <p className="mb-0.5 ml-1 text-2xs font-semibold text-brand-600 dark:text-brand-300">
            {senderName}
          </p>
        ) : null}
        <div
          className={cx(
            "px-3.5 py-2 shadow-soft transition-shadow duration-150",
            rounded,
          )}
        >
          <p className="text-base leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
          </p>
          <div
            className={cx(
              "mt-0.5 flex items-center justify-end gap-0.5 text-2xs tabular-nums",
              own ? "text-white/85" : "text-slate-500 dark:text-slate-400",
            )}
          >
            <time dateTime={message.createdAt}>{formatClock(new Date(message.createdAt))}</time>
            {own ? <StatusIcon message={message} onRetry={onRetry} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MessageBubble = memo(BubbleImpl);
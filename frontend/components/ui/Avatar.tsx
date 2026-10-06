"use client";

// Deterministik kimlik görseli: avatarUrl varsa resim, yoksa kimlikten
// türetilen tonlu zemin üzerinde baş harfler. presence noktası isteğe bağlı.

import { cx, hueFromId, initialsOf } from "@/lib/utils";
import type { Presence } from "@/lib/types";

interface AvatarProps {
  id: string;
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  presence?: Presence | null;
  className?: string;
}

const SIZES = {
  xs: "size-7 text-2xs",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-16 text-lg",
} as const;

export function Avatar({ id, name, avatarUrl, size = "md", presence, className }: AvatarProps) {
  const hue = hueFromId(id);
  return (
    <span className={cx("relative inline-flex shrink-0", className)}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- backend'in verdiği uzak avatarlar
        <img
          src={avatarUrl}
          alt=""
          className={cx(
            "rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10",
            SIZES[size],
          )}
        />
      ) : (
        <span
          aria-hidden
          className={cx(
            "inline-flex items-center justify-center rounded-full font-semibold ring-1 ring-black/5 dark:ring-white/10",
            SIZES[size],
          )}
          style={{
            backgroundColor: `hsl(${hue} 70% 93%)`,
            color: `hsl(${hue} 72% 28%)`,
          }}
        >
          {/* Dark modda da okunur kalsın diye renk hafifçe aydınlatılır */}
          <span
            className="dark:hidden"
            style={{ color: `hsl(${hue} 72% 28%)` }}
          >
            {initialsOf(name)}
          </span>
          <span
            className="hidden dark:inline"
            style={{ color: `hsl(${hue} 75% 78%)` }}
          >
            {initialsOf(name)}
          </span>
        </span>
      )}
      {presence ? <PresenceDot presence={presence} /> : null}
    </span>
  );
}

export function PresenceDot({ presence }: { presence: Presence }) {
  return (
    <span
      aria-hidden
      className={cx(
        "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-white dark:ring-panel-dark",
        presence === "online" ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600",
      )}
      title={presence === "online" ? "çevrimiçi" : "çevrimdışı"}
    />
  );
}
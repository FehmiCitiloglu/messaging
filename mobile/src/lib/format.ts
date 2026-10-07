// Türkçe yerelleştirilmiş tarih/saat biçimleri.
// (frontend/lib/format.ts ile birebir aynıdır.)

const LOCALE = "tr-TR";

const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});
const dayDividerFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  weekday: "long",
});
const dayDividerYearFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatClock(d: Date): string {
  return timeFmt.format(d);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Konuşma listesi için göreli zaman:
 * "az önce" | "5 dk önce" | "14:32" (bugün) | "Dün" | "3 gün önce" | "12.05.2025"
 */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "az önce";

  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (dayDiff <= 0) {
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return `${mins} dk önce`;
    return formatClock(d); // bugün → saat
  }
  if (dayDiff === 1) return "Dün";
  if (dayDiff < 7) return `${dayDiff} gün önce`;
  return dateFmt.format(d);
}

/** Mesaj akışındaki gün ayırıcı: "Bugün" | "Dün" | "12 Mart Perşembe" | "12 Mart 2025" */
export function formatDayDivider(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (dayDiff <= 0) return "Bugün";
  if (dayDiff === 1) return "Dün";
  return d.getFullYear() === now.getFullYear()
    ? dayDividerFmt.format(d)
    : dayDividerYearFmt.format(d);
}

/** Aynı gün mü? (gün ayırıcı ve gruplama için) */
export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** "son görülme 12 dk önce" satırı için göreli zaman. */
export function formatLastSeen(iso: string | null | undefined): string {
  return formatRelative(iso);
}

/** Ayarlar ekranı: "12 Mart 2025 tarihinde katıldı" */
export function formatJoined(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${dayDividerYearFmt.format(d)} tarihinde katıldı`;
}
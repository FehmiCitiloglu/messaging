// Küçük yardımcılar: sınıf birleştirme, kimlik üretimi, deterministik avatar.
// (frontend/lib/utils.ts ile aynı davranış; RN tarafında crypto.randomUUID
// bulunmayabileceğinden UUID üretimi yola dayanıklıdır.)

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Optimistik baloncuklar için istemci tarafı UUID (sözleşme: UUID kalıbı zorunlu). */
export function newClientId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // UUID v4 kalıbında üretim (React Native / eski ortamlar).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Deterministik renk tonu: kullanıcı kimliğinden 0-360 arası hue. */
export function hueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** Ad-soyad baş harfleri (Türkçe büyük harf kurallarıyla). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  return (
    words[0][0] + words[words.length - 1][0]
  ).toLocaleUpperCase("tr-TR");
}

/** Metni önizleme için kısaltır. */
export function truncate(text: string, max = 42): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
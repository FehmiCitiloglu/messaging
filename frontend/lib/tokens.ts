// Kimlik bilgisi saklama katmanı.
//
// STRATEJİ / TİCARET (tradeoff):
// - Access token yalnızca BELLEKTE (modül singleton) tutulur — XSS erişim yüzeyi
//   minimumda kalır ve sayfa yenilendiğinde kaybolur.
// - Refresh token localStorage'da tutulur ki sayfa yenilenince oturum geri
//   yüklenebilsin (POST /api/auth/refresh ile yeni access token alınır).
//   Bu proje için kabul edilen ticaret: refresh token'a JS erişebilir; production
//   bir sistemde HttpOnly + Secure + SameSite çerez veya token bağlama önerilir.
// - Ayrıca `ah` (auth hint) adında İÇERMEYEN bir işaret çerezi tutulur; amacı
//   yalnızca proxy.ts'in iyimser yönlendirmeleri içindir, yetki kaynağı değildir.

const REFRESH_KEY = "messaging.refreshToken";
const HINT_COOKIE = "ah";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(REFRESH_KEY, token);
    else window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* private mod vb. */
  }
  setAuthHint(Boolean(token));
}

/** Oturum açık/kapalı bilgisini proxy'ye ileten işaret çerezi. */
function setAuthHint(present: boolean): void {
  if (typeof document === "undefined") return;
  if (present) {
    document.cookie = `${HINT_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  } else {
    document.cookie = `${HINT_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
}

/** Giriş/kayıt/refresh sonrası tüm kimlik bilgilerini birlikte günceller. */
export function persistSession(access: string, refresh: string): void {
  setAccessToken(access);
  setRefreshToken(refresh);
}

export function clearSession(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

export function hasStoredSession(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}
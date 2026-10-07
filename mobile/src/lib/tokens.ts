// Kimlik bilgisi saklama katmanı (React Native).
//
// STRATEJİ / TİCARET (web frontend ile aynı):
// - Access token yalnızca BELLEKTE (modül singleton) tutulur.
// - Refresh token AsyncStorage'da tutulur ki uygulama yeniden açılınca oturum
//   geri yüklenebilsin (POST /api/auth/refresh ile yeni access token alınır).
//   NOT: AsyncStorage şifrelenmez; production bir sistemde expo-secure-store
//   (Keychain/Keystore) önerilir.
// - Web'in aksine depolama ASYNCHRON'dur: bloklamayan tek seferlik
//   `hydrateTokens()` çağrısı bellekteki önbelleği doldurur; kalan kod
//   (api.ts) web ile birebir aynı senkron arayüzü kullanır.

import AsyncStorage from "@react-native-async-storage/async-storage";

const REFRESH_KEY = "messaging.refreshToken";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let hydrated = false;

/** Uygulama açılışında bir kez çağrılır; refresh token'ı belleğe yükler. */
export async function hydrateTokens(): Promise<void> {
  if (hydrated) return;
  try {
    refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  } catch {
    refreshToken = null;
  }
  hydrated = true;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setRefreshToken(token: string | null): void {
  refreshToken = token;
  // Yazma işlemini bekletmeden sürdür (fire-and-forget).
  void (async () => {
    try {
      if (token) await AsyncStorage.setItem(REFRESH_KEY, token);
      else await AsyncStorage.removeItem(REFRESH_KEY);
    } catch {
      /* depolama hatası sessiz geçilir */
    }
  })();
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
  return Boolean(accessToken || refreshToken);
}
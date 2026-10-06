"use client";

// Oturum yönetimi: giriş / kayıt / çıkış + sayfa yenilenince oturum geri yükleme.
// Token saklama stratejisi için bkz. lib/tokens.ts.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, onSessionExpired, refreshSession } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { clearSession, hasStoredSession, persistSession } from "@/lib/tokens";
import type { User } from "@/lib/types";

export type AuthStatus = "loading" | "authed" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (input: { username: string; password: string }) => Promise<User>;
  register: (input: {
    username: string;
    displayName: string;
    password: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  // Oturum geri yükleme: refresh token varsa tazele, /users/me ile doğrula.
  // NOT: StrictMode (dev) bu effect'i iki kez çalıştırır; eski "tek-sefer ref +
  // iptal bayrağı" deseninde ilk koşunun cleanup'ı iptal ediyor, ikinci koşu
  // ref gardına takılıp hiç başlamıyordu → ekran sonsuza dek "Oturumun
  // doğrulanıyor…" altında kalırdı (refreshSession çağrılır, api.me asla
  // çağrılmazdı). Burada iptal/tek-sefer ref KULLANILMAZ: refreshSession()
  // kendi kilidiyle eşzamanlı çağrıları tek promise'e indirger; iki koşu aynı
  // değeri yazar. React 18+ mount edilmeyen bileşende setState'i sessizce yutar.
  useEffect(() => {
    void (async () => {
      if (!hasStoredSession()) {
        setStatus("guest");
        return;
      }
      const ok = await refreshSession();
      if (!ok) {
        clearSession();
        setStatus("guest");
        return;
      }
      try {
        const { user: me } = await api.me();
        setUser(me);
        setStatus("authed");
        connectSocket();
      } catch {
        clearSession();
        setStatus("guest");
      }
    })();
  }, []);

  // Sunucudan oturum sonu (refresh tükendi) → temiz çıkış.
  useEffect(
    () =>
      onSessionExpired(() => {
        disconnectSocket();
        setUser(null);
        setStatus("guest");
      }),
    [],
  );

  const login = useCallback(
    async (input: { username: string; password: string }) => {
      const res = await api.login(input);
      persistSession(res.accessToken, res.refreshToken);
      setUser(res.user);
      setStatus("authed");
      connectSocket();
      return res.user;
    },
    [],
  );

  const register = useCallback(
    async (input: { username: string; displayName: string; password: string }) => {
      const res = await api.register(input);
      persistSession(res.accessToken, res.refreshToken);
      setUser(res.user);
      setStatus("authed");
      connectSocket();
      return res.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.logout(); // refresh token'ı sunucuda iptal et (204)
    disconnectSocket();
    clearSession();
    setUser(null);
    setStatus("guest");
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout, setUser }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  return ctx;
}
// REST istemcisi — http://localhost:3001/api (sözleşme ile birebir).
//
// 401 geldiğinde POST /api/auth/refresh ile TEK seferlik yenileme yapılır;
// eşzamanlı istekler tek bir refresh promise'i arkasına kuyruğa girer.
// Yenileme başarısızsa oturum temizlenir ve `onSessionExpired` dinleyicisi
// (AuthProvider) /login'e temiz yönlendirmeyi tetikler.

import { API_URL } from "./env";
import {
  ApiError,
  parseErrorBody,
  type ErrorCode,
} from "./errors";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  persistSession,
} from "./tokens";
import type {
  AuthResponse,
  Conversation,
  ConversationResponse,
  ConversationsResponse,
  MeResponse,
  Message,
  MessagesResponse,
  RefreshResponse,
  UsersResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Oturum bitişini dinleyenler (AuthProvider tarafından kaydedilir).
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function emitSessionExpired(): void {
  clearSession();
  sessionExpiredListeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------
// Refresh kilidi: aynı anda tek refresh çağrısı yapılır.

let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as RefreshResponse;
      persistSession(data.accessToken, data.refreshToken); // refresh token rotasyonu
      return true;
    } catch {
      return false;
    } finally {
      // Sonraki refresh denemesi yeni promise alsın.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

// ---------------------------------------------------------------------------
// Çekirdek istek fonksiyonu

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  /** 401 sonrası refresh denenmesin (login/register/refresh uçlarında kapalı). */
  noRefresh?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, noRefresh = false, signal } = options;

  const doFetch = (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = getAccessToken();
    if (auth && token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("NETWORK");
  }

  // Access token geçersiz → tek seferlik refresh + kuyruktaki isteği tekrarla.
  if (res.status === 401 && auth && !noRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      try {
        res = await doFetch();
      } catch {
        throw new ApiError("NETWORK");
      }
    } else {
      emitSessionExpired();
      throw new ApiError("TOKEN_EXPIRED");
    }
  }

  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const { code, message } = parseErrorBody(payload, res.status);
    throw new ApiError(code as ErrorCode, message, res.status);
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// Sözleşme uçları — istek/yanıt şekilleri birebir.

export const api = {
  // ---- Auth ----
  register(input: {
    username: string;
    displayName: string;
    password: string;
  }): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: input,
      auth: false,
      noRefresh: true,
    });
  },

  login(input: { username: string; password: string }): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: input,
      auth: false,
      noRefresh: true,
    });
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await request<void>("/api/auth/logout", {
          method: "POST",
          body: { refreshToken },
          noRefresh: true,
        });
      }
    } catch {
      // Ağ hatası olsa bile yerel oturumu temizle.
    }
  },

  // ---- Kullanıcılar ----
  me(signal?: AbortSignal): Promise<MeResponse> {
    return request<MeResponse>("/api/users/me", { signal });
  },

  searchUsers(q: string, signal?: AbortSignal): Promise<UsersResponse> {
    const qs = encodeURIComponent(q);
    return request<UsersResponse>(`/api/users?q=${qs}`, { signal });
  },

  // ---- Konuşmalar ----
  conversations(signal?: AbortSignal): Promise<ConversationsResponse> {
    return request<ConversationsResponse>("/api/conversations", { signal });
  },

  createConversation(input: {
    type: "direct" | "group";
    participantIds: string[];
    title?: string;
  }): Promise<ConversationResponse> {
    return request<ConversationResponse>("/api/conversations", {
      method: "POST",
      body: input,
    });
  },

  // GET /api/conversations/:id/messages?before=<messageId>&limit=50
  // Yanıt: NEWEST-first (azalan) dizi + hasMore.
  messages(
    conversationId: string,
    opts: { before?: string; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<MessagesResponse> {
    const params = new URLSearchParams();
    if (opts.before) params.set("before", opts.before);
    params.set("limit", String(opts.limit ?? 50));
    return request<MessagesResponse>(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`,
      { signal },
    );
  },
};

export type { Conversation, Message };
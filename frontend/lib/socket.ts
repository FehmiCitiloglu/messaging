// Socket.IO istemcisi — sözleşme olayları birebir.
//
// Bağlantı auth: { token: accessToken }. Access token bellekte tutulduğundan
// sayfa yenilenmesi sonrası bağlantı, oturum geri yüklendikten sonra kurulur.
// connect_error (ör. TOKEN_EXPIRED) durumunda bir kez refresh denenir ve soket
// yeni token ile yeniden bağlanır; sonuç alınamazsa oturum sona erdirilir.

import { io, type Socket } from "socket.io-client";
import { refreshSession } from "./api";
import { SOCKET_URL } from "./env";
import { getAccessToken, getRefreshToken } from "./tokens";
import type {
  PresenceUpdate,
  ReadReceipt,
  SendMessageAck,
  SendMessagePayload,
  TypingUpdate,
  Message,
} from "./types";

export interface SocketEventMap {
  "message:new": (message: Message) => void;
  "message:read": (receipt: ReadReceipt) => void;
  "typing:update": (update: TypingUpdate) => void;
  "presence:update": (update: PresenceUpdate) => void;
}

let socket: Socket | null = null;
let refreshing = false;

export function getSocket(): Socket | null {
  return socket;
}

/** Uygulama oturum açtığında çağrılır; mevcutsa aynı soketi döner. */
export function connectSocket(): Socket | null {
  if (typeof window === "undefined") return null;

  // Mevcut soket ASLA öldürülmez/yeniden yaratılmaz (idempotent). Önceki
  // desen ("henüz bağlı değilse disconnect edip yenisini aç") el sıkışma
  // sürerken yapılan ikinci çağrıda dinleyicileri ÖLÜ bir sokete bağlayıp
  // yenisini açıyordu: ChatStore'un message:new/typing/presence dinleyicileri
  // böylece canlı olayları hiç almazdı (StrictMode çift effect ve
  // AuthProvider↔ChatStore efekt yarışı bu pencereyi sürekli açık tutuyordu).
  // Socket.IO kendi yeniden bağlanmasını yönetir; soket nesnesi oturum boyunca
  // tektir. Oturum kapanışında disconnectSocket() sıfırlar.
  if (socket) return socket;

  const token = getAccessToken() || getRefreshToken();
  if (!token) return null;

  socket = io(SOCKET_URL, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: { token: getAccessToken() ?? token },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect_error", (err: Error & { message?: string }) => {
    const msg = (err?.message ?? "").toUpperCase();
    if ((msg.includes("TOKEN_EXPIRED") || msg.includes("UNAUTHORIZED")) && !refreshing) {
      refreshing = true;
      void refreshSession().then((ok) => {
        refreshing = false;
        if (!socket) return;
        if (ok) {
          socket.auth = { token: getAccessToken() };
          socket.connect();
        } else {
          // Refresh de tükendi: soket kapansın, AuthProvider yönlendirmeyi yapar.
          socket.disconnect();
        }
      });
    }
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

// ---- Sözleşme olayları için ince sarmalayıcılar ----

export function sendMessage(
  payload: SendMessagePayload,
  ack: (response: SendMessageAck) => void,
): boolean {
  const s = socket;
  if (!s || !s.connected) return false;
  s.emit("message:send", payload, (response: SendMessageAck) => ack(response));
  return true;
}

export function emitRead(conversationId: string, messageId: string): void {
  socket?.emit("message:read", { conversationId, messageId });
}

export function emitTypingStart(conversationId: string): void {
  socket?.emit("typing:start", { conversationId });
}

export function emitTypingStop(conversationId: string): void {
  socket?.emit("typing:stop", { conversationId });
}

export function subscribe<K extends keyof SocketEventMap>(
  event: K,
  handler: SocketEventMap[K],
): () => void {
  const s = socket;
  if (!s) return () => {};
  // Sözleşme: "message:new" yükü { message: Message } sarmalıdır (backend
  // io.to(...).emit("message:new", { message })). Esneklik için çıplak Message
  // da kabul edilir; sarmal burada çözülür ki tüm dinleyiciler çıplak mesaj
  // alsın. Diğer sözleşme olayları çıplak yük gelir.
  const listener =
    event === "message:new"
      ? (raw: unknown) => {
          const payload = raw as ({ message?: Message } & Record<string, unknown>) | Message | null;
          const message = (
            payload && typeof payload === "object" && "message" in payload
              ? (payload as { message: Message }).message
              : payload
          ) as Message;
          (handler as (m: Message) => void)(message);
        }
      : handler;
  // Genel tip yardımcıları yerine sözleşme olaylarını elle eşliyoruz; `never`
  // dönüşümü, esnek DefaultEventsMap imzasıyla köprü görevi görür.
  s.on(event, listener as never);
  return () => {
    s.off(event, listener as never);
  };
}
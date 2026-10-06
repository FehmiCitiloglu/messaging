// Sözleşmedeki (API contract) varlıklar — alan adları birebir korunur.

export type Presence = "online" | "offline";

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  presence: Presence;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface ParticipantSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  presence: Presence;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  clientId: string;
  content: string;
  type: "text";
  createdAt: string;
  editedAt: string | null;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  title: string | null;
  participants: ParticipantSummary[];
  lastMessage: Message | null;
  unreadCount: number;
  createdAt: string;
}

// ---- REST yanıtları ----

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MeResponse {
  user: User;
}

export interface UsersResponse {
  users: User[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface ConversationResponse {
  conversation: Conversation;
}

export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

// ---- Socket.IO ----

export interface SendMessagePayload {
  conversationId: string;
  clientId: string;
  content: string;
  type: "text";
}

export interface SendMessageAck {
  ok: boolean;
  message?: Message;
  error?: { code: string; message: string };
}

export interface ReadReceipt {
  conversationId: string;
  readerId: string;
  messageId: string;
  readAt: string;
}

export interface TypingUpdate {
  conversationId: string;
  userId: string;
  typing: boolean;
}

export interface PresenceUpdate {
  userId: string;
  presence: Presence;
  lastSeenAt: string | null;
}

// Yerel (optimistik) mesaj durumu: clock → check → check-check
export type DeliveryStatus = "sending" | "sent" | "read" | "failed";

export interface LocalMessage extends Message {
  /** Optimistik baloncuk durumu (yalnızca kendi mesajlarımızda kullanılır). */
  status?: DeliveryStatus;
  /** Gönderim hatası durumunda hata kodu (yeniden deneme ekranı için). */
  errorCode?: string;
}
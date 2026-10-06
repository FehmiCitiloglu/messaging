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

export type UserLite = Pick<
  User,
  "id" | "username" | "displayName" | "avatarUrl" | "presence"
>;

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

export type DeliveryStatus = "sent" | "delivered" | "read";

export interface MessageWithStatus extends Message {
  deliveryStatus: DeliveryStatus;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  title: string | null;
  participants: UserLite[];
  lastMessage: Message | null;
  unreadCount: number;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
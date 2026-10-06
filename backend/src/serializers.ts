import { presenceOf } from "./presence.js";
import type {
  Conversation,
  DeliveryStatus,
  Message,
  MessageWithStatus,
  User,
  UserLite,
} from "./types.js";
import type { MessageRow, UserRow } from "./db.js";

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    presence: presenceOf(row.id),
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

export function toUserLite(row: UserRow): UserLite {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    presence: presenceOf(row.id),
  };
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    clientId: row.client_id,
    content: row.content,
    type: "text",
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

export function toMessageWithStatus(
  row: MessageRow,
  deliveryStatus: DeliveryStatus,
): MessageWithStatus {
  return { ...toMessage(row), deliveryStatus };
}

export interface ConversationParts {
  id: string;
  type: string;
  title: string | null;
  createdAt: string;
  participants: UserLite[];
  lastMessage: Message | null;
  unreadCount: number;
}

export function toConversation(parts: ConversationParts): Conversation {
  return {
    id: parts.id,
    type: parts.type === "group" ? "group" : "direct",
    title: parts.title,
    participants: parts.participants,
    lastMessage: parts.lastMessage,
    unreadCount: parts.unreadCount,
    createdAt: parts.createdAt,
  };
}
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { Statement } from "better-sqlite3";
import { config } from "./config.js";

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db: Database.Database = new Database(config.databasePath);

// Embedded SQLite tuned for a write-light chat workload:
// WAL keeps readers non-blocking; synchronous=NORMAL is durable-enough with WAL.
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

/** Prepared-statement cache: each SQL string is prepared exactly once. */
const cache = new Map<string, Statement>();
export function sql(query: string): Statement {
  let stmt = cache.get(query);
  if (!stmt) {
    stmt = db.prepare(query);
    cache.set(query, stmt);
  }
  return stmt;
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  last_seen_at  TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_user   ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('direct','group')),
  title      TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  conversation_id     TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at           TEXT NOT NULL,
  last_read_message_id TEXT,
  last_read_at        TEXT,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id),
  client_id       TEXT NOT NULL,
  content         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'text',
  edited_at       TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv_id      ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_client ON messages(sender_id, client_id);

CREATE TABLE IF NOT EXISTS message_deliveries (
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);
`);

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_id: string;
  content: string;
  type: string;
  created_at: string;
  edited_at: string | null;
}

export interface ConversationRow {
  id: string;
  type: string;
  title: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Common queries
// ---------------------------------------------------------------------------

const USER_COLUMNS =
  "id, username, display_name, avatar_url, last_seen_at, created_at";
const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, client_id, content, type, created_at, edited_at";

export function findUserById(id: string): UserRow | undefined {
  return sql(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as
    | UserRow
    | undefined;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return sql(`SELECT ${USER_COLUMNS} FROM users WHERE username = ?`).get(
    username,
  ) as UserRow | undefined;
}

export function findUserCredentials(
  username: string,
): { id: string; password_hash: string } | undefined {
  return sql(`SELECT id, password_hash FROM users WHERE username = ?`).get(
    username,
  ) as { id: string; password_hash: string } | undefined;
}

export function conversationParticipantIds(conversationId: string): string[] {
  const rows = sql(
    `SELECT user_id FROM participants WHERE conversation_id = ?`,
  ).all(conversationId) as Array<{ user_id: string }>;
  return rows.map((r) => r.user_id);
}

export function isParticipant(conversationId: string, userId: string): boolean {
  const row = sql(
    `SELECT 1 AS ok FROM participants WHERE conversation_id = ? AND user_id = ?`,
  ).get(conversationId, userId) as { ok: number } | undefined;
  return row !== undefined;
}

export function conversationExists(conversationId: string): boolean {
  const row = sql(`SELECT 1 AS ok FROM conversations WHERE id = ?`).get(
    conversationId,
  ) as { ok: number } | undefined;
  return row !== undefined;
}

export function findMessageById(messageId: string): MessageRow | undefined {
  return sql(
    `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`,
  ).get(messageId) as MessageRow | undefined;
}

export function userConversationIds(userId: string): string[] {
  const rows = sql(
    `SELECT conversation_id FROM participants WHERE user_id = ?`,
  ).all(userId) as Array<{ conversation_id: string }>;
  return rows.map((r) => r.conversation_id);
}

export function touchLastSeen(userId: string, at: string): void {
  sql(`UPDATE users SET last_seen_at = ? WHERE id = ?`).run(at, userId);
}

export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}
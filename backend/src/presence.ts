import type { Presence } from "./types.js";

/**
 * In-memory presence registry: userId -> set of active socket ids.
 * A user is online while at least one socket is connected.
 */
const socketsByUser = new Map<string, Set<string>>();

export function socketConnected(userId: string, socketId: string): boolean {
  let set = socketsByUser.get(userId);
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  const becameOnline = set.size === 0;
  set.add(socketId);
  return becameOnline;
}

export function socketDisconnected(userId: string, socketId: string): boolean {
  const set = socketsByUser.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    socketsByUser.delete(userId);
    return true; // became offline
  }
  return false;
}

export function isOnline(userId: string): boolean {
  const set = socketsByUser.get(userId);
  return set !== undefined && set.size > 0;
}

export function presenceOf(userId: string): Presence {
  return isOnline(userId) ? "online" : "offline";
}

export function onlineUserIds(): IterableIterator<string> {
  return socketsByUser.keys();
}
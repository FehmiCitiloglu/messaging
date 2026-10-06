#!/usr/bin/env node
/**
 * Rerunnable end-to-end smoke test for the messaging backend contract.
 *
 * Prereqs: backend running on SMOKE_BASE_URL (default http://localhost:3001).
 * Run:     node scripts/smoke.mjs
 */
import { io as ioc } from "socket.io-client";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3001";
const TS = Date.now().toString(36);

const results = [];
let failures = 0;

function check(name, cond, detail = "") {
  results.push({ name, ok: Boolean(cond), detail });
  if (!cond) failures += 1;
  console.log(`[${cond ? "PASS" : "FAIL"}] ${name}${detail ? " :: " + detail : ""}`);
}

function uuid() {
  return crypto.randomUUID();
}

async function api(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 204 */
  }
  return { status: res.status, json };
}

function connect(auth) {
  return new Promise((resolve, reject) => {
    const s = ioc(BASE, { auth, transports: ["websocket"], forceNew: true });
    const t = setTimeout(
      () => reject(new Error("socket connect timeout")),
      5000,
    );
    s.on("connect", () => {
      clearTimeout(t);
      resolve(s);
    });
    s.on("connect_error", (e) => {
      clearTimeout(t);
      const err = new Error("connect_error: " + e.message);
      err.socket = s;
      reject(err);
    });
  });
}

function waitFor(socket, event, pred = null, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    function handler(payload) {
      try {
        if (!pred || pred(payload)) {
          clearTimeout(t);
          socket.off(event, handler);
          resolve(payload);
        }
      } catch (err) {
        clearTimeout(t);
        socket.off(event, handler);
        reject(err);
      }
    }
    socket.on(event, handler);
  });
}

function sendWithAck(socket, event, payload, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const t = setTimeout(
      () => resolve({ ok: false, error: { code: "TIMEOUT", message: "no ack" } }),
      timeoutMs,
    );
    socket.emit(event, payload, (res) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = Math.floor(Math.random() * 1e6).toString(36);
const nameOf = (letter) => `smk${TS}${rand}${letter}`.slice(0, 20);

async function main() {
  // 0. Health
  const health = await api("GET", "/");
  check("health endpoint", health.status === 200 && health.json?.status === "ok");

  // 1. Register three users
  const password = "Str0ngPass!w0rd";
  const users = {};
  for (const letter of ["a", "b", "c"]) {
    const username = nameOf(letter);
    const r = await api("POST", "/api/auth/register", {
      body: { username, displayName: `Smoke ${letter.toUpperCase()}`, password },
    });
    check(`register ${letter} -> 201 + tokens`, r.status === 201 && !!r.json?.user?.id && !!r.json?.accessToken && !!r.json?.refreshToken, `username=${username}`);
    users[letter] = {
      username,
      password,
      id: r.json?.user?.id,
      accessToken: r.json?.accessToken,
      refreshToken: r.json?.refreshToken,
    };
  }

  // 2. Duplicate username -> CONFLICT
  const dup = await api("POST", "/api/auth/register", {
    body: { username: users.a.username, displayName: "Dup", password },
  });
  check("duplicate register -> 409 CONFLICT", dup.status === 409 && dup.json?.error?.code === "CONFLICT");

  // 3. Invalid username -> VALIDATION_ERROR + unknown field rejection
  const badReg = await api("POST", "/api/auth/register", {
    body: { username: "BAD NAME!", displayName: "X", password, hacker: 1 },
  });
  check(
    "invalid register (bad username + unknown field) -> 400 VALIDATION_ERROR",
    badReg.status === 400 && badReg.json?.error?.code === "VALIDATION_ERROR",
    JSON.stringify(badReg.json?.error ?? {}),
  );

  // 4. Login
  const login = await api("POST", "/api/auth/login", {
    body: { username: users.a.username, password },
  });
  check("login -> 200 + tokens", login.status === 200 && !!login.json?.accessToken && !!login.json?.refreshToken);
  users.a.accessToken = login.json.accessToken;
  users.a.refreshToken = login.json.refreshToken;

  // 5. Protected route with / without token
  const me = await api("GET", "/api/users/me", { token: users.a.accessToken });
  check("GET /users/me authorized -> 200", me.status === 200 && me.json?.user?.username === users.a.username);
  const meAnon = await api("GET", "/api/users/me");
  check("GET /users/me anonymous -> 401 UNAUTHORIZED", meAnon.status === 401 && meAnon.json?.error?.code === "UNAUTHORIZED");

  // 6. Refresh rotation + reuse detection
  const oldRefresh = users.a.refreshToken;
  const rot = await api("POST", "/api/auth/refresh", { body: { refreshToken: oldRefresh } });
  check("refresh rotates -> 200 + NEW refresh token", rot.status === 200 && rot.json?.refreshToken && rot.json.refreshToken !== oldRefresh, `new refresh differs: ${rot.json?.refreshToken !== oldRefresh}`);
  const reuse = await api("POST", "/api/auth/refresh", { body: { refreshToken: oldRefresh } });
  check("refresh reuse of old token -> 401 (family revoked)", reuse.status === 401 && reuse.json?.error?.code === "UNAUTHORIZED", reuse.json?.error?.message ?? "");
  const afterReuse = await api("POST", "/api/auth/refresh", { body: { refreshToken: rot.json.refreshToken } });
  check("rotated token also revoked after reuse detection -> 401", afterReuse.status === 401, afterReuse.json?.error?.message ?? "");

  // Re-login for a healthy session
  const login2 = await api("POST", "/api/auth/login", {
    body: { username: users.a.username, password },
  });
  users.a.accessToken = login2.json.accessToken;
  users.a.refreshToken = login2.json.refreshToken;
  check("re-login -> 200", login2.status === 200 && !!users.a.accessToken);

  // 7. User search
  const search = await api("GET", `/api/users?q=${TS}${rand}`, { token: users.a.accessToken });
  const foundIds = (search.json?.users ?? []).map((u) => u.id);
  check(
    "GET /users search finds others, excludes self",
    search.status === 200 && foundIds.includes(users.b.id) && foundIds.includes(users.c.id) && !foundIds.includes(users.a.id),
    `found=${foundIds.length}`,
  );

  // 8. Sockets: authorized connects + rejected bad token
  const s1 = await connect({ token: users.a.accessToken });
  const s2 = await connect({ token: users.b.accessToken });
  const s3 = await connect({ token: users.c.accessToken });
  check("3 authorized sockets connected", s1.connected && s2.connected && s3.connected);
  let badConnectMsg = "";
  try {
    await connect({ token: "garbage.token.here" });
  } catch (err) {
    badConnectMsg = err.message;
  }
  check("socket with garbage token -> connect_error UNAUTHORIZED", badConnectMsg.includes("UNAUTHORIZED"), badConnectMsg);

  // 9. Create direct conversation (after sockets are live -> exercises socketsJoin path)
  const convRes = await api("POST", "/api/conversations", {
    token: users.a.accessToken,
    body: { type: "direct", participantIds: [users.b.id] },
  });
  const conv = convRes.json?.conversation;
  check("POST /conversations direct -> 201", convRes.status === 201 && conv?.id && conv?.participants?.length === 2, `conv=${conv?.id}`);
  const convAgain = await api("POST", "/api/conversations", {
    token: users.a.accessToken,
    body: { type: "direct", participantIds: [users.b.id] },
  });
  check("creating same direct conversation returns EXISTING one", convAgain.status === 201 && convAgain.json?.conversation?.id === conv.id, `same id: ${convAgain.json?.conversation?.id === conv.id}`);

  const convList = await api("GET", "/api/conversations", { token: users.a.accessToken });
  const listItem = (convList.json?.conversations ?? []).find((c) => c.id === conv.id);
  check("GET /conversations contains it (participants+lastMessage+unreadCount)", convList.status === 200 && !!listItem && Array.isArray(listItem.participants) && listItem.lastMessage === null && listItem.unreadCount === 0);

  // 10. Typing relay (excluding sender)
  const typingP = waitFor(s2, "typing:update", (p) => p.userId === users.a.id && p.conversationId === conv.id);
  s1.emit("typing:start", { conversationId: conv.id });
  const typing = await typingP;
  check("typing:update relayed to peer", typing.typing === true, JSON.stringify(typing));

  // 11. MESSAGE ROUND TRIP: send -> ack + message:new on BOTH sides
  const clientId = uuid();
  const recv1P = waitFor(s1, "message:new", (p) => p.message?.clientId === clientId);
  const recv2P = waitFor(s2, "message:new", (p) => p.message?.clientId === clientId);
  const ackP = sendWithAck(s1, "message:send", {
    conversationId: conv.id,
    clientId,
    content: "merhaba dunya — smoke test mesaji",
    type: "text",
  });
  const [ack, recv1, recv2] = await Promise.all([ackP, recv1P, recv2P]);
  const msgId = ack?.message?.id;
  check("message:send ack -> {ok:true, message}", ack?.ok === true && !!msgId && ack.message.clientId === clientId, `ack.id=${msgId}`);
  check("message:new received by SENDER (clientId echo)", recv1?.message?.id === msgId && recv1.message.clientId === clientId, `recv1.id=${recv1?.message?.id}`);
  check("message:new received by PEER", recv2?.message?.id === msgId && recv2.message.senderId === users.a.id, `recv2.id=${recv2?.message?.id}`);
  console.log(`[roundtrip] ACK   id=${ack.message.id} clientId=${ack.message.clientId} content="${ack.message.content}"`);
  console.log(`[roundtrip] SAW   sender-socket message:new id=${recv1.message.id} | peer-socket message:new id=${recv2.message.id}`);

  // 12. Read receipt broadcast
  const read1P = waitFor(s1, "message:read", (p) => p.readerId === users.b.id && p.messageId === msgId);
  const read2P = waitFor(s2, "message:read", (p) => p.readerId === users.b.id && p.messageId === msgId);
  s2.emit("message:read", { conversationId: conv.id, messageId: msgId });
  const [rd1, rd2] = await Promise.all([read1P, read2P]);
  check("message:read broadcast to room (both sides)", rd1.readAt === rd2.readAt && rd1.conversationId === conv.id, JSON.stringify(rd1));

  // 13. REST message fetch: shape + deliveryStatus + cursor pagination basics
  const hist = await api("GET", `/api/conversations/${conv.id}/messages`, { token: users.a.accessToken });
  const histMsg = (hist.json?.messages ?? [])[0];
  check("GET messages -> NEWEST-first with base fields", hist.status === 200 && histMsg?.id === msgId && histMsg?.clientId === clientId && histMsg?.type === "text" && "editedAt" in histMsg && typeof histMsg.deliveryStatus === "string" && hist.json.hasMore === false, `deliveryStatus=${histMsg?.deliveryStatus}`);
  check("deliveryStatus == 'read' after peer read receipt", histMsg?.deliveryStatus === "read", `got ${histMsg?.deliveryStatus}`);

  const convListB = await api("GET", "/api/conversations", { token: users.b.accessToken });
  const itemB = (convListB.json?.conversations ?? []).find((c) => c.id === conv.id);
  check("unreadCount for reader drops to 0", itemB?.unreadCount === 0, `unread=${itemB?.unreadCount}`);

  // 14. UNAUTHORIZED room access rejected (non-participant)
  const cMsgs = await api("GET", `/api/conversations/${conv.id}/messages`, { token: users.c.accessToken });
  check("non-participant REST fetch -> 403 FORBIDDEN", cMsgs.status === 403 && cMsgs.json?.error?.code === "FORBIDDEN");
  const joinAck = await sendWithAck(s3, "conversation:join", { conversationId: conv.id });
  check("non-participant conversation:join -> ack FORBIDDEN", joinAck.ok === false && joinAck.error?.code === "FORBIDDEN", JSON.stringify(joinAck));
  const evilClientId = uuid();
  const evilAck = await sendWithAck(s3, "message:send", {
    conversationId: conv.id, clientId: evilClientId, content: "intrusion", type: "text",
  });
  check("non-participant message:send -> ack FORBIDDEN", evilAck.ok === false && evilAck.error?.code === "FORBIDDEN", JSON.stringify(evilAck));

  // 15. Flood throttle + oversize/blank content validation
  let rateLimitedAcks = 0;
  const floodIds = [];
  for (let i = 0; i < 14; i++) {
    const res = await sendWithAck(s1, "message:send", {
      conversationId: conv.id, clientId: uuid(), content: `flood ${i}`, type: "text",
    });
    if (res.ok) floodIds.push(res.message.id);
    else if (res.error?.code === "RATE_LIMITED") rateLimitedAcks += 1;
  }
  check("message flood throttle kicks in (RATE_LIMITED acks)", rateLimitedAcks >= 1, `accepted=${floodIds.length} rejected=${rateLimitedAcks}`);
  const bigAck = await sendWithAck(s1, "message:send", {
    conversationId: conv.id, clientId: uuid(), content: "x".repeat(4001), type: "text",
  });
  check("message over 4000 chars -> ack VALIDATION_ERROR", bigAck.ok === false && bigAck.error?.code === "VALIDATION_ERROR", bigAck.error?.code ?? "");
  const blankAck = await sendWithAck(s1, "message:send", {
    conversationId: conv.id, clientId: uuid(), content: "     ", type: "text",
  });
  check("blank message -> ack VALIDATION_ERROR", blankAck.ok === false && blankAck.error?.code === "VALIDATION_ERROR", blankAck.error?.code ?? "");

  // 16. Cursor pagination (NEWEST-first, before=<messageId>)
  const page1 = await api("GET", `/api/conversations/${conv.id}/messages?limit=5`, { token: users.a.accessToken });
  const p1 = page1.json?.messages ?? [];
  check("messages?limit=5 -> 5 items + hasMore=true", page1.status === 200 && p1.length === 5 && page1.json.hasMore === true);
  let cursorOk = false;
  if (p1.length === 5) {
    const cursor = p1[4].id;
    const page2 = await api("GET", `/api/conversations/${conv.id}/messages?limit=5&before=${cursor}`, { token: users.a.accessToken });
    const p2 = page2.json?.messages ?? [];
    cursorOk = p2.length > 0 && p2.every((m) => m.id < cursor);
    check("cursor pagination before=<id> returns strictly older page", cursorOk, `page2=${p2.length} items, cursor=${cursor}`);
  }

  // 17. Unknown field on REST body rejected
  const junk = await api("POST", "/api/conversations", {
    token: users.a.accessToken,
    body: { type: "direct", participantIds: [users.b.id], evilExtraField: 1 },
  });
  check("unknown request field rejected -> 400 VALIDATION_ERROR", junk.status === 400 && junk.json?.error?.code === "VALIDATION_ERROR");

  // 18. Brute-force limiter on /api/auth/login (5/min per IP+username)
  let saw429 = false;
  let lastErr = "";
  for (let i = 0; i < 8; i++) {
    const r = await api("POST", "/api/auth/login", {
      body: { username: users.c.username, password: "definitely-wrong-password" },
    });
    if (r.status === 429 && r.json?.error?.code === "RATE_LIMITED") saw429 = true;
    else lastErr = `${r.status}:${r.json?.error?.code}`;
  }
  check("8 bad logins -> RATE_LIMITED 429 (5/min limiter)", saw429, `last non-429=${lastErr}`);

  // 19. Logout revokes refresh family
  const lo = await api("POST", "/api/auth/logout", { token: users.a.accessToken, body: { refreshToken: users.a.refreshToken } });
  const loRefresh = await api("POST", "/api/auth/refresh", { body: { refreshToken: users.a.refreshToken } });
  check("logout -> 204 and refresh token dead afterwards", lo.status === 204 && loRefresh.status === 401, `logout=${lo.status} refresh-after=${loRefresh.status}`);

  s1.disconnect();
  s2.disconnect();
  s3.disconnect();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nSMOKE RESULT: ${failures === 0 ? "PASS" : "FAIL"} (${passed}/${results.length} checks)`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[smoke] fatal:", err);
  process.exitCode = 1;
});
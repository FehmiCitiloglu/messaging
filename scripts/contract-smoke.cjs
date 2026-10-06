// Backend sözleşmesi uçtan uca duman testi (iki kullanıcı, REST + Socket.IO).
const BASE = "http://localhost:3001";
const { io } = require("/Users/alien/Development/messaging/frontend/node_modules/socket.io-client");

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
const log = (name, ok, extra) =>
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + JSON.stringify(extra).slice(0, 220) : ""}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const ts = Date.now();
  const a = await req("POST", "/api/auth/register", { username: `smokea${ts % 100000000}`, displayName: "Smoke A", password: "password123" });
  log("register A 201 + tokens", a.status === 201 && !!a.data?.accessToken && !!a.data?.refreshToken, { status: a.status });
  const b = await req("POST", "/api/auth/register", { username: `smokeb${ts % 100000000}`, displayName: "Smoke B", password: "password123" });
  log("register B 201", b.status === 201, { status: b.status, err: b.data });
  const tokA = a.data.accessToken, tokB = b.data.accessToken;

  const rf = await req("POST", "/api/auth/refresh", { refreshToken: a.data.refreshToken });
  log("refresh 200 + rotasyon", rf.status === 200 && !!rf.data?.accessToken && rf.data?.refreshToken !== a.data.refreshToken, { status: rf.status });

  const bad = await req("POST", "/api/auth/login", { username: a.data.user.username, password: "yanlisspace" });
  log("yanlış şifre hata kodu", bad.status === 401 || bad.status === 400, { status: bad.status, code: bad.data?.error?.code ?? bad.data?.code });

  const me = await req("GET", "/api/users/me", null, tokA);
  log("GET /api/users/me", me.status === 200 && me.data?.user?.username === a.data.user.username, { u: me.data?.user?.username });

  const su = await req("GET", `/api/users?q=${b.data.user.username}`, null, tokA);
  log("GET /api/users?q= B bulur, kendini hariç", su.status === 200 && su.data.users.some((u) => u.id === b.data.user.id) && !su.data.users.some((u) => u.id === a.data.user.id), { n: su.data?.users?.length });

  const cv = await req("POST", "/api/conversations", { type: "direct", participantIds: [b.data.user.id] }, tokA);
  log("POST /api/conversations 201", cv.status === 201 && !!cv.data?.conversation?.id, { status: cv.status });
  const convId = cv.data.conversation.id;

  const lc = await req("GET", "/api/conversations", null, tokB);
  const convB = (lc.data?.conversations ?? []).find((c) => c.id === convId);
  log("GET /api/conversations (B) + unreadCount", lc.status === 200 && !!convB && typeof convB.unreadCount === "number", { unread: convB?.unreadCount, last: !!convB });

  const mg = await req("GET", `/api/conversations/${convId}/messages?limit=50`, null, tokA);
  log("GET messages {messages,hasMore}", mg.status === 200 && Array.isArray(mg.data?.messages) && typeof mg.data?.hasMore === "boolean", { keys: Object.keys(mg.data || {}) });

  // ---- Socket.IO ----
  const sA = io(BASE, { auth: { token: tokA }, transports: ["websocket", "polling"] });
  const sB = io(BASE, { auth: { token: tokB }, transports: ["websocket", "polling"] });
  await Promise.all([
    new Promise((r) => sA.on("connect", r)),
    new Promise((r) => sB.on("connect", r)),
  ]);
  log("socket connect (auth token)", sA.connected && sB.connected);

  const events = { newA: null, readB: null, typingA: null, presenceB: null };
  sA.on("message:new", (m) => (events.newA = m && m.message ? m.message : m));
  sB.on("message:read", (r) => (events.readB = r));
  sA.on("typing:update", (u) => (events.typingA = u));
  sB.on("presence:update", (p) => (events.presenceB = p));

  sB.emit("typing:start", { conversationId: convId });
  const clientId = require("crypto").randomUUID();
  let ackRes = null;
  sB.emit("message:send", { conversationId: convId, clientId, content: "merhaba smoke", type: "text" }, (ack) => {
    ackRes = ack;
    log("message:send ack {ok,message}", !!(ack?.ok && ack?.message?.clientId === clientId && ack?.message?.content === "merhaba smoke"), { ok: ack?.ok, cid: ack?.message?.clientId, err: ack?.error });
    setTimeout(() => {
      if (ack?.message?.id) sA.emit("message:read", { conversationId: convId, messageId: ack.message.id });
    }, 250);
  });

  await wait(1500);
  log("message:new → A (dedupe clientId)", !!(events.newA && events.newA.clientId === clientId && events.newA.senderId === b.data.user.id), events.newA && { cid: events.newA.clientId });
  log("typing:update → A (typing:true)", !!(events.typingA && events.typingA.userId === b.data.user.id && events.typingA.typing === true), events.typingA);
  log("presence:update yayını", events.presenceB ? events.presenceB.presence !== undefined : "beklenmedi (yayın yoksa pas)", events.presenceB);
  log("message:read → B (readerId=A)", !!(events.readB && events.readB.readerId === a.data.user.id && events.readB.conversationId === convId), events.readB);

  sB.emit("typing:stop", { conversationId: convId });
  await wait(1200);
  log("typing:stop → typing:false", !!(events.typingA && events.typingA.typing === false), events.typingA);

  // Okunmamış sayaç B tarafında güncellenmeli
  const lc2 = await req("GET", "/api/conversations", null, tokA);
  const convA2 = (lc2.data?.conversations ?? []).find((c) => c.id === convId);
  log("unreadCount A'da (B'nin mesajı okunmuş)", convA2 ? convA2.unreadCount === 0 : false, { unread: convA2?.unreadCount });

  // Sayfalama: en yeni önce + before imleci (2 mesajla sıralama da doğrulanır)
  const clientId2 = require("crypto").randomUUID();
  await new Promise((r) => sB.emit("message:send", { conversationId: convId, clientId: clientId2, content: "ikinci mesaj", type: "text" }, r));
  await wait(300);
  const p1 = await req("GET", `/api/conversations/${convId}/messages?limit=1`, null, tokA);
  const arr = p1.data?.messages ?? [];
  log("limit=1 sayfalama (en yeni önce)", p1.status === 200 && arr.length === 1 && arr[0].content === "ikinci mesaj", { hasMore: p1.data?.hasMore, top: arr[0]?.content });
  if (arr.length === 1) {
    const older = await req("GET", `/api/conversations/${convId}/messages?before=${encodeURIComponent(arr[0].id)}&limit=1`, null, tokA);
    log("before= imleci ile eski mesajlar", older.status === 200 && older.data?.messages?.some((m) => m.content === "merhaba smoke"), { len: older.data?.messages?.length, hasMore: older.data?.hasMore });
  }

  const lo = await req("POST", "/api/auth/logout", { refreshToken: rf.data.refreshToken }, tokA);
  log("logout 204", lo.status === 204, { status: lo.status });

  sA.close(); sB.close();
  process.exit(0);
})().catch((e) => {
  console.error("SMOKE ERROR", e);
  process.exit(1);
});
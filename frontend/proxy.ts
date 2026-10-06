// Next.js 16: Middleware yeniden adlandırıldı → Proxy (proxy.ts).
// Buradaki kontrol İYİMSERDİR: gerçek yetki doğrulaması istemci tarafında
// (AuthProvider → GET /api/users/me) yapılır; bu katman yalnızca belirgin
// yanlış yönlendirmeleri engellemek içindir (bkz. lib/tokens.ts açıklamaları).

import { NextResponse, type NextRequest } from "next/server";

const HINT_COOKIE = "ah";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionHint = Boolean(request.cookies.get(HINT_COOKIE)?.value);

  const isProtected = pathname.startsWith("/chat");
  const isAuthScreen = pathname === "/login" || pathname === "/register";

  if (isProtected && !hasSessionHint) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  if (isAuthScreen && hasSessionHint) {
    const url = new URL("/chat", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/login", "/register"],
};
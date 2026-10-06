"use client";

// Üç bölmeli düzen: (1) ince gezinme rayı, (2) konuşma listesi, (3) mesaj alanı.
// Mobilde tek bölmeli akış: liste VEYA konuşma; yumuşak kayarak geçiş.
// Yetki koruması: AuthProvider "guest" ise /login'e temiz yönlendirme.

import { useEffect, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ChatStoreProvider, useChatStore } from "@/components/chat/ChatStore";
import { NavRail } from "@/components/chat/NavRail";
import { ConversationList } from "@/components/chat/ConversationList";
import { cx } from "@/lib/utils";

export function ChatShell({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();

  // İstemci koruması: oturum geri yükleme bitti ve kullanıcı misafir → /login.
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status === "guest") {
      router.replace(`/login`);
    }
  }, [status, router, pathname]);

  if (status === "loading" || !user) {
    return (
      <main className="flex flex-1 items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-4">
          <span className="size-10 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Oturumun doğrulanıyor…
          </p>
        </div>
      </main>
    );
  }

  return (
    <ChatStoreProvider meId={user.id}>
      <ChatLayout meName={user.displayName} meUsername={user.username} meId={user.id}>
        {children}
      </ChatLayout>
    </ChatStoreProvider>
  );
}

function ChatLayout({
  children,
  meName,
  meUsername,
  meId,
}: {
  children: ReactNode;
  meName: string;
  meUsername: string;
  meId: string;
}) {
  const pathname = usePathname();
  const { setActiveConversationId } = useChatStore();

  // Aktif konuşmayı yola (URL) göre belirle: /chat/<id>
  const selectedId = useMemo(() => {
    const match = pathname.match(/^\/chat\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  useEffect(() => {
    setActiveConversationId(selectedId);
  }, [selectedId, setActiveConversationId]);

  const selected = Boolean(selectedId);

  return (
    <main className="flex h-dvh flex-1 overflow-hidden bg-canvas-light dark:bg-canvas-dark">
      <NavRail meName={meName} meUsername={meUsername} meId={meId} />
      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        {/* Konuşma listesi — mobilde tam genişlik, seçimde sola kayar */}
        <aside
          aria-label="Konuşmalar"
          className={cx(
            "absolute inset-y-0 left-0 z-10 flex w-full min-w-0 flex-col border-slate-200/80 bg-panel-light transition-transform duration-200 ease-out-soft dark:border-slate-800 dark:bg-panel-dark",
            "md:static md:z-auto md:w-88 md:shrink-0 md:border-r lg:w-96",
            selected
              ? "-translate-x-full md:translate-x-0"
              : "translate-x-0",
            selected ? "pointer-events-none md:pointer-events-auto" : "",
          )}
        >
          <ConversationList />
        </aside>

        {/* Mesaj alanı — mobilde sağdan kayarak gelir */}
        <section
          aria-label="Mesajlar"
          className={cx(
            "absolute inset-y-0 right-0 z-20 flex w-full min-w-0 flex-1 flex-col bg-canvas-light transition-transform duration-200 ease-out-soft dark:bg-canvas-dark",
            "md:static md:z-auto md:translate-x-0",
            selected ? "translate-x-0" : "translate-x-full md:translate-x-0",
            selected ? "" : "pointer-events-none md:pointer-events-auto",
          )}
        >
          <div
            key={selectedId ?? "empty"}
            className="flex min-h-0 flex-1 flex-col md:animate-fade-in"
          >
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
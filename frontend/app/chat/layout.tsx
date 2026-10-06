import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/ChatShell";

export const metadata: Metadata = {
  title: "Sohbetler",
};

// Sohbet kabuğu: gezinme rayı + konuşma listesi kalıcı; alt rotalar
// (/chat ve /chat/[id]) mesaj bölmesini besler. Yetki kontrolü ChatShell'de.
export default function ChatLayout({ children }: LayoutProps<"/chat">) {
  return <ChatShell>{children}</ChatShell>;
}
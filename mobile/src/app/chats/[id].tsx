// Mesaj ekranı rotası (bkz. src/screens/ChatScreen.tsx).
// Next.js 16 web'deki gibi rota parametresinden konuşma kimliği okunur.

import { useLocalSearchParams } from "expo-router";
import { ChatScreen } from "@/screens/ChatScreen";

export default function ChatRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = decodeURIComponent(
    Array.isArray(params.id) ? (params.id[0] ?? "") : (params.id ?? ""),
  );
  return <ChatScreen conversationId={conversationId} />;
}
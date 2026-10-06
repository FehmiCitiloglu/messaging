import { MessagePane } from "@/components/chat/MessagePane";

// Next.js 16: route parametreleri Promise olarak gelir (PageProps yardımcı tipi).
export default async function ConversationPage(
  props: PageProps<"/chat/[id]">,
) {
  const params = await props.params;
  const conversationId = decodeURIComponent(params.id);
  return <MessagePane conversationId={conversationId} />;
}
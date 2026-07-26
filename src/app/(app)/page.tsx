import ChatApp from "@/components/chat/ChatApp";
import { getSeed } from "@/lib/seed";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const seed = getSeed();
  const tables = seed.tables.map((t) => ({ id: t.id, name: t.name, normativa: t.normativa }));
  const lines = store.lines().map((l) => ({ id: l.id, name: l.name }));
  return <ChatApp tables={tables} lines={lines} initialConversationId={c ?? null} />;
}

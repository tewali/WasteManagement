import ChatApp from "@/components/chat/ChatApp";
import { defaultLineId, getSeed, standardTableId } from "@/lib/seed";
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
  const plantLines = store.lines();
  const lines = plantLines.map((l) => ({ id: l.id, name: l.name }));
  const line = defaultLineId(plantLines);
  return (
    <ChatApp
      tables={tables}
      lines={lines}
      defaultLineId={line}
      defaultTableId={standardTableId(line, plantLines)}
      initialConversationId={c ?? null}
    />
  );
}

import ChatApp from "@/components/chat/ChatApp";
import { defaultLineId, getSeed, standardTableId } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const seed = getSeed();
  const tables = seed.tables.map((t) => ({ id: t.id, name: t.name, normativa: t.normativa }));
  const lines = seed.lines.map((l) => ({ id: l.id, name: l.name }));
  const line = defaultLineId();
  return (
    <ChatApp
      tables={tables}
      lines={lines}
      defaultLineId={line}
      defaultTableId={standardTableId(line)}
      initialConversationId={c ?? null}
    />
  );
}

import ChatApp from "@/components/chat/ChatApp";
import { getSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  const seed = getSeed();
  const tables = seed.tables.map((t) => ({ id: t.id, name: t.name, normativa: t.normativa }));
  const lines = seed.lines.map((l) => ({ id: l.id, name: l.name }));
  return <ChatApp tables={tables} lines={lines} />;
}

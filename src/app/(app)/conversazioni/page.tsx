import PageShell from "@/components/PageShell";
import ConversationList from "@/components/ConversationList";

export const dynamic = "force-dynamic";

export default function ConversazioniPage() {
  return (
    <PageShell title="Le mie chat">
      <ConversationList />
    </PageShell>
  );
}

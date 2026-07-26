import PageShell from "@/components/PageShell";
import DocumentList from "@/components/DocumentList";

export const dynamic = "force-dynamic";

export default function DocumentiPage() {
  return (
    <PageShell title="I miei documenti">
      <DocumentList />
    </PageShell>
  );
}

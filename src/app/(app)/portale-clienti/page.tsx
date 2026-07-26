import PageShell from "@/components/PageShell";
import PortaleClientiClient from "@/components/PortaleClientiClient";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function PortaleClientiPage() {
  const submissions = store.submissions().map((s) => {
    const doc = store.document(s.document_id);
    const analysis = doc ? store.analysisForDocument(doc.id) : null;
    return {
      ...s,
      filename: doc?.filename ?? "documento",
      pdf_url: doc?.pdf_url ?? null,
      eer: analysis?.header.eer_declared ?? null,
      waste_description: analysis?.header.waste_description ?? null,
    };
  });
  return (
    <PageShell title="Portale clienti">
      <PortaleClientiClient submissions={submissions} />
    </PageShell>
  );
}

import PageShell from "@/components/PageShell";
import AnalysisList from "@/components/AnalysisList";

export const dynamic = "force-dynamic";

export default function AnalisiPage() {
  return (
    <PageShell title="Analisi e confronti">
      <AnalysisList />
    </PageShell>
  );
}

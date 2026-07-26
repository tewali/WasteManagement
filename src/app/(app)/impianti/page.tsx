import PageShell from "@/components/PageShell";
import LineEditor from "@/components/LineEditor";
import { getSeed } from "@/lib/seed";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function ImpiantiPage() {
  const seed = getSeed();
  const tables = seed.tables.map((t) => ({ id: t.id, name: t.name, blocking: t.blocking }));
  return (
    <PageShell title="Impianti e linee">
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-[15px] font-bold text-slate-800">{seed.plant.name}</h2>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Autorizzazione: {seed.plant.authorization.reference}
        </p>
      </div>
      <LineEditor lines={store.lines()} tables={tables} />
    </PageShell>
  );
}

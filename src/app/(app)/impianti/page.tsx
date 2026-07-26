import PageShell from "@/components/PageShell";
import { getSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default function ImpiantiPage() {
  const seed = getSeed();
  return (
    <PageShell title="Impianti e linee">
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-[15px] font-bold text-slate-800">{seed.plant.name}</h2>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Autorizzazione: {seed.plant.authorization.reference}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {seed.lines.map((l) => (
          <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-[13.5px] font-bold text-slate-800">{l.name}</h3>
              <span className="rounded bg-brand-pale px-2 py-0.5 text-[11px] font-bold text-brand-dark">
                {l.operation}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">{l.description}</p>
            <div className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">EER ammessi</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {l.admissible_eer.map((c) => (
                  <span key={c} className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tabelle limiti</div>
              <ul className="mt-1.5 space-y-1 text-[12px] text-slate-600">
                {l.limit_bindings.map((b) => (
                  <li key={b.limit_table_id} className="flex items-start gap-1.5">
                    <span className={b.blocking ? "text-red-500" : "text-brand-dark"}>
                      {b.blocking ? "⛔" : "✓"}
                    </span>
                    {b.purpose}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 text-[12px] text-slate-400">
              Capacità: {l.annual_capacity_t.toLocaleString("it-IT")} t/anno
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

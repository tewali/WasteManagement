import PageShell from "@/components/PageShell";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function AnalisiPage() {
  const { verifications, documents } = store.get();
  return (
    <PageShell title="Analisi e confronti">
      {verifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[13.5px] text-slate-500">
          Nessuna verifica eseguita. Avvii un confronto dalla Chat con Anna.
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map((v) => {
            const d = documents.find((x) => x.id === v.document_id);
            return (
              <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[13.5px] font-bold text-slate-800">{d?.filename ?? "—"}</span>
                  <span className="text-[12.5px] text-slate-500">{v.limit_table_name.split("(")[0].trim()}</span>
                  <span
                    className={`ml-auto rounded px-2 py-0.5 text-[11px] font-semibold ${
                      v.overall === "conforme" ? "bg-brand-pale text-brand-dark" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {v.overall === "conforme" ? "Conforme" : "Non conforme"}
                  </span>
                  {v.blocking && (
                    <span className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      Vincolo POP
                    </span>
                  )}
                </div>
                <div className="mt-2 flex gap-4 text-[12px] text-slate-500">
                  <span>✅ {v.counts.conforme} conformi</span>
                  <span>⛔ {v.counts.non_conforme} non conformi</span>
                  <span>◻ {v.counts.non_determinato} non determinati</span>
                  <span className="ml-auto">
                    {new Date(v.created_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                    {v.requested_by}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

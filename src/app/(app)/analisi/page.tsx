import PageShell from "@/components/PageShell";
import { EsitoBlock } from "@/components/chat/EsitoCard";
import { IconDownload, IconPdf } from "@/components/icons";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function AnalisiPage() {
  const { verifications, documents, analyses } = store.get();
  return (
    <PageShell title="Analisi e confronti">
      {verifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[13.5px] text-slate-500">
          Nessuna verifica eseguita. Avvii un confronto dalla Chat con Anna.
        </div>
      ) : (
        <div className="space-y-5">
          {verifications.map((v) => {
            const d = documents.find((x) => x.id === v.document_id);
            const a = analyses.find((x) => x.id === v.analysis_id);
            const nc = v.verdicts.filter((x) => x.esito === "non_conforme");
            return (
              <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
                {/* header: documento + inquadramento */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <IconPdf size={22} />
                  <span className="text-[14px] font-bold text-slate-800">{d?.filename ?? "—"}</span>
                  {a && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                      CER {a.header.eer_declared}
                    </span>
                  )}
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
                  <a
                    href={`/api/verifications/${v.id}/pdf`}
                    className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 hover:border-brand/50 hover:text-brand-dark"
                    title="Scarica l'esito come PDF"
                  >
                    <IconDownload size={13} />
                    Esporta PDF
                  </a>
                </div>
                <div className="mt-1.5 text-[12px] text-slate-500">
                  {v.limit_table_name.split("(")[0].trim()} · {v.normativa.split("(")[0].trim()} ·{" "}
                  {new Date(v.created_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                  {v.requested_by}
                </div>

                {/* esito conformità — same component as the chat card */}
                <div className="mt-4">
                  <EsitoBlock verification={v} />
                </div>

                {/* conclusione */}
                <div
                  className={`mt-4 rounded-lg border px-4 py-3 ${
                    v.overall === "conforme"
                      ? "border-brand/40 bg-brand-mist"
                      : "border-brand/40 bg-brand-mist"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-[13px] font-bold text-slate-800">
                    <span aria-hidden>{v.overall === "conforme" ? "✅" : "⚠️"}</span> Conclusione
                  </div>
                  {v.overall === "conforme" ? (
                    <p className="text-[13px] text-slate-700">
                      Il rifiuto è conforme ai limiti della{" "}
                      <span className="font-bold">{v.limit_table_name.split("(")[0].trim()}</span>
                      {v.counts.non_determinato > 0 &&
                        ` — attenzione: ${v.counts.non_determinato} parametri non determinati.`}
                    </p>
                  ) : (
                    <div className="text-[13px] text-slate-700">
                      <p>
                        Il rifiuto NON è conforme ai limiti della{" "}
                        <span className="font-bold">{v.limit_table_name.split("(")[0].trim()}</span> per i seguenti
                        parametri:
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {nc.map((x) => (
                          <li key={x.analyte_key} className="flex gap-2">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                            <span>
                              {x.label.replace(/\s*\(.*\)$/, "")} ({x.result_raw} &gt; {x.limit_display} {x.unit})
                            </span>
                          </li>
                        ))}
                      </ul>
                      {v.blocking && v.blocking_consequence && <p className="mt-2">{v.blocking_consequence}</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

import PageShell from "@/components/PageShell";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function StoricoPage() {
  const { verifications, documents, analyses } = store.get();
  const events = [
    ...verifications.map((v) => ({
      time: v.created_at,
      who: v.requested_by,
      what: `Verifica di conformità — ${v.limit_table_name.split("(")[0].trim()}`,
      detail: `${documents.find((d) => d.id === v.document_id)?.filename ?? "—"} → ${
        v.overall === "conforme" ? "CONFORME" : "NON CONFORME"
      } (${v.counts.conforme}/${v.counts.non_conforme}/${v.counts.non_determinato})`,
      tone: v.overall === "conforme" ? "ok" : "ko",
    })),
    ...analyses
      .filter((a) => a.edited)
      .map((a) => ({
        time: new Date().toISOString(),
        who: "Aurora Parolini",
        what: "Correzione manuale dei dati estratti",
        detail: documents.find((d) => d.id === a.document_id)?.filename ?? "—",
        tone: "warn" as const,
      })),
  ].sort((a, b) => b.time.localeCompare(a.time));

  return (
    <PageShell title="Storico richieste">
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[13.5px] text-slate-500">
          Nessuna attività registrata in questa sessione.
        </div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-slate-200 pl-6">
          {events.map((e, i) => (
            <li key={i} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <span
                className={`absolute -left-[31px] top-5 h-3 w-3 rounded-full ring-4 ring-[#f2f5f2] ${
                  e.tone === "ok" ? "bg-brand" : e.tone === "ko" ? "bg-red-500" : "bg-amber-400"
                }`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">{e.what}</span>
                <span className="ml-auto text-[11.5px] text-slate-400">
                  {new Date(e.time).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })} · {e.who}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-slate-600">{e.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}

import Link from "next/link";
import PageShell from "@/components/PageShell";
import { IconChat, IconDownload, IconPdf } from "@/components/icons";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function DocumentiPage() {
  const { documents, analyses, conversations } = store.get();
  return (
    <PageShell title="I miei documenti">
      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[13.5px] text-slate-500">
          Nessun documento caricato. Carichi un rapporto di prova dalla Chat con Anna.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Documento</th>
                <th className="px-4 py-2.5">CER</th>
                <th className="px-4 py-2.5">Laboratorio</th>
                <th className="px-4 py-2.5">Caricato il</th>
                <th className="px-4 py-2.5">Estrazione</th>
                <th className="px-4 py-2.5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => {
                const a = analyses.find((x) => x.document_id === d.id);
                const conv = conversations.find((c) => c.active_document_id === d.id);
                return (
                  <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">
                      {d.pdf_url ? (
                        <a
                          href={d.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 hover:text-brand-dark hover:underline"
                          title="Apri il PDF"
                        >
                          <IconPdf size={22} />
                          {d.filename}
                        </a>
                      ) : (
                        <span className="flex items-center gap-2.5">
                          <IconPdf size={22} />
                          {d.filename}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{a?.header.eer_declared ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a?.header.laboratory ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(d.uploaded_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          a?.extraction_source === "claude"
                            ? "bg-brand-pale text-brand-dark"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {a?.extraction_source === "claude" ? "AI" : "Demo"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center justify-end gap-1.5">
                        {d.pdf_url && (
                          <a
                            href={d.pdf_url}
                            download={d.filename}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-brand/50 hover:text-brand-dark"
                            title="Scarica il PDF"
                          >
                            <IconDownload size={14} />
                          </a>
                        )}
                        {conv && (
                          <Link
                            href={`/?c=${conv.id}`}
                            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-[11.5px] font-semibold text-slate-600 hover:border-brand/50 hover:text-brand-dark"
                            title={`Apri la chat: ${conv.title}`}
                          >
                            <IconChat size={13} />
                            Vai alla chat
                          </Link>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

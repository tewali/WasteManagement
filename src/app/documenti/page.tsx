import PageShell from "@/components/PageShell";
import { IconPdf } from "@/components/icons";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function DocumentiPage() {
  const { documents, analyses } = store.get();
  return (
    <PageShell title="I miei documenti">
      {documents.length === 0 ? (
        <Empty text="Nessun documento caricato. Carichi un rapporto di prova dalla Chat con Anna." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Documento</th>
                <th className="px-4 py-2.5">CER</th>
                <th className="px-4 py-2.5">Laboratorio</th>
                <th className="px-4 py-2.5">Caricato il</th>
                <th className="px-4 py-2.5">Origine</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => {
                const a = analyses.find((x) => x.document_id === d.id);
                return (
                  <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="flex items-center gap-2.5 px-4 py-2.5 font-semibold text-slate-800">
                      <IconPdf size={22} />
                      {d.filename}
                    </td>
                    <td className="px-4 py-2.5">{a?.header.eer_declared ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{a?.header.laboratory ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(d.uploaded_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {d.source === "seed_fixture" ? "Demo" : "Upload"}
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

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[13.5px] text-slate-500">
      {text}
    </div>
  );
}

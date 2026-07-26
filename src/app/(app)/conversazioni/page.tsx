import Link from "next/link";
import PageShell from "@/components/PageShell";
import { IconChat, IconPdf } from "@/components/icons";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function ConversazioniPage() {
  const { conversations, documents } = store.get();
  return (
    <PageShell title="Le mie chat">
      {conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[13.5px] text-slate-500">
          Nessuna conversazione salvata. Le chat con Anna vengono archiviate qui automaticamente.
        </div>
      ) : (
        <ul className="space-y-3">
          {conversations.map((c) => {
            const doc = c.active_document_id
              ? documents.find((d) => d.id === c.active_document_id)
              : null;
            return (
              <li key={c.id}>
                <Link
                  href={`/?c=${c.id}`}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:-translate-y-px hover:border-brand/50 hover:shadow-panel"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-pale">
                    <IconChat size={16} className="text-brand-dark" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold text-slate-800">
                      {c.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-slate-400">
                      {new Date(c.created_at).toLocaleString("it-IT", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {c.messages.length} messaggi
                    </span>
                    {doc && (
                      <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1">
                        <IconPdf size={16} />
                        <span className="truncate text-[11.5px] font-medium text-slate-600">
                          {doc.filename}
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="mt-1 shrink-0 text-[12px] font-semibold text-brand-dark">
                    Apri →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

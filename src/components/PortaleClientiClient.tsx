"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconChat, IconDownload, IconPdf } from "./icons";
import type { PortalSubmission } from "@/lib/types";

type Row = PortalSubmission & {
  filename: string;
  pdf_url: string | null;
  eer: string | null;
  waste_description: string | null;
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function PortaleClientiClient({ submissions }: { submissions: Row[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: "verifica" | "chat") {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/portal/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { error?: string; conversation_id?: string }
      | null;
    setBusyId(null);
    if (!res?.ok) {
      setError(data?.error ?? "Operazione non riuscita.");
      return;
    }
    if (action === "chat" && data?.conversation_id) {
      router.push(`/?c=${data.conversation_id}`);
      return;
    }
    router.refresh();
  }

  const pending = submissions.filter((s) => s.status === "inviato");
  const done = submissions.filter((s) => s.status === "completato");

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-slate-500">
        Rapporti di prova inviati dai clienti produttori tramite il portale. «Verifica rapida»
        esegue il confronto con i limiti standard della linea e comunica l&apos;esito al cliente;
        «Apri in chat» avvia una revisione completa con Anna.
      </p>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
      )}

      {[
        { title: `Da verificare (${pending.length})`, rows: pending },
        { title: `Completati (${done.length})`, rows: done },
      ].map(({ title, rows }) => (
        <section key={title}>
          <h2 className="mb-2 text-[13.5px] font-bold text-slate-700">{title}</h2>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-[12.5px] text-slate-400">
              Nessun invio.
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card"
                >
                  <IconPdf size={26} className="shrink-0 text-brand-dark" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-slate-800">
                      {s.producer_name} · {s.filename}
                    </p>
                    <p className="text-[11.5px] text-slate-400">
                      {fmtDateTime(s.created_at)}
                      {s.eer ? ` · CER ${s.eer}` : ""}
                      {s.message ? ` · Nota: "${s.message}"` : ""}
                    </p>
                    {s.status === "completato" && (
                      <p className="text-[11.5px] text-slate-400">
                        Verificato da {s.reviewed_by} il {s.reviewed_at ? fmtDateTime(s.reviewed_at) : "—"}
                      </p>
                    )}
                  </div>
                  {s.status === "completato" && (
                    <span
                      className={`rounded px-2.5 py-1 text-[11.5px] font-bold ${
                        s.esito === "conforme" ? "bg-brand-pale text-brand-dark" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.esito === "conforme" ? "Conforme" : "Non conforme"}
                    </span>
                  )}
                  {s.pdf_url && (
                    <a
                      href={s.pdf_url}
                      target="_blank"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:border-brand/50"
                    >
                      Apri PDF
                    </a>
                  )}
                  {s.status === "inviato" && (
                    <button
                      onClick={() => void act(s.id, "verifica")}
                      disabled={busyId === s.id}
                      className="rounded-lg bg-brand-dark px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-brand disabled:opacity-50"
                    >
                      {busyId === s.id ? "Verifico…" : "Verifica rapida"}
                    </button>
                  )}
                  <button
                    onClick={() => void act(s.id, "chat")}
                    disabled={busyId === s.id}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-brand-dark hover:border-brand/50 disabled:opacity-50"
                  >
                    <IconChat size={13} /> Apri in chat
                  </button>
                  {s.status === "completato" && s.verification_id && (
                    <a
                      href={`/api/verifications/${s.verification_id}/pdf`}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:border-brand/50"
                    >
                      <IconDownload size={13} /> Esito PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

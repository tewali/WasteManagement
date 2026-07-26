"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconDownload, IconPdf } from "../icons";
import type { PortalSubmission } from "@/lib/types";

type Row = PortalSubmission & { filename: string };

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function PortalClient({ submissions }: { submissions: Row[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function pick(f: File | null) {
    setError(null);
    if (f && !(f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))) {
      setError("Sono accettati solo file PDF.");
      return;
    }
    setFile(f);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = (await up.json().catch(() => null)) as
        | { document?: { id: string }; error?: string }
        | null;
      if (!up.ok || !upData?.document) {
        setError(upData?.error ?? "Caricamento non riuscito, riprovare.");
        return;
      }
      const res = await fetch("/api/portal/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: upData.document.id, message }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Invio non riuscito, riprovare.");
        return;
      }
      setFile(null);
      setMessage("");
      setNotice(
        "Rapporto inviato. Il personale tecnico di Valli S.p.A. lo verificherà e l'esito comparirà qui sotto.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-panel">
        <h1 className="text-[18px] font-bold text-slate-900">Invia un rapporto di prova</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Carichi il rapporto di prova del laboratorio (PDF). I dati vengono estratti
          automaticamente e il personale tecnico verifica l&apos;accettabilità del rifiuto
          in impianto.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => fileRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragOver ? "border-brand bg-brand-mist" : "border-slate-300 bg-slate-50 hover:border-brand/60"
          }`}
        >
          <IconPdf size={34} className="text-brand-dark" />
          {file ? (
            <>
              <p className="mt-3 text-[14px] font-semibold text-slate-800">{file.name}</p>
              <p className="text-[12px] text-slate-500">{(file.size / 1024).toFixed(0)} KB — pronto per l&apos;invio</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-[14px] font-semibold text-slate-700">
                Trascini qui il rapporto di prova (PDF)
              </p>
              <p className="text-[12px] text-slate-500">oppure clicchi per selezionarlo</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-[12px] font-semibold text-slate-600">
            Nota per l&apos;impianto (facoltativa)
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Es. conferimento previsto la prossima settimana, cantiere Via Roma…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">{error}</p>
        )}
        {notice && (
          <p className="mt-3 rounded-md bg-brand-mist px-3 py-2 text-[12.5px] font-medium text-brand-dark">
            {notice}
          </p>
        )}

        <button
          onClick={() => void submit()}
          disabled={!file || busy}
          className="mt-4 h-11 rounded-lg bg-brand-dark px-6 text-[13.5px] font-bold text-white transition hover:bg-brand disabled:opacity-50"
        >
          {busy ? "Invio in corso…" : "Invia il rapporto"}
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold text-slate-800">I miei invii</h2>
        {submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-[13px] text-slate-500">
            Nessun rapporto inviato finora.
          </div>
        ) : (
          <div className="space-y-2.5">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card"
              >
                <IconPdf size={26} className="shrink-0 text-brand-dark" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-slate-800">{s.filename}</p>
                  <p className="text-[11.5px] text-slate-400">
                    Inviato il {fmtDateTime(s.created_at)}
                    {s.message ? ` · "${s.message}"` : ""}
                  </p>
                </div>
                {s.status === "completato" ? (
                  <>
                    <span
                      className={`rounded px-2.5 py-1 text-[11.5px] font-bold ${
                        s.esito === "conforme"
                          ? "bg-brand-pale text-brand-dark"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.esito === "conforme" ? "✅ Conforme" : "⛔ Non conforme"}
                    </span>
                    {s.verification_id && (
                      <a
                        href={`/api/verifications/${s.verification_id}/pdf`}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-brand-dark hover:border-brand/50"
                      >
                        <IconDownload size={13} /> Esito PDF
                      </a>
                    )}
                  </>
                ) : (
                  <span className="rounded bg-sky-100 px-2.5 py-1 text-[11.5px] font-bold text-sky-700">
                    In verifica
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-slate-400">
          L&apos;esito indica la conformità ai limiti standard della linea di trattamento. Per il
          conferimento fa fede l&apos;omologa rilasciata dall&apos;impianto.
        </p>
      </section>
    </div>
  );
}

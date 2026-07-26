"use client";

import { useMemo, useState } from "react";
import type { AnalysisRecord, DocumentRecord, VerificationResult } from "@/lib/types";
import {
  IconChevronL,
  IconChevronR,
  IconDots,
  IconDownload,
  IconExpand,
  IconMinus,
  IconPdf,
  IconPlus,
  IconSave,
  IconX,
} from "../icons";

interface TableOpt {
  id: string;
  name: string;
  normativa: string;
}
interface LineOpt {
  id: string;
  name: string;
}

const DATE_IT = (iso?: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("it-IT") : "—";

export default function DocPanel({
  document: doc,
  analysis,
  verification,
  tables,
  lines,
  tableId,
  lineId,
  attachments,
  onClose,
  onChangeTable,
  onChangeLine,
  onSaveAnalysis,
}: {
  document: DocumentRecord;
  analysis: AnalysisRecord;
  verification: VerificationResult | null;
  tables: TableOpt[];
  lines: LineOpt[];
  tableId: string;
  lineId: string;
  attachments: DocumentRecord[];
  onClose: () => void;
  onChangeTable: (id: string) => void;
  onChangeLine: (id: string) => void;
  onSaveAnalysis: (patch: Record<string, string>) => Promise<void>;
}) {
  const [page, setPage] = useState(1);
  // "fit" = fit page width to the panel (default); a number = manual zoom %.
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [changingTable, setChangingTable] = useState(false);
  const [saving, setSaving] = useState(false);

  const table = tables.find((t) => t.id === tableId);
  const line = lines.find((l) => l.id === lineId);

  const pdfSrc = useMemo(() => {
    if (!doc.pdf_url) return null;
    const zoomParam = zoom === "fit" ? "view=FitH" : `zoom=${zoom}`;
    return `${doc.pdf_url}#toolbar=0&navpanes=0&page=${page}&${zoomParam}`;
  }, [doc.pdf_url, page, zoom]);

  const fields: { key: string; label: string; value: string }[] = [
    { key: "eer_declared", label: "CER rilevato", value: analysis.header.eer_declared },
    {
      key: "sample_type",
      label: "Tipologia campione",
      value: analysis.header.sample_type ?? analysis.header.waste_description,
    },
    { key: "sampling_date", label: "Data campionamento", value: DATE_IT(analysis.header.sampling_date) },
    { key: "report_date", label: "Data rapporto di prova", value: DATE_IT(analysis.header.report_date) },
    { key: "laboratory", label: "Laboratorio", value: analysis.header.laboratory },
    { key: "digestion_method", label: "Metodo di digestione", value: analysis.header.digestion_method ?? "—" },
    { key: "notes", label: "Note", value: analysis.header.notes ?? "—" },
  ];

  async function save() {
    setSaving(true);
    await onSaveAnalysis(draft);
    setSaving(false);
    setEditing(false);
    setDraft({});
  }

  return (
    <aside className="flex w-[480px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-[#f7f9f7]">
      {/* Card: viewer */}
      <div className="m-4 mb-0 rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="truncate text-[13.5px] font-bold text-slate-900">{doc.filename}</span>
          <span className="rounded-md bg-brand-pale px-2 py-0.5 text-[10.5px] font-semibold text-brand-dark">
            Analisi
          </span>
          <div className="ml-auto flex items-center gap-1 text-slate-400">
            <button className="rounded p-1 hover:bg-slate-100" title="Altre azioni">
              <IconDots size={15} />
            </button>
            <button onClick={onClose} className="rounded p-1 hover:bg-slate-100" title="Chiudi pannello">
              <IconX size={15} />
            </button>
          </div>
        </div>
        {/* toolbar */}
        <div className="flex items-center justify-between border-y border-slate-100 px-3 py-1.5 text-slate-500">
          <div className="flex items-center gap-1">
            <button
              className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Pagina precedente"
            >
              <IconChevronL size={15} />
            </button>
            <input
              value={page}
              onChange={(e) => {
                const n = parseInt(e.target.value || "1", 10);
                if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), doc.pages));
              }}
              className="h-6 w-9 rounded border border-slate-200 text-center text-[12px] tabular-nums"
              aria-label="Pagina"
            />
            <span className="text-[12px]">/ {doc.pages}</span>
            <button
              className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
              disabled={page >= doc.pages}
              onClick={() => setPage((p) => Math.min(doc.pages, p + 1))}
              title="Pagina successiva"
            >
              <IconChevronR size={15} />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="rounded p-1 hover:bg-slate-100"
              onClick={() => setZoom((z) => Math.max(50, (z === "fit" ? 100 : z) - 10))}
              title="Riduci zoom"
            >
              <IconMinus size={14} />
            </button>
            <button
              className="w-14 rounded text-center text-[12px] tabular-nums hover:bg-slate-100"
              onClick={() => setZoom("fit")}
              title="Adatta alla larghezza del pannello"
            >
              {zoom === "fit" ? "Adatta" : `${zoom}%`}
            </button>
            <button
              className="rounded p-1 hover:bg-slate-100"
              onClick={() => setZoom((z) => Math.min(300, (z === "fit" ? 100 : z) + 10))}
              title="Aumenta zoom"
            >
              <IconPlus size={14} />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button className="rounded p-1 hover:bg-slate-100" title="Vista doppia pagina">
              <IconExpand size={14} />
            </button>
            {doc.pdf_url && (
              <a href={doc.pdf_url} download={doc.filename} className="rounded p-1 hover:bg-slate-100" title="Scarica PDF">
                <IconDownload size={14} />
              </a>
            )}
            <button className="rounded p-1 hover:bg-slate-100" title="Salva nei documenti">
              <IconSave size={14} />
            </button>
          </div>
        </div>
        <div className="h-[360px] overflow-hidden rounded-b-xl bg-slate-100">
          {pdfSrc ? (
            <iframe key={pdfSrc} src={pdfSrc} className="h-full w-full border-0 bg-white" title={doc.filename} />
          ) : (
            <div className="m-2 flex h-[calc(100%-16px)] items-center justify-center rounded border border-dashed border-slate-300 text-[12.5px] text-slate-400">
              Anteprima non disponibile per questo file
            </div>
          )}
        </div>
      </div>

      {/* Dati estratti */}
      <section className="mx-4 mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-slate-700">
            Dati estratti
            <span
              className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                analysis.extraction_source === "claude"
                  ? "bg-brand-pale text-brand-dark"
                  : "bg-amber-100 text-amber-700"
              }`}
              title={
                analysis.extraction_source === "claude"
                  ? "Dati estratti dal PDF con Claude"
                  : "Dati dimostrativi (estrazione AI non attiva)"
              }
            >
              {analysis.extraction_source === "claude" ? "AI" : "DEMO"}
            </span>
          </h3>
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setDraft({});
                }}
                className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold text-slate-500 hover:bg-slate-100"
              >
                Annulla
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-brand-dark px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-brand disabled:opacity-50"
              >
                {saving ? "Salvo…" : "Salva"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="rounded-md bg-brand-pale px-2.5 py-1 text-[11.5px] font-semibold text-brand-dark hover:bg-brand/20"
            >
              Modifica
            </button>
          )}
        </div>
        <dl className="divide-y divide-slate-100">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center gap-3 py-[7px]">
              <dt className="w-[150px] shrink-0 text-[12.5px] text-slate-500">{f.label}</dt>
              <dd className="clamp2 flex-1 text-right text-[12.5px] font-medium text-slate-800" title={f.value}>
                {editing && !f.key.includes("date") ? (
                  <input
                    defaultValue={f.value === "—" ? "" : f.value}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-right text-[12.5px] focus:border-brand focus:outline-none"
                  />
                ) : (
                  f.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        {analysis.edited && (
          <p className="mt-2 text-[10.5px] font-medium text-amber-600">
            Dati corretti manualmente dall&apos;operatore (tracciato nello storico).
          </p>
        )}
      </section>

      {/* Confronto */}
      <section className="mx-4 mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-700">Confronto</h3>
        <dl className="divide-y divide-slate-100">
          <div className="flex items-center gap-3 py-[7px]">
            <dt className="w-[130px] shrink-0 text-[12.5px] text-slate-500">Limite selezionato</dt>
            <dd className="flex flex-1 items-center justify-end gap-2 text-[12.5px] font-medium text-slate-800">
              {changingTable ? (
                <select
                  autoFocus
                  value={tableId}
                  onChange={(e) => {
                    setChangingTable(false);
                    onChangeTable(e.target.value);
                  }}
                  onBlur={() => setChangingTable(false)}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[12px] focus:border-brand focus:outline-none"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name.split("(")[0].trim()}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <span className="truncate">{shortTableName(tableId)}</span>
                  <button
                    onClick={() => setChangingTable(true)}
                    className="shrink-0 rounded-md bg-brand-pale px-2.5 py-1 text-[11.5px] font-semibold text-brand-dark hover:bg-brand/20"
                  >
                    Cambia
                  </button>
                </>
              )}
            </dd>
          </div>
          <div className="flex items-center gap-3 py-[7px]">
            <dt className="w-[130px] shrink-0 text-[12.5px] text-slate-500">Normativa</dt>
            <dd className="flex-1 text-right text-[12.5px] font-medium text-slate-800">
              {table?.normativa.split("(")[0].trim() ?? "—"}
            </dd>
          </div>
          <div className="flex items-center gap-3 py-[7px]">
            <dt className="w-[130px] shrink-0 text-[12.5px] text-slate-500">Linea impianto</dt>
            <dd className="flex-1 text-right">
              <select
                value={lineId}
                onChange={(e) => onChangeLine(e.target.value)}
                className="rounded border border-transparent bg-transparent text-right text-[12.5px] font-medium text-slate-800 hover:border-slate-200 focus:border-brand focus:outline-none"
              >
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name.replace("Linea 1 — ", "").replace("Linea 2 — ", "").replace("Linea 3 — ", "")}
                    {" - "}
                    {l.id === "L1-soil-washing" ? "Linea 1" : l.id === "L2-inertizzazione" ? "Linea 2" : "Linea 3"}
                  </option>
                ))}
              </select>
            </dd>
          </div>
          {verification && (
            <div className="flex items-center gap-3 py-[7px]">
              <dt className="w-[130px] shrink-0 text-[12.5px] text-slate-500">Ultimo esito</dt>
              <dd className="flex-1 text-right">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                    verification.overall === "conforme"
                      ? "bg-brand-pale text-brand-dark"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {verification.overall === "conforme" ? "Conforme" : "Non conforme"}
                </span>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Allegati */}
      <section className="m-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-slate-700">
            Allegati nella conversazione
          </h3>
          <button className="text-[11.5px] font-semibold text-brand-dark hover:underline">Mostra tutti</button>
        </div>
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
              <IconPdf size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-slate-800">{a.filename}</div>
                <div className="text-[11px] text-slate-400">
                  PDF · {(a.size / 1_000_000).toFixed(1)} MB · {new Date(a.uploaded_at).toLocaleDateString("it-IT")}
                </div>
              </div>
              <button className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Azioni allegato">
                <IconDots size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function shortTableName(id: string): string {
  if (id.endsWith("colA")) return "Tabella 5 - Colonna A";
  if (id.endsWith("colB")) return "Tabella 5 - Colonna B";
  if (id.includes("inerti")) return "Eluato - Discarica inerti";
  if (id.includes("non-pericolosi")) return "Eluato - Disc. non pericolosi";
  if (id.startsWith("pop")) return "Vincolo POP (Reg. 2019/1021)";
  return id;
}

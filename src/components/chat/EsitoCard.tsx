"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MatriceBlock from "./MatriceCard";
import QuadroBlock from "./QuadroCard";
import type { MessageBlock, ParamVerdict, VerificationResult } from "@/lib/types";

const ESITO_STYLE: Record<string, { pill: string; label: string }> = {
  conforme: { pill: "bg-brand-pale text-brand-dark", label: "Conforme" },
  non_conforme: { pill: "bg-red-100 text-red-700", label: "Non conforme" },
  non_determinato: { pill: "bg-slate-200 text-slate-600", label: "Non determinato" },
  non_applicabile: { pill: "bg-sky-100 text-sky-700", label: "Non applicabile" },
};

function StatChip({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className={`rounded-lg px-4 py-2 ${cls}`}>
      <div className="text-[12px] font-semibold">{label}</div>
      <div className="text-[20px] font-bold leading-tight">{value}</div>
    </div>
  );
}

function shortLimitHeader(v: VerificationResult): string {
  const id = v.limit_table_id;
  if (id.endsWith("colA")) return "LIMITE (Tab. 5 col. A)";
  if (id.endsWith("colB")) return "LIMITE (Tab. 5 col. B)";
  if (id.includes("inerti")) return "LIMITE (disc. inerti)";
  if (id.includes("non-pericolosi")) return "LIMITE (disc. non peric.)";
  if (id.startsWith("pop")) return "LIMITE POP";
  return "LIMITE";
}

export function EsitoBlock({ verification }: { verification: VerificationResult }) {
  const [expanded, setExpanded] = useState(false);
  // Only parameters this table actually governs: a table that covers a handful
  // of analytes (the POP layer) would otherwise render mostly "non applicabile"
  // rows and bury its own verdict.
  const governed = verification.verdicts.filter((v) => v.esito !== "non_applicabile");
  const notGoverned = verification.verdicts.length - governed.length;
  const rows = expanded ? governed : governed.slice(0, 8);
  const hasMore = governed.length > 8;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-wide text-slate-800">
        <span aria-hidden>📊</span> ESITO CONFORMITÀ
      </div>
      <div className="mb-3 flex flex-wrap gap-2.5">
        <StatChip label="Conformi" value={verification.counts.conforme} cls="bg-brand-pale text-brand-dark" />
        <StatChip label="Non conformi" value={verification.counts.non_conforme} cls="bg-red-100 text-red-700" />
        <StatChip label="Non determinati" value={verification.counts.non_determinato} cls="bg-slate-200 text-slate-600" />
        {verification.counts.non_applicabile > 0 && (
          <StatChip label="Non applicabili" value={verification.counts.non_applicabile} cls="bg-sky-100 text-sky-700" />
        )}
        {/* evaluated_total excludes "non applicabile" — label it for what it counts. */}
        <StatChip label="Parametri valutati" value={verification.evaluated_total} cls="bg-sky-100 text-sky-800" />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Parametro</th>
              <th className="whitespace-nowrap px-3 py-2 text-right">Risultato</th>
              <th className="whitespace-nowrap px-2 py-2">U.M.</th>
              <th className="whitespace-nowrap px-3 py-2 text-right">{shortLimitHeader(verification)}</th>
              <th className="px-3 py-2 text-center">Esito</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v: ParamVerdict) => {
              const bad = v.esito === "non_conforme";
              const st = ESITO_STYLE[v.esito];
              return (
                <tr
                  key={v.analyte_key}
                  title={v.reason}
                  className={`border-t border-slate-100 ${bad ? "bg-red-50 text-red-700" : "text-slate-700"}`}
                >
                  <td className="px-3 py-1.5 font-medium">{v.label.replace(/\s*—\s*eluato$/, "")}</td>
                  <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${bad ? "font-bold" : ""}`}>
                    {v.result_raw}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{v.unit}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{v.limit_display ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-center">
                    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${st.pill}`}>
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-3 py-2 text-[12px] text-slate-500">
            Nessun parametro del rapporto rientra fra quelli previsti da questa tabella.
          </p>
        )}
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="block w-full border-t border-slate-100 bg-slate-50 py-1.5 text-center text-[12px] font-semibold text-brand-dark hover:bg-brand-mist"
          >
            {expanded ? "Mostra meno" : `Mostra tutti i ${governed.length} parametri…`}
          </button>
        )}
      </div>
      {notGoverned > 0 && (
        <p className="mt-2 text-[11.5px] text-slate-500">
          Altri {notGoverned} parametri del rapporto non sono previsti da questa tabella (non
          applicabili).
        </p>
      )}
      {verification.missing_analytes.length > 0 && (
        <p className="mt-2 text-[11.5px] text-slate-500">
          Parametri previsti dalla tabella ma assenti nel rapporto:{" "}
          {verification.missing_analytes.map((m) => m.label.replace(/\s*—\s*eluato$/, "")).join(", ")}.
        </p>
      )}
      {verification.table_status === "SIMULATED_DA_VALIDARE" && (
        <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
          ⚠ Tabella limiti in stato SIMULATO — valori da validare prima dell&apos;uso operativo.
        </p>
      )}
    </div>
  );
}

export default function MessageBlocks({
  blocks,
  onRetry,
  canRetry,
}: {
  blocks: MessageBlock[];
  /** Replays the failed request behind an `errore` block. */
  onRetry?: (retryId: string) => void;
  /** False once the action is gone (e.g. after a page reload). */
  canRetry?: (retryId: string) => boolean;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.type === "text") {
          return (
            <div key={i} className="chat-md text-[13.5px] leading-relaxed text-slate-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.text}</ReactMarkdown>
            </div>
          );
        }
        if (b.type === "inquadramento") {
          return (
            <div key={i}>
              <div className="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-wide text-slate-800">
                <span aria-hidden>📄</span> INQUADRAMENTO
              </div>
              <ul className="space-y-1 pl-1 text-[13px] text-slate-700">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                    <span>
                      <span className="font-semibold">{it.label}:</span> {it.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (b.type === "quadro") {
          return <QuadroBlock key={i} quadro={b.quadro} matrice={b.matrice} />;
        }
        if (b.type === "matrice") {
          return <MatriceBlock key={i} matrice={b.matrice} />;
        }
        if (b.type === "errore") {
          const retriable = onRetry && (canRetry?.(b.retry_id) ?? true);
          return (
            <div key={i} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <div className="mb-1 flex items-center gap-2 text-[13px] font-bold text-slate-800">
                <span aria-hidden>⚠️</span> Connessione non riuscita
              </div>
              <p className="text-[13px] leading-relaxed text-slate-700">{b.text}</p>
              {b.hint && <p className="mt-1 text-[11.5px] text-slate-500">{b.hint}</p>}
              {retriable && (
                <button
                  onClick={() => onRetry(b.retry_id)}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-dark px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand"
                >
                  <span aria-hidden>↻</span> Riprova
                </button>
              )}
            </div>
          );
        }
        if (b.type === "esito") {
          return <EsitoBlock key={i} verification={b.verification} />;
        }
        // conclusione
        const tone =
          b.tone === "ok"
            ? "border-brand/40 bg-brand-mist"
            : b.tone === "warn"
              ? "border-amber-300 bg-amber-50"
              : "border-brand/40 bg-brand-mist";
        return (
          <div key={i} className={`rounded-lg border px-4 py-3 ${tone}`}>
            <div className="mb-1 flex items-center gap-2 text-[13px] font-bold text-slate-800">
              <span aria-hidden>{b.tone === "ok" ? "✅" : "⚠️"}</span> Conclusione
            </div>
            <div className="text-[13px] leading-relaxed text-slate-700">
              <TitleWithEmphasis title={b.title} />
              {b.lines.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {b.lines.map((l, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              )}
              {b.footer && <p className="mt-2">{b.footer}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TitleWithEmphasis({ title }: { title: string }) {
  // Bold the table name segment, mimicking the mock-up.
  const m = title.match(/^(.*?)(Tabella .*|Vincolo POP.*|Ammissibilità.*)$/);
  if (!m) return <p className="font-medium">{title}</p>;
  return (
    <p>
      {m[1]}
      <span className="font-bold">{m[2]}</span>
    </p>
  );
}

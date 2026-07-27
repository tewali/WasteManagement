"use client";

// Confronto per norma — one column per piece of legislation, one row per
// measured parameter, so a value can be read across every applicable norm at
// once instead of table by table.
//
// A norm the report cannot address keeps its column: greyed, headed NON
// APPLICABILE and explained in the footnote. Leaving it out would make an
// unperformed check look like a check that passed.

import { useState } from "react";
import type { Esito, MatriceData } from "@/lib/types";

const CELL: Record<Esito, { bg: string; text: string; icon: string; label: string }> = {
  conforme: { bg: "bg-brand-pale", text: "text-brand-dark", icon: "●", label: "conforme" },
  non_conforme: { bg: "bg-red-100", text: "text-red-700 font-bold", icon: "⚑", label: "non conforme" },
  non_determinato: { bg: "bg-amber-100", text: "text-amber-800", icon: "▲", label: "non determinato" },
  non_applicabile: { bg: "", text: "text-slate-400", icon: "", label: "non previsto" },
};

const ROWS_COLLAPSED = 10;

export default function MatriceBlock({ matrice }: { matrice: MatriceData }) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? matrice.rows : matrice.rows.slice(0, ROWS_COLLAPSED);
  const hasMore = matrice.rows.length > ROWS_COLLAPSED;
  const notApplicable = matrice.norms.filter((n) => !n.applicable);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-wide text-slate-800">
        <span aria-hidden>📋</span> CONFRONTO PER NORMA
      </div>

      {/* Stated before the table, so an unperformed check is never missed
          because its column sits off the right edge. */}
      {notApplicable.length > 0 && (
        <div className="mb-2 rounded-md bg-amber-50 px-2.5 py-2 text-[11.5px] text-amber-800">
          <span className="font-semibold">
            {notApplicable.length === 1
              ? "1 norma non è applicabile a questo rapporto:"
              : `${notApplicable.length} norme non sono applicabili a questo rapporto:`}
          </span>
          <ul className="mt-1 space-y-0.5">
            {notApplicable.map((n) => (
              <li key={n.limit_table_id}>
                <span className="font-medium">{n.name}</span> ({n.normativa}) — {n.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Wide content scrolls inside its own container, never the page. */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Parametro</th>
              <th className="whitespace-nowrap px-3 py-2 text-right">Risultato</th>
              {matrice.norms.map((n) => (
                <th
                  key={n.limit_table_id}
                  className={`whitespace-nowrap px-2 py-2 text-center ${
                    n.applicable ? "" : "text-slate-400"
                  }`}
                  title={`${n.name} — ${n.normativa}`}
                >
                  {n.short_label}
                  {n.blocking && (
                    <span className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-[9px] text-slate-600">
                      BLOCC.
                    </span>
                  )}
                  <span className="block text-[9px] font-semibold normal-case tracking-normal">
                    {n.applicable ? (
                      <span className="text-slate-400">
                        {n.basis === "eluate" ? "eluato" : "tal quale"} · {n.unit}
                      </span>
                    ) : (
                      <span className="text-amber-700">NON APPLICABILE</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.analyte_key} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-800">
                  {r.worst === "non_conforme" && (
                    <span aria-hidden className="mr-1 font-bold text-red-600">
                      ⚑
                    </span>
                  )}
                  {r.label.replace(/\s*—\s*eluato$/, "")}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {r.result_raw} <span className="text-[11px] text-slate-400">{r.unit}</span>
                </td>
                {r.cells.map((c, i) => {
                  const norm = matrice.norms[i];
                  if (!norm.applicable) {
                    return (
                      <td
                        key={norm.limit_table_id}
                        className="bg-slate-50 px-3 py-1.5 text-center text-[11px] text-slate-400"
                        title={norm.reason}
                      >
                        n.a.
                      </td>
                    );
                  }
                  if (!c.esito) {
                    return (
                      <td
                        key={norm.limit_table_id}
                        className="px-3 py-1.5 text-center text-slate-300"
                        title="Parametro non previsto da questa norma"
                      >
                        —
                      </td>
                    );
                  }
                  const st = CELL[c.esito];
                  return (
                    <td key={norm.limit_table_id} className="px-2 py-1.5 text-center">
                      <span
                        title={`Limite ${c.limit_display} — ${st.label}`}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 tabular-nums ${st.bg} ${st.text}`}
                      >
                        <span aria-hidden className="text-[10px]">
                          {st.icon}
                        </span>
                        {c.limit_display}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-center text-[12px] font-semibold text-brand-dark hover:bg-brand-mist"
        >
          {expanded ? "Mostra meno" : `Mostra tutti i ${matrice.rows.length} parametri…`}
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="rounded bg-brand-pale px-1 text-brand-dark">●</span> conforme
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="rounded bg-amber-100 px-1 text-amber-800">▲</span> non
          determinato
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="rounded bg-red-100 px-1 text-red-700">⚑</span> non conforme
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>—</span> non previsto dalla norma
        </span>
        <span className="text-slate-400">Il valore in cella è il limite della norma.</span>
      </div>

    </div>
  );
}

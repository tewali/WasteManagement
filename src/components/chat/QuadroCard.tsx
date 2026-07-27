"use client";

// Quadro di conformità — the aggregated stoplight across every active plant
// limit table.
//
// Colour here is a STATUS encoding, not series identity, so it uses the fixed
// status palette and never carries meaning alone: every state ships with an
// icon and a written label (the palette's amber sits below 3:1 on a light
// surface by design, and the icon + label pairing is the required mitigation).
// The composition bar is a 100% stack of the same three states, separated by
// 2px surface gaps rather than strokes.

import { Fragment, useState } from "react";
import type { Esito, ParamVerdict, QuadroData, QuadroRow, QuadroStatus } from "@/lib/types";

const STATUS: Record<QuadroStatus, { color: string; icon: string; label: string; chip: string }> = {
  conforme: { color: "#0ca30c", icon: "●", label: "Conforme", chip: "bg-brand-pale text-brand-dark" },
  riserve: { color: "#fab219", icon: "▲", label: "Con riserve", chip: "bg-amber-100 text-amber-800" },
  non_conforme: { color: "#d03b3b", icon: "■", label: "Non conforme", chip: "bg-red-100 text-red-700" },
  bloccante: { color: "#d03b3b", icon: "⛔", label: "Bloccante", chip: "bg-red-100 text-red-700" },
};

// Segment states of the composition bar, in fixed order.
const SEGMENTS = [
  { key: "conforme", color: "#0ca30c", label: "Conformi" },
  { key: "non_determinato", color: "#fab219", label: "Non determinati" },
  { key: "non_conforme", color: "#d03b3b", label: "Non conformi" },
] as const;

function StatusPill({ status, size = "sm" }: { status: QuadroStatus; size?: "sm" | "lg" }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${s.chip} ${
        size === "lg" ? "px-3 py-1 text-[13px]" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      <span aria-hidden style={{ color: s.color }}>
        {s.icon}
      </span>
      {s.label}
    </span>
  );
}

/** 100% stacked composition of the parameter verdicts for one table. */
function CompositionBar({ row }: { row: QuadroRow }) {
  const total = row.evaluated_total || 1;
  const parts = SEGMENTS.map((seg) => ({
    ...seg,
    value: row.counts[seg.key as keyof typeof row.counts] ?? 0,
  })).filter((p) => p.value > 0);

  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-[4px]"
      role="img"
      aria-label={parts.map((p) => `${p.value} ${p.label}`).join(", ")}
    >
      {parts.map((p, i) => (
        <div
          key={p.key}
          title={`${p.label}: ${p.value} di ${row.evaluated_total}`}
          style={{
            width: `${(p.value / total) * 100}%`,
            background: p.color,
            // 2px surface gap between touching segments — never a stroke.
            marginLeft: i === 0 ? 0 : 2,
          }}
        />
      ))}
    </div>
  );
}

const VERDICT_STYLE: Record<Esito, { pill: string; label: string; icon: string }> = {
  conforme: { pill: "bg-brand-pale text-brand-dark", label: "Conforme", icon: "●" },
  non_conforme: { pill: "bg-red-100 text-red-700", label: "Non conforme", icon: "⚑" },
  non_determinato: { pill: "bg-amber-100 text-amber-800", label: "Non determinato", icon: "▲" },
  non_applicabile: { pill: "bg-slate-200 text-slate-600", label: "Non applicabile", icon: "–" },
};

/** Every governed parameter of one table, worst first, offenders flagged. */
function VerdictDetail({ row }: { row: QuadroRow }) {
  const offenders = row.verdicts.filter((v) => v.esito === "non_conforme").length;
  return (
    <div className="bg-slate-50/70 px-3 pb-3 pt-2">
      {offenders > 0 && (
        <p className="mb-2 text-[11.5px] font-semibold text-red-700">
          ⚑ {offenders} parametr{offenders === 1 ? "o" : "i"} fuori limite su {row.evaluated_total}{" "}
          valutati.
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-1.5">Parametro</th>
              <th className="whitespace-nowrap px-3 py-1.5 text-right">Risultato</th>
              <th className="whitespace-nowrap px-2 py-1.5">U.M.</th>
              <th className="whitespace-nowrap px-3 py-1.5 text-right">Limite</th>
              <th className="px-3 py-1.5 text-center">Esito</th>
            </tr>
          </thead>
          <tbody>
            {row.verdicts.map((v: ParamVerdict) => {
              const bad = v.esito === "non_conforme";
              const st = VERDICT_STYLE[v.esito];
              return (
                <tr
                  key={v.analyte_key}
                  title={v.reason}
                  className={`border-t border-slate-100 ${bad ? "bg-red-50 text-red-700" : "text-slate-700"}`}
                >
                  <td className="px-3 py-1.5 font-medium">
                    {/* The flag repeats the state as a glyph: never colour alone. */}
                    {bad && (
                      <span aria-hidden className="mr-1 font-bold">
                        ⚑
                      </span>
                    )}
                    {v.label.replace(/\s*—\s*eluato$/, "")}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${bad ? "font-bold" : ""}`}>
                    {v.result_raw}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{v.unit}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                    {v.limit_display ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-center">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10.5px] font-semibold ${st.pill}`}>
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function QuadroBlock({ quadro }: { quadro: QuadroData }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const s = STATUS[quadro.overall];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-wide text-slate-800">
        <span aria-hidden>🚦</span> QUADRO DI CONFORMITÀ NORMATIVA
      </div>

      {/* Headline verdict: the single number/state the reader came for. */}
      <div
        className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
        style={{ borderColor: `${s.color}55`, background: `${s.color}12` }}
      >
        <StatusPill status={quadro.overall} size="lg" />
        <span className="text-[13px] font-medium text-slate-700">{quadro.headline}</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-slate-50 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Tabella limiti</th>
              <th className="w-[34%] px-3 py-2">Composizione parametri</th>
              <th className="whitespace-nowrap px-3 py-2 text-right">Valutati</th>
              <th className="px-3 py-2 text-center">Esito</th>
            </tr>
          </thead>
          <tbody>
            {quadro.rows.map((row) => (
              <Fragment key={row.limit_table_id}>
              <tr className="border-t border-slate-100 align-middle">
                <td className="px-3 py-2">
                  <div className="flex items-start gap-2 font-medium text-slate-800">
                    <button
                      onClick={() => setOpen((p) => ({ ...p, [row.limit_table_id]: !p[row.limit_table_id] }))}
                      aria-expanded={Boolean(open[row.limit_table_id])}
                      aria-label={`Dettaglio parametri ${row.table_name}`}
                      className="mt-[1px] shrink-0 rounded px-1 text-[10px] text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <span
                        aria-hidden
                        className={`inline-block transition-transform ${open[row.limit_table_id] ? "rotate-90" : ""}`}
                      >
                        ▶
                      </span>
                    </button>
                    <span
                      aria-hidden
                      className="mt-[6px] inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: STATUS[row.status].color }}
                    />
                    <span>{row.table_name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-[18px] text-[11px] text-slate-500">
                    {row.blocking && (
                      <span className="whitespace-nowrap rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        BLOCCANTE
                      </span>
                    )}
                    <span>
                      {row.offenders.length > 0
                        ? `Fuori limite: ${row.offenders.join(", ")}`
                        : row.normativa}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <CompositionBar row={row} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">
                  {row.evaluated_total}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-center">
                  <StatusPill status={row.status} />
                </td>
              </tr>
              {open[row.limit_table_id] && (
                <tr>
                  <td colSpan={4} className="border-t border-slate-100 p-0">
                    <VerdictDetail row={row} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend: identity is never colour-alone. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {SEGMENTS.map((seg) => (
          <span key={seg.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ background: seg.color }}
            />
            {seg.label}
          </span>
        ))}
      </div>

      {quadro.skipped.length > 0 && (
        <p className="mt-2 text-[11.5px] text-slate-500">
          Non valutabili con i parametri disponibili:{" "}
          {quadro.skipped.map((s) => `${s.table_name} (${s.reason})`).join("; ")}.
        </p>
      )}
    </div>
  );
}

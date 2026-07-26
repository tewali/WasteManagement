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

import type { QuadroData, QuadroRow, QuadroStatus } from "@/lib/types";

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

export default function QuadroBlock({ quadro }: { quadro: QuadroData }) {
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
              <tr key={row.limit_table_id} className="border-t border-slate-100 align-middle">
                <td className="px-3 py-2">
                  <div className="flex items-start gap-2 font-medium text-slate-800">
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

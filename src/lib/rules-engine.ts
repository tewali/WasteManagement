// Deterministic conformity engine.
//
// The AI layer never computes conformity: every verdict comes from this
// module, comparing parsed report parameters against a versioned limit
// table. Semantics (see seed/README.md):
//
// - Only parameters whose basis matches the table's basis are evaluated.
// - Parameter with no entry in the table          -> non_applicabile
// - Result "< LOQ" with LOQ <= limit              -> conforme
// - Result "< LOQ" with LOQ >  limit              -> non_determinato
// - Plain value <= limit (equality included)      -> conforme
// - Plain value >  limit                          -> non_conforme
// - Range entries (e.g. pH): conforme iff min <= value <= max
// - Table entries with no matching parameter are reported as
//   missing_analytes (advisory), not counted in the esito totals.

import type {
  Esito,
  LimitEntry,
  LimitTable,
  ParamVerdict,
  ReportParameter,
  VerificationResult,
} from "./types";

const fmtIt = (n: number) =>
  n.toLocaleString("it-IT", { maximumFractionDigits: 6 });

export function limitDisplay(entry: LimitEntry, tableUnit: string): string {
  if (entry.kind === "range" && entry.min != null && entry.max != null) {
    return `${fmtIt(entry.min)} – ${fmtIt(entry.max)}`;
  }
  return entry.limit != null ? fmtIt(entry.limit) : "—";
}

function evaluate(p: ReportParameter, entry: LimitEntry): { esito: Esito; reason?: string } {
  if (entry.kind === "range" && entry.min != null && entry.max != null) {
    if (p.value >= entry.min && p.value <= entry.max) return { esito: "conforme" };
    return {
      esito: "non_conforme",
      reason: `Valore ${fmtIt(p.value)} fuori dall'intervallo ${fmtIt(entry.min)} – ${fmtIt(entry.max)}`,
    };
  }
  if (entry.limit == null) return { esito: "non_applicabile", reason: "Voce senza limite numerico" };
  if (p.operator === "<") {
    if (p.value <= entry.limit) return { esito: "conforme" };
    return {
      esito: "non_determinato",
      reason: `LOQ (${fmtIt(p.value)}) superiore al limite (${fmtIt(entry.limit)}): richiedere ripetizione con LOQ adeguato`,
    };
  }
  if (p.value <= entry.limit) return { esito: "conforme" };
  return {
    esito: "non_conforme",
    reason: `${fmtIt(p.value)} > ${fmtIt(entry.limit)}`,
  };
}

export function runVerification(
  parameters: ReportParameter[],
  table: LimitTable,
  labelOf: (key: string) => string,
  lineId?: string,
): VerificationResult {
  const entryByKey = new Map(table.entries.map((e) => [e.analyte_key, e]));
  const applicable = parameters.filter((p) => p.basis === table.basis);

  const verdicts: ParamVerdict[] = applicable.map((p) => {
    const entry = entryByKey.get(p.analyte_key);
    if (!entry) {
      return {
        analyte_key: p.analyte_key,
        label: labelOf(p.analyte_key),
        result_raw: p.result_raw,
        operator: p.operator,
        value: p.value,
        unit: p.unit,
        limit_display: null,
        esito: "non_applicabile",
        reason: "Nessun limite in tabella — valore informativo",
      };
    }
    const { esito, reason } = evaluate(p, entry);
    return {
      analyte_key: p.analyte_key,
      label: labelOf(p.analyte_key),
      result_raw: p.result_raw,
      operator: p.operator,
      value: p.value,
      unit: p.unit,
      limit_display: limitDisplay(entry, table.unit),
      esito,
      reason,
    };
  });

  const counts: Record<Esito, number> = {
    conforme: 0,
    non_conforme: 0,
    non_determinato: 0,
    non_applicabile: 0,
  };
  for (const v of verdicts) counts[v.esito]++;

  const covered = new Set(applicable.map((p) => p.analyte_key));
  const missing_analytes = table.entries
    .filter((e) => !covered.has(e.analyte_key))
    .map((e) => ({ analyte_key: e.analyte_key, label: labelOf(e.analyte_key) }));

  const overall = counts.non_conforme > 0 ? "non_conforme" : "conforme";

  return {
    limit_table_id: table.id,
    limit_table_name: table.name,
    normativa: table.normativa,
    table_status: table.status,
    basis: table.basis,
    line_id: lineId,
    verdicts,
    counts,
    evaluated_total: counts.conforme + counts.non_conforme + counts.non_determinato,
    missing_analytes,
    overall,
    blocking: Boolean(table.blocking) && overall === "non_conforme",
    blocking_consequence: table.blocking ? table.blocking_consequence : undefined,
  };
}

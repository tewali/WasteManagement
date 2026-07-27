// Full plant check: the battery of limit tables an uploaded report is measured
// against. "Active in the plant" means bound to a configured line (store.lines(),
// editable since Phase 2) AND currently in force by its validity window.
//
// A report can rarely address every table: the Tabella 5 columns and the POP
// layer are `total` basis, the discarica tables are `eluate`. Running an eluate
// table against a report with no leaching test yields nothing but "non
// applicabile" rows, so those tables are reported as skipped rather than
// rendered as empty verdicts.

import { runVerification } from "./rules-engine";
import { analyteLabel, getTable, standardTableId } from "./seed";
import type {
  Esito,
  LimitTable,
  MatriceData,
  MatriceNorm,
  MatriceRow,
  ParamVerdict,
  PlantLine,
  QuadroData,
  QuadroRow,
  QuadroStatus,
  ReportParameter,
  VerificationResult,
} from "./types";

/** True when `at` falls inside the table's validity window. */
export function isTableInForce(table: LimitTable, at: Date = new Date()): boolean {
  const day = at.toISOString().slice(0, 10);
  if (table.valid_from && day < table.valid_from) return false;
  if (table.valid_to && day > table.valid_to) return false;
  return true;
}

/**
 * Limit tables active in the plant, deduplicated across lines and ordered:
 * the standard table of the destination line first, then the other
 * non-blocking tables, then the blocking layers (POP) last.
 */
export function activeLimitTables(
  lines: PlantLine[],
  lineId?: string | null,
  at: Date = new Date(),
): LimitTable[] {
  const seen = new Set<string>();
  const out: LimitTable[] = [];
  const push = (id: string) => {
    if (seen.has(id)) return;
    const table = getTable(id);
    if (!table || !isTableInForce(table, at)) return;
    seen.add(id);
    out.push(table);
  };

  push(standardTableId(lineId, lines));
  for (const line of lines) {
    for (const b of line.limit_bindings.filter((x) => !x.blocking)) push(b.limit_table_id);
  }
  for (const line of lines) {
    for (const b of line.limit_bindings.filter((x) => x.blocking)) push(b.limit_table_id);
  }
  return out;
}

export interface PlantCheck {
  /** Verdicts for the tables the report can actually address. */
  verifications: VerificationResult[];
  /** Active tables left unevaluated, with the reason. */
  skipped: { table: LimitTable; reason: string }[];
}

/** Runs every active plant table against the report's parameters. */
export function runPlantCheck(
  parameters: ReportParameter[],
  lines: PlantLine[],
  lineId?: string | null,
  at: Date = new Date(),
): PlantCheck {
  const verifications: VerificationResult[] = [];
  const skipped: PlantCheck["skipped"] = [];

  for (const table of activeLimitTables(lines, lineId, at)) {
    const v = runVerification(parameters, table, analyteLabel, lineId ?? undefined);
    if (v.evaluated_total === 0) {
      skipped.push({
        table,
        reason:
          table.basis === "eluate"
            ? "richiede i risultati sull'eluato (test di cessione), assenti nel rapporto"
            : "nessun parametro del rapporto rientra fra quelli previsti dalla tabella",
      });
      continue;
    }
    verifications.push(v);
  }
  return { verifications, skipped };
}

/** Short table name for prose: drops the parenthetical. */
export const shortTableName = (name: string) => name.split("(")[0].trim();

/**
 * Stoplight for a single table.
 *  bloccante    — a blocking layer (POP) is exceeded: no destination at all
 *  non_conforme — at least one parameter over the limit
 *  riserve      — within limits, but some parameter could not be determined
 *                 (LOQ above the limit), so adherence is not demonstrated
 *  conforme     — every evaluated parameter within limits
 */
function rowStatus(v: VerificationResult): QuadroStatus {
  if (v.overall === "non_conforme") return v.blocking ? "bloccante" : "non_conforme";
  return v.counts.non_determinato > 0 ? "riserve" : "conforme";
}

/**
 * Aggregated compliance picture across the active tables: one stoplight per
 * table plus the overall verdict. A blocking exceedance dominates everything;
 * otherwise the plant is only fully green when every table is clean.
 */
/** Worst first: what fails is what the operator needs to see without scrolling. */
const VERDICT_ORDER: Record<Esito, number> = {
  non_conforme: 0,
  non_determinato: 1,
  conforme: 2,
  non_applicabile: 3,
};

function detailVerdicts(v: VerificationResult): ParamVerdict[] {
  return v.verdicts
    .filter((x) => x.esito !== "non_applicabile")
    .slice()
    .sort((a, b) => VERDICT_ORDER[a.esito] - VERDICT_ORDER[b.esito]);
}

export function buildQuadro(check: PlantCheck): QuadroData {
  const rows: QuadroRow[] = check.verifications.map((v) => ({
    verdicts: detailVerdicts(v),
    limit_table_id: v.limit_table_id,
    table_name: shortTableName(v.limit_table_name),
    normativa: v.normativa.split("(")[0].trim(),
    status: rowStatus(v),
    blocking: Boolean(v.blocking) || v.limit_table_id.startsWith("pop"),
    counts: v.counts,
    evaluated_total: v.evaluated_total,
    offenders: v.verdicts
      .filter((x) => x.esito === "non_conforme")
      .map((x) => x.label.replace(/\s*\(.*\)$/, "")),
  }));

  const total = rows.length;
  const green = rows.filter((r) => r.status === "conforme").length;
  const usable = rows.filter((r) => r.status === "conforme" || r.status === "riserve").length;
  const blocked = rows.some((r) => r.status === "bloccante");

  let overall: QuadroStatus;
  let headline: string;
  if (blocked) {
    overall = "bloccante";
    headline = "Vincolo bloccante superato — il rifiuto non è avviabile né a recupero né a discarica.";
  } else if (total === 0) {
    overall = "riserve";
    headline = "Nessuna tabella attiva è valutabile con i parametri disponibili.";
  } else if (green === total) {
    overall = "conforme";
    headline = `Conforme a tutte le ${total} tabelle limiti attive valutate.`;
  } else if (usable === 0) {
    overall = "non_conforme";
    headline = `Non conforme a nessuna delle ${total} tabelle limiti attive valutate.`;
  } else {
    overall = "riserve";
    headline = `Conforme a ${usable} tabelle su ${total}: la destinazione va scelta fra quelle rispettate.`;
  }

  return {
    overall,
    headline,
    rows,
    skipped: check.skipped.map((s) => ({
      table_name: shortTableName(s.table.name),
      reason: s.reason,
    })),
  };
}

/** Compact column head for a norm — the full name lives in the legend. */
export function shortNormLabel(table: { id: string; name: string }): string {
  if (table.id.endsWith("colA")) return "Tab. 5 — Col. A";
  if (table.id.endsWith("colB")) return "Tab. 5 — Col. B";
  if (table.id.includes("inerti")) return "Disc. inerti";
  if (table.id.includes("non-pericolosi")) return "Disc. non peric.";
  if (table.id.startsWith("pop")) return "Vincolo POP";
  return shortTableName(table.name);
}

/**
 * One column per piece of legislation, one row per measured parameter.
 * Norms the report cannot address keep their column — marked non applicabile
 * with the reason — so a missing check is visible rather than absent.
 */
export function buildMatrice(check: PlantCheck): MatriceData {
  const norms: MatriceNorm[] = [
    ...check.verifications.map((v) => ({
      limit_table_id: v.limit_table_id,
      short_label: shortNormLabel({ id: v.limit_table_id, name: v.limit_table_name }),
      name: shortTableName(v.limit_table_name),
      normativa: v.normativa.split("(")[0].trim(),
      basis: v.basis,
      unit: getTable(v.limit_table_id)?.unit ?? "",
      blocking: Boolean(getTable(v.limit_table_id)?.blocking),
      applicable: true,
      status: rowStatus(v),
    })),
    ...check.skipped.map((s) => ({
      limit_table_id: s.table.id,
      short_label: shortNormLabel(s.table),
      name: shortTableName(s.table.name),
      normativa: s.table.normativa.split("(")[0].trim(),
      basis: s.table.basis,
      unit: s.table.unit,
      blocking: Boolean(s.table.blocking),
      applicable: false,
      reason: s.reason,
      status: null,
    })),
  ];

  // Every measured parameter, looked up in each applicable norm.
  const byTable = new Map(
    check.verifications.map((v) => [
      v.limit_table_id,
      new Map(v.verdicts.map((x) => [x.analyte_key, x])),
    ]),
  );
  const template = check.verifications[0]?.verdicts ?? [];

  const rows: MatriceRow[] = template.map((p) => {
    const cells = norms.map((n) => {
      if (!n.applicable) return { esito: null, limit_display: null };
      const v = byTable.get(n.limit_table_id)?.get(p.analyte_key);
      if (!v || v.esito === "non_applicabile") return { esito: null, limit_display: null };
      return { esito: v.esito, limit_display: v.limit_display };
    });
    const esiti = cells.map((c) => c.esito).filter(Boolean) as Esito[];
    const worst =
      esiti.sort((a, b) => VERDICT_ORDER[a] - VERDICT_ORDER[b])[0] ?? ("non_applicabile" as Esito);
    return {
      analyte_key: p.analyte_key,
      label: p.label,
      result_raw: p.result_raw,
      unit: p.unit,
      cells,
      worst,
    };
  });

  rows.sort((a, b) => VERDICT_ORDER[a.worst] - VERDICT_ORDER[b.worst]);
  return { norms, rows };
}

/** One-line-per-table recap used by the conclusione block. */
export function plantCheckLines(check: PlantCheck): string[] {
  return check.verifications.map((v) => {
    const name = shortTableName(v.limit_table_name);
    if (v.overall === "conforme") {
      const nd = v.counts.non_determinato;
      return nd > 0
        ? `${name}: conforme (${nd} parametr${nd === 1 ? "o" : "i"} non determinat${nd === 1 ? "o" : "i"})`
        : `${name}: conforme`;
    }
    const nc = v.verdicts.filter((x) => x.esito === "non_conforme");
    return `${name}: NON conforme — ${nc.map((x) => x.label.replace(/\s*\(.*\)$/, "")).join(", ")}`;
  });
}

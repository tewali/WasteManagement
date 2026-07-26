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
  LimitTable,
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
export function buildQuadro(check: PlantCheck): QuadroData {
  const rows: QuadroRow[] = check.verifications.map((v) => ({
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

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
import type { LimitTable, PlantLine, ReportParameter, VerificationResult } from "./types";

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

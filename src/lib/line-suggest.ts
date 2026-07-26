// Line suggestion (Phase 2): which plant line can accept a waste?
// Deterministic — EER admissibility per line, blocking POP layer, then the
// verdict against each bound limit table via the rules engine.

import { runVerification } from "./rules-engine";
import { analyteLabel, getTable } from "./seed";
import { store } from "./store";
import type { AnalysisRecord, PlantLine, VerificationResult } from "./types";

export interface LineSuggestion {
  line: PlantLine;
  eer_admissible: boolean;
  pop_blocked: boolean;
  /** Verdict per non-blocking bound table (skipped when POP blocks). */
  table_results: {
    limit_table_id: string;
    name: string;
    purpose: string;
    overall: "conforme" | "non_conforme";
    counts: VerificationResult["counts"];
  }[];
  /** Overall recommendation for this line. */
  esito: "accettabile" | "accettabile_con_riserva" | "non_accettabile" | "eer_non_ammesso";
  motivo: string;
}

export function suggestLines(analysis: AnalysisRecord): LineSuggestion[] {
  const eer = analysis.header.eer_declared.trim();
  return store.lines().map((line) => {
    const eerAdmissible = line.admissible_eer.some(
      (code) => code.replace(/\s+/g, "") === eer.replace(/\s+/g, ""),
    );
    if (!eerAdmissible) {
      return {
        line,
        eer_admissible: false,
        pop_blocked: false,
        table_results: [],
        esito: "eer_non_ammesso" as const,
        motivo: `Il codice EER ${eer} non è tra quelli ammessi sulla linea.`,
      };
    }

    // Blocking layer first (POP).
    let popBlocked = false;
    let popMotivo = "";
    for (const binding of line.limit_bindings.filter((b) => b.blocking)) {
      const table = getTable(binding.limit_table_id);
      if (!table) continue;
      const v = runVerification(analysis.parameters, table, analyteLabel, line.id);
      if (v.overall === "non_conforme") {
        popBlocked = true;
        popMotivo =
          v.blocking_consequence ??
          `Superati i limiti bloccanti della tabella ${table.name}.`;
        break;
      }
    }
    if (popBlocked) {
      return {
        line,
        eer_admissible: true,
        pop_blocked: true,
        table_results: [],
        esito: "non_accettabile" as const,
        motivo: popMotivo,
      };
    }

    const tableResults = line.limit_bindings
      .filter((b) => !b.blocking)
      .flatMap((binding) => {
        const table = getTable(binding.limit_table_id);
        if (!table) return [];
        const v = runVerification(analysis.parameters, table, analyteLabel, line.id);
        if (v.evaluated_total === 0) return []; // wrong basis for this report
        return [
          {
            limit_table_id: table.id,
            name: table.name.split("(")[0].trim(),
            purpose: binding.purpose,
            overall: v.overall,
            counts: v.counts,
          },
        ];
      });

    const anyConforme = tableResults.some((t) => t.overall === "conforme");
    const allNonConforme = tableResults.length > 0 && !anyConforme;
    const esito = allNonConforme
      ? ("non_accettabile" as const)
      : anyConforme
        ? ("accettabile" as const)
        : ("accettabile_con_riserva" as const);
    const motivo = allNonConforme
      ? "Nessuna delle tabelle di riferimento della linea è rispettata."
      : anyConforme
        ? `Conforme a: ${tableResults
            .filter((t) => t.overall === "conforme")
            .map((t) => t.name)
            .join("; ")}.`
        : "Nessuna tabella valutabile con i parametri disponibili: servono determinazioni aggiuntive.";
    return {
      line,
      eer_admissible: true,
      pop_blocked: false,
      table_results: tableResults,
      esito,
      motivo,
    };
  });
}

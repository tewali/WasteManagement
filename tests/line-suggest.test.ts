// Line suggestion (Phase 2): EER admissibility + POP blocking + table verdicts.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { suggestLines } from "@/lib/line-suggest";
import type { AnalysisRecord } from "@/lib/types";

const SEED = path.join(__dirname, "..", "seed");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));

function analysisFrom(fixtureId: string): AnalysisRecord {
  const report = fs
    .readdirSync(path.join(SEED, "reports"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(path.join(SEED, "reports", f)))
    .find((r) => r.id === fixtureId)!;
  return {
    id: "test",
    document_id: "test",
    header: report.extraction.header,
    parameters: report.extraction.parameters,
    edited: false,
  };
}

describe("suggestLines", () => {
  it("R1 (17 09 03*): EER admissible on Soil Washing, POP not blocking", () => {
    const suggestions = suggestLines(analysisFrom("R1"));
    const l1 = suggestions.find((s) => s.line.id === "L1-soil-washing")!;
    expect(l1.eer_admissible).toBe(true);
    expect(l1.pop_blocked).toBe(false);
    // colA is non conforme (Hg, Zn), colB conforme -> accettabile overall
    const colA = l1.table_results.find((t) => t.limit_table_id === "tab5-121-2020-colA")!;
    const colB = l1.table_results.find((t) => t.limit_table_id === "tab5-121-2020-colB")!;
    expect(colA.overall).toBe("non_conforme");
    expect(colB.overall).toBe("conforme");
    expect(l1.esito).toBe("accettabile");
  });

  it("R3 (PFOA 4,2 mg/kg): POP blocks the line despite col. B conformity", () => {
    const suggestions = suggestLines(analysisFrom("R3"));
    const l1 = suggestions.find((s) => s.line.id === "L1-soil-washing")!;
    expect(l1.eer_admissible).toBe(true);
    expect(l1.pop_blocked).toBe(true);
    expect(l1.esito).toBe("non_accettabile");
  });

  it("R4 (19 12 12): EER not admissible on the Soil Washing line", () => {
    const suggestions = suggestLines(analysisFrom("R4"));
    const l1 = suggestions.find((s) => s.line.id === "L1-soil-washing")!;
    expect(l1.eer_admissible).toBe(false);
    expect(l1.esito).toBe("eer_non_ammesso");
  });
});

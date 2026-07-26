// Acceptance tests: the rules engine must reproduce the `expected` block of
// every seed report fixture (R1-R4), for every verification listed.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { runVerification } from "@/lib/rules-engine";
import type { LimitTable, ReportParameter } from "@/lib/types";

const SEED = path.join(__dirname, "..", "seed");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));

const analytes: { key: string; label: string }[] = readJson(path.join(SEED, "analytes.json")).analytes;
const labelOf = (key: string) => analytes.find((a) => a.key === key)?.label ?? key;

const tables: LimitTable[] = fs
  .readdirSync(path.join(SEED, "limit-tables"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson(path.join(SEED, "limit-tables", f)));

const reports = fs
  .readdirSync(path.join(SEED, "reports"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson(path.join(SEED, "reports", f)));

interface ExpectedVerification {
  limit_table_id: string;
  counts: Record<string, number>;
  overall: string;
  blocking?: boolean;
  non_conformi?: { analyte_key: string; value: number; limit: number }[];
  non_determinati?: { analyte_key: string }[];
  non_applicabili?: { analyte_key: string }[];
}

describe("rules engine reproduces seed fixture verdicts", () => {
  for (const report of reports) {
    const params: ReportParameter[] = report.extraction.parameters;
    for (const exp of report.expected.verifications as ExpectedVerification[]) {
      it(`${report.id} vs ${exp.limit_table_id}`, () => {
        const table = tables.find((t) => t.id === exp.limit_table_id);
        expect(table, `table ${exp.limit_table_id} exists`).toBeDefined();
        const result = runVerification(params, table!, labelOf);

        expect(result.counts.conforme).toBe(exp.counts.conforme);
        expect(result.counts.non_conforme).toBe(exp.counts.non_conforme);
        expect(result.counts.non_determinato).toBe(exp.counts.non_determinato);
        expect(result.counts.non_applicabile).toBe(exp.counts.non_applicabile);
        expect(result.overall).toBe(exp.overall);
        if (exp.blocking) expect(result.blocking).toBe(true);

        const byEsito = (esito: string) =>
          result.verdicts.filter((v) => v.esito === esito).map((v) => v.analyte_key).sort();
        if (exp.non_conformi) {
          expect(byEsito("non_conforme")).toEqual(exp.non_conformi.map((n) => n.analyte_key).sort());
        }
        if (exp.non_determinati) {
          expect(byEsito("non_determinato")).toEqual(exp.non_determinati.map((n) => n.analyte_key).sort());
        }
      });
    }
  }

  it("R1 matches the UI mock-up totals (18/2/3 of 23)", () => {
    const r1 = reports.find((r) => r.id === "R1")!;
    const table = tables.find((t) => t.id === "tab5-121-2020-colA")!;
    const result = runVerification(r1.extraction.parameters, table, labelOf);
    expect(result.evaluated_total).toBe(23);
    expect(result.counts).toEqual({
      conforme: 18,
      non_conforme: 2,
      non_determinato: 3,
      non_applicabile: 0,
    });
    const nc = result.verdicts.filter((v) => v.esito === "non_conforme").map((v) => v.analyte_key);
    expect(nc.sort()).toEqual(["mercurio", "zinco"]);
  });
});

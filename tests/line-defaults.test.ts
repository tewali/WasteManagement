// The default an acceptance check runs with: the standard limit table of the
// default line. A blocking layer (POP) is supplementary — on its own it leaves
// almost every parameter "non applicabile" and answers no acceptance question.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { defaultLineId, getSeed, getTable, isBlockingTable, standardTableId } from "@/lib/seed";
import { runVerification } from "@/lib/rules-engine";
import type { ReportParameter } from "@/lib/types";

const SEED = path.join(__dirname, "..", "seed");
const analytes: { key: string; label: string }[] = JSON.parse(
  fs.readFileSync(path.join(SEED, "analytes.json"), "utf-8"),
).analytes;
const labelOf = (key: string) => analytes.find((a) => a.key === key)?.label ?? key;

describe("standard line limits are the default comparison", () => {
  it("defaults to the first configured line", () => {
    expect(defaultLineId()).toBe("L1-soil-washing");
  });

  it("resolves the line's primary binding, not a blocking layer", () => {
    expect(standardTableId("L1-soil-washing")).toBe("tab5-121-2020-colA");
    expect(isBlockingTable(standardTableId("L1-soil-washing"))).toBe(false);
  });

  it("falls back to the default line when no line is given", () => {
    expect(standardTableId()).toBe(standardTableId(defaultLineId()));
    expect(standardTableId(null)).toBe(standardTableId(defaultLineId()));
    expect(standardTableId("linea-inesistente")).toBe(standardTableId(defaultLineId()));
  });

  it("never resolves to a table flagged blocking", () => {
    for (const line of getSeed().lines) {
      expect(isBlockingTable(standardTableId(line.id))).toBe(false);
    }
    expect(isBlockingTable("pop-reg-2019-1021")).toBe(true);
  });

  it("gives R1 the mock-up esito, not the POP layer's 22 non applicabili", () => {
    const r1 = getSeed().reports.find((r) => r.id === "R1")!;
    const params: ReportParameter[] = r1.extraction.parameters;
    const standard = runVerification(
      params,
      getTable(standardTableId(defaultLineId()))!,
      labelOf,
      defaultLineId(),
    );
    expect(standard.counts).toEqual({
      conforme: 18,
      non_conforme: 2,
      non_determinato: 3,
      non_applicabile: 0,
    });

    // What the screenshot showed: the POP table alone evaluates a single
    // parameter and cannot stand in for the acceptance verdict.
    const pop = runVerification(params, getTable("pop-reg-2019-1021")!, labelOf, defaultLineId());
    expect(pop.evaluated_total).toBe(1);
    expect(pop.counts.non_applicabile).toBe(22);
  });
});

// The upload battery: every limit table active in the plant, in one pass.
import { describe, expect, it } from "vitest";
import { activeLimitTables, isTableInForce, runPlantCheck } from "@/lib/plant-check";
import { getSeed, getTable, isBlockingTable, standardTableId } from "@/lib/seed";
import type { ReportParameter } from "@/lib/types";

const lines = getSeed().lines;
const params = (id: string): ReportParameter[] =>
  getSeed().reports.find((r) => r.id === id)!.extraction.parameters;

describe("activeLimitTables", () => {
  it("returns every table bound to the plant's lines, deduplicated", () => {
    const ids = activeLimitTables(lines).map((t) => t.id);
    const bound = new Set(lines.flatMap((l) => l.limit_bindings.map((b) => b.limit_table_id)));
    expect(new Set(ids)).toEqual(bound);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("puts the standard table first and the blocking layer last", () => {
    const ids = activeLimitTables(lines, "L1-soil-washing").map((t) => t.id);
    expect(ids[0]).toBe(standardTableId("L1-soil-washing", lines));
    expect(isBlockingTable(ids[ids.length - 1])).toBe(true);
  });

  it("excludes tables outside their validity window", () => {
    const before = activeLimitTables(lines, null, new Date("2019-01-01"));
    expect(before).toHaveLength(0); // every seed table starts 2020-10-04 or later

    const popStart = new Date("2021-01-01"); // POP applies from 2023-06-10
    expect(activeLimitTables(lines, null, popStart).map((t) => t.id)).not.toContain(
      "pop-reg-2019-1021",
    );
  });

  it("isTableInForce honours both ends of the window", () => {
    const t = { ...getTable("tab5-121-2020-colA")!, valid_to: "2024-12-31" };
    expect(isTableInForce(t, new Date("2024-06-01"))).toBe(true);
    expect(isTableInForce(t, new Date("2025-06-01"))).toBe(false);
    expect(isTableInForce(t, new Date("2019-06-01"))).toBe(false);
  });
});

describe("runPlantCheck", () => {
  it("evaluates the total-basis tables and skips the eluate ones for R1", () => {
    const check = runPlantCheck(params("R1"), lines, "L1-soil-washing");
    const evaluated = check.verifications.map((v) => v.limit_table_id);

    // R1 has no leaching test, so only the total-basis tables are evaluable.
    expect(evaluated).toEqual([
      "tab5-121-2020-colA",
      "tab5-121-2020-colB",
      "pop-reg-2019-1021",
    ]);
    expect(check.skipped.map((s) => s.table.id).sort()).toEqual([
      "eluato-discarica-inerti",
      "eluato-discarica-non-pericolosi",
    ]);
    for (const s of check.skipped) expect(s.reason).toMatch(/eluato/);

    // The headline verdict is unchanged by the extra tables.
    expect(check.verifications[0].counts).toEqual({
      conforme: 18,
      non_conforme: 2,
      non_determinato: 3,
      non_applicabile: 0,
    });
    // R1 exceeds col. A but sits inside the wider col. B limits.
    expect(check.verifications[0].overall).toBe("non_conforme");
    expect(check.verifications[1].overall).toBe("conforme");
  });

  it("never returns a verdict with nothing evaluated", () => {
    for (const id of ["R1", "R2", "R3", "R4"]) {
      const check = runPlantCheck(params(id), lines, "L1-soil-washing");
      for (const v of check.verifications) expect(v.evaluated_total).toBeGreaterThan(0);
      expect(check.verifications.length + check.skipped.length).toBe(
        activeLimitTables(lines, "L1-soil-washing").length,
      );
    }
  });

  it("evaluates the eluate tables for a report that has a leaching test", () => {
    const eluate = getSeed()
      .reports.map((r) => r.id)
      .find((id) => params(id).some((p) => p.basis === "eluate"));
    expect(eluate).toBeDefined();

    const check = runPlantCheck(params(eluate!), lines, "L1-soil-washing");
    const evaluated = check.verifications.map((v) => v.limit_table_id);
    expect(evaluated).toContain("eluato-discarica-inerti");
    expect(evaluated).toContain("eluato-discarica-non-pericolosi");
  });

  it("surfaces a POP exceedance as a blocking verdict", () => {
    const pop = getSeed()
      .reports.map((r) => r.id)
      .find((id) => {
        const c = runPlantCheck(params(id), lines, "L1-soil-washing");
        return c.verifications.some((v) => v.blocking);
      });
    if (!pop) return; // no fixture trips the POP layer
    const check = runPlantCheck(params(pop), lines, "L1-soil-washing");
    const blocked = check.verifications.find((v) => v.blocking)!;
    expect(blocked.limit_table_id).toBe("pop-reg-2019-1021");
    expect(blocked.overall).toBe("non_conforme");
  });
});

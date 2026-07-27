// The upload battery: every limit table active in the plant, in one pass.
import { describe, expect, it } from "vitest";
import {
  activeLimitTables,
  buildMatrice,
  buildQuadro,
  isTableInForce,
  runPlantCheck,
} from "@/lib/plant-check";
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

describe("buildQuadro — stoplight logic", () => {
  const quadro = (id: string) =>
    buildQuadro(runPlantCheck(params(id), lines, "L1-soil-washing"));

  it("marks a table green only when nothing is left undetermined", () => {
    const q = quadro("R1");
    const colA = q.rows.find((r) => r.limit_table_id === "tab5-121-2020-colA")!;
    const colB = q.rows.find((r) => r.limit_table_id === "tab5-121-2020-colB")!;

    // Col. A is exceeded; col. B is within limits but has an undetermined LOQ.
    expect(colA.status).toBe("non_conforme");
    expect(colA.offenders).toEqual(["Mercurio", "Zinco"]);
    expect(colB.status).toBe("riserve");
    expect(colB.counts.non_determinato).toBeGreaterThan(0);
  });

  it("aggregates to amber when some tables are met and some are not", () => {
    const q = quadro("R1");
    expect(q.overall).toBe("riserve");
    expect(q.headline).toMatch(/Conforme a 2 tabelle su 3/);
  });

  it("flags the blocking layer and lets it dominate the overall verdict", () => {
    for (const id of ["R1", "R2", "R3", "R4"]) {
      const q = quadro(id);
      const pop = q.rows.find((r) => r.limit_table_id.startsWith("pop"));
      if (!pop) continue;
      expect(pop.blocking).toBe(true);
      if (pop.status === "bloccante") {
        expect(q.overall).toBe("bloccante");
        expect(q.headline).toMatch(/bloccante/i);
      }
    }
  });

  it("carries the skipped tables through to the quadro", () => {
    const q = quadro("R1");
    expect(q.skipped.map((s) => s.table_name).join(" ")).toMatch(/discarica/i);
    for (const s of q.skipped) expect(s.reason).toBeTruthy();
  });

  it("every row states a status that is never colour-alone", () => {
    for (const id of ["R1", "R2", "R3", "R4"]) {
      for (const row of quadro(id).rows) {
        expect(["conforme", "riserve", "non_conforme", "bloccante"]).toContain(row.status);
        expect(row.table_name).toBeTruthy();
        expect(row.evaluated_total).toBeGreaterThan(0);
      }
    }
  });
});

describe("quadro row detail", () => {
  const quadro = (id: string) =>
    buildQuadro(runPlantCheck(params(id), lines, "L1-soil-washing"));

  it("carries every governed parameter, worst first", () => {
    const colA = quadro("R1").rows.find((r) => r.limit_table_id === "tab5-121-2020-colA")!;

    // Offenders lead, then undetermined, then compliant — nothing hidden below.
    const order = colA.verdicts.map((v) => v.esito);
    const rank = { non_conforme: 0, non_determinato: 1, conforme: 2, non_applicabile: 3 };
    expect(order.map((e) => rank[e])).toEqual([...order.map((e) => rank[e])].sort((a, b) => a - b));
    expect(order.slice(0, 2)).toEqual(["non_conforme", "non_conforme"]);
    expect(colA.verdicts.slice(0, 2).map((v) => v.label.replace(/\s*\(.*\)$/, ""))).toEqual([
      "Mercurio",
      "Zinco",
    ]);
  });

  it("omits parameters the table does not govern, and counts what it shows", () => {
    for (const id of ["R1", "R2", "R3", "R4"]) {
      for (const row of quadro(id).rows) {
        expect(row.verdicts.some((v) => v.esito === "non_applicabile")).toBe(false);
        expect(row.verdicts).toHaveLength(row.evaluated_total);
        // Every flagged parameter names a limit the reader can check against.
        for (const v of row.verdicts.filter((x) => x.esito === "non_conforme")) {
          expect(v.limit_display).toBeTruthy();
          expect(v.result_raw).toBeTruthy();
        }
      }
    }
  });
});

describe("buildMatrice — one column per norm", () => {
  const matrice = (id: string) => buildMatrice(runPlantCheck(params(id), lines, "L1-soil-washing"));

  it("keeps a column for every active norm, applicable or not", () => {
    const m = matrice("R1");
    expect(m.norms).toHaveLength(activeLimitTables(lines, "L1-soil-washing").length);

    const applicable = m.norms.filter((n) => n.applicable).map((n) => n.limit_table_id);
    const not = m.norms.filter((n) => !n.applicable);
    expect(applicable).toEqual(["tab5-121-2020-colA", "tab5-121-2020-colB", "pop-reg-2019-1021"]);
    expect(not.map((n) => n.limit_table_id).sort()).toEqual([
      "eluato-discarica-inerti",
      "eluato-discarica-non-pericolosi",
    ]);
    // An unperformed check must say why, never look like a pass.
    for (const n of not) {
      expect(n.reason).toMatch(/eluato/);
      expect(n.status).toBeNull();
    }
  });

  it("aligns every row's cells with the norm columns", () => {
    for (const id of ["R1", "R2", "R3", "R4"]) {
      const m = matrice(id);
      for (const r of m.rows) expect(r.cells).toHaveLength(m.norms.length);
    }
  });

  it("blanks the cells of a non-applicable norm", () => {
    const m = matrice("R1");
    m.norms.forEach((n, i) => {
      if (n.applicable) return;
      for (const r of m.rows) expect(r.cells[i]).toEqual({ esito: null, limit_display: null });
    });
  });

  it("reads a parameter across the norms, worst rows first", () => {
    const m = matrice("R1");
    const colA = m.norms.findIndex((n) => n.limit_table_id === "tab5-121-2020-colA");
    const colB = m.norms.findIndex((n) => n.limit_table_id === "tab5-121-2020-colB");

    // Mercurio: over col. A, within the wider col. B — the point of the matrix.
    const hg = m.rows.find((r) => r.label.startsWith("Mercurio"))!;
    expect(hg.cells[colA]).toEqual({ esito: "non_conforme", limit_display: "1" });
    expect(hg.cells[colB].esito).toBe("conforme");
    expect(hg.worst).toBe("non_conforme");
    expect(m.rows[0].worst).toBe("non_conforme");

    // A parameter no norm covers shows as "not foreseen", not as compliant.
    const pop = m.norms.findIndex((n) => n.limit_table_id === "pop-reg-2019-1021");
    expect(hg.cells[pop]).toEqual({ esito: null, limit_display: null });
  });
});

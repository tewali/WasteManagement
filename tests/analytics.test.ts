// Dashboard aggregations (Phase 3).
import { describe, expect, it } from "vitest";
import { esitoStats, lineUtilization, monthlyTonnage, topEer } from "@/lib/analytics";
import type { MovementRecord, PlantLine, VerificationRecord } from "@/lib/types";

function mov(over: Partial<MovementRecord>): MovementRecord {
  return {
    id: "m",
    fir_number: "F",
    date: "2026-07-01",
    producer_id: null,
    producer_name: "P",
    transporter: { name: "T", albo_number: "", plate: "" },
    eer: "17 05 04",
    description: "",
    line_id: "L1",
    omologa_id: null,
    quantity_declared_kg: 10000,
    quantity_weighed_kg: null,
    status: "accettato",
    rentri: null,
    created_at: "2026-07-01T08:00:00.000Z",
    created_by: "t",
    ...over,
  };
}

const NOW = new Date("2026-07-26T12:00:00Z");

describe("monthlyTonnage", () => {
  it("buckets accepted movements into the trailing window, weighed first", () => {
    const buckets = monthlyTonnage(
      [
        mov({ date: "2026-07-10", quantity_declared_kg: 10000, quantity_weighed_kg: 9000 }),
        mov({ date: "2026-07-20", quantity_declared_kg: 5000 }),
        mov({ date: "2026-06-15", quantity_declared_kg: 2000, status: "respinto" }),
        mov({ date: "2025-06-15", quantity_declared_kg: 99000 }), // outside the window
      ],
      NOW,
      12,
    );
    expect(buckets).toHaveLength(12);
    const july = buckets.find((b) => b.month === "2026-07")!;
    expect(july.tonnes).toBe(14); // 9 t weighed + 5 t declared
    expect(july.movements).toBe(2);
    const june = buckets.find((b) => b.month === "2026-06")!;
    expect(june.tonnes).toBe(0); // rejected loads don't count
    expect(buckets[0].month).toBe("2025-08");
  });
});

describe("topEer", () => {
  it("ranks by accepted tonnage", () => {
    const shares = topEer([
      mov({ eer: "17 05 04", quantity_declared_kg: 10000 }),
      mov({ eer: "17 09 04", quantity_declared_kg: 30000 }),
      mov({ eer: "17 05 04", quantity_declared_kg: 5000 }),
      mov({ eer: "17 05 03*", quantity_declared_kg: 99000, status: "in_arrivo" }),
    ]);
    expect(shares.map((s) => s.eer)).toEqual(["17 09 04", "17 05 04"]);
    expect(shares[1]).toMatchObject({ tonnes: 15, movements: 2 });
  });
});

describe("lineUtilization", () => {
  it("computes the YTD ratio against the authorized capacity", () => {
    const lines = [
      { id: "L1", name: "Linea 1", annual_capacity_t: 100 } as PlantLine,
    ];
    const [u] = lineUtilization(
      [
        mov({ line_id: "L1", date: "2026-03-01", quantity_declared_kg: 40000 }),
        mov({ line_id: "L1", date: "2025-03-01", quantity_declared_kg: 40000 }), // previous year
        mov({ line_id: "L1", date: "2026-04-01", quantity_declared_kg: 80000 }),
      ],
      lines,
      2026,
    );
    expect(u.tonnes_ytd).toBe(120);
    expect(u.ratio).toBeCloseTo(1.2);
    expect(u.pct).toBe(1); // capped for rendering
  });
});

describe("esitoStats", () => {
  it("splits outcomes and counts blocking failures", () => {
    const v = (overall: "conforme" | "non_conforme", blocking = false) =>
      ({ overall, blocking }) as VerificationRecord;
    expect(esitoStats([v("conforme"), v("non_conforme"), v("non_conforme", true)])).toEqual({
      total: 3,
      conformi: 1,
      non_conformi: 2,
      di_cui_bloccanti: 1,
    });
  });
});

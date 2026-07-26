// Movimenti / FIR (Phase 3): FIR numbering, registro cronologico numbering,
// weighbridge CSV parsing and the discrepancy rule.
import { describe, expect, it } from "vitest";
import {
  hasWeighDiscrepancy,
  nextFirNumber,
  parseWeighbridgeCsv,
  registroCsv,
  registroEntries,
} from "@/lib/movements";
import type { MovementRecord } from "@/lib/types";

function mov(over: Partial<MovementRecord>): MovementRecord {
  return {
    id: "mov-x",
    fir_number: "FIR-SIM-2026-0001",
    date: "2026-01-10",
    producer_id: null,
    producer_name: "Produttore",
    transporter: { name: "Trasporti", albo_number: "MI00001", plate: "AA 000 AA" },
    eer: "17 05 04",
    description: "Terre",
    line_id: "L1-soil-washing",
    omologa_id: null,
    quantity_declared_kg: 10000,
    quantity_weighed_kg: null,
    status: "accettato",
    rentri: null,
    created_at: "2026-01-10T08:00:00.000Z",
    created_by: "Test",
    ...over,
  };
}

describe("FIR numbering", () => {
  it("continues the progressive per year and pads to 4 digits", () => {
    const existing = [
      mov({ fir_number: "FIR-SIM-2026-0007" }),
      mov({ fir_number: "FIR-SIM-2026-0002" }),
      mov({ fir_number: "FIR-SIM-2025-0099" }),
    ];
    expect(nextFirNumber(existing, 2026)).toBe("FIR-SIM-2026-0008");
    expect(nextFirNumber(existing, 2025)).toBe("FIR-SIM-2025-0100");
    expect(nextFirNumber(existing, 2027)).toBe("FIR-SIM-2027-0001");
  });
});

describe("registro cronologico", () => {
  it("numbers accepted movements chronologically, per calendar year", () => {
    const movements = [
      mov({ id: "c", date: "2026-02-01", fir_number: "F3" }),
      mov({ id: "a", date: "2026-01-05", fir_number: "F1" }),
      mov({ id: "r", date: "2026-01-20", fir_number: "FX", status: "respinto" }),
      mov({ id: "w", date: "2026-01-25", fir_number: "FW", status: "in_arrivo" }),
      mov({ id: "b", date: "2026-01-15", fir_number: "F2" }),
      mov({ id: "z", date: "2025-12-30", fir_number: "F0" }),
    ];
    const entries = registroEntries(movements);
    expect(entries.map((e) => [e.fir_number, e.progressivo, e.year])).toEqual([
      ["F0", 1, 2025],
      ["F1", 1, 2026],
      ["F2", 2, 2026],
      ["F3", 3, 2026],
    ]);
  });

  it("uses the weighed quantity when available and exports CSV", () => {
    const entries = registroEntries([
      mov({ quantity_declared_kg: 10000, quantity_weighed_kg: 9800 }),
    ]);
    expect(entries[0].quantity_kg).toBe(9800);
    const csv = registroCsv(entries);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("9800");
    expect(csv.startsWith("Progressivo;Anno;Data;FIR;EER")).toBe(true);
  });
});

describe("weighbridge CSV", () => {
  it("parses semicolon CSV with decimal commas and computes the net", () => {
    const { rows, errors } = parseWeighbridgeCsv(
      "fir_number;gross_kg;tare_kg\nFIR-SIM-2026-0001;41200,5;13300\n",
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { fir_number: "FIR-SIM-2026-0001", gross_kg: 41200.5, tare_kg: 13300, net_kg: 27900.5 },
    ]);
  });

  it("reports malformed rows instead of dropping them silently", () => {
    const { rows, errors } = parseWeighbridgeCsv(
      "fir_number,gross_kg,tare_kg\nFIR-1,20000,8000\nFIR-2,abc,100\nFIR-3,5000,6000\n,1,0\n",
    );
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(3);
    expect(errors[1]).toContain("FIR-3"); // tare >= gross
  });

  it("rejects a wrong header", () => {
    const { rows, errors } = parseWeighbridgeCsv("foo;bar\n1;2\n");
    expect(rows).toEqual([]);
    expect(errors[0]).toContain("intestazione");
  });
});

describe("weigh discrepancy (5% tolerance)", () => {
  it("flags only deviations beyond the tolerance", () => {
    expect(hasWeighDiscrepancy(10000, 10499)).toBe(false);
    expect(hasWeighDiscrepancy(10000, 10501)).toBe(true);
    expect(hasWeighDiscrepancy(10000, 9500)).toBe(false);
    expect(hasWeighDiscrepancy(10000, 9499)).toBe(true);
  });
});

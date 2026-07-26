// Movimenti / FIR digitale (Phase 3). Pure domain logic, unit-tested:
// FIR numbering, registro cronologico derivation, weighbridge CSV parsing,
// and the (simulated) RENTRI payload. Persistence stays in store.ts.

import type { MovementRecord } from "./types";

/** Tolerance beyond which weighed vs declared quantity is flagged. */
export const WEIGH_TOLERANCE = 0.05;

/** Next progressive FIR number for the year (FIR-SIM-YYYY-NNNN). */
export function nextFirNumber(existing: MovementRecord[], year: number): string {
  const prefix = `FIR-SIM-${year}-`;
  const max = existing
    .filter((m) => m.fir_number.startsWith(prefix))
    .reduce((acc, m) => Math.max(acc, Number(m.fir_number.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** The quantity a movement counts for: weighbridge net weight, else declared. */
export function effectiveKg(m: MovementRecord): number {
  return m.quantity_weighed_kg ?? m.quantity_declared_kg;
}

/** True when the weighed quantity deviates from the declared one by more than 5%. */
export function hasWeighDiscrepancy(declaredKg: number, weighedKg: number): boolean {
  if (declaredKg <= 0) return weighedKg > 0;
  return Math.abs(weighedKg - declaredKg) / declaredKg > WEIGH_TOLERANCE;
}

// ---- registro cronologico (DM 59/2023, operazioni di carico) --------------

export interface RegistroEntry {
  /** Progressive number within the year, chronological order of acceptance. */
  progressivo: number;
  year: number;
  date: string;
  fir_number: string;
  eer: string;
  description: string;
  producer_name: string;
  quantity_kg: number;
  line_id: string;
  rentri_transaction_id: string | null;
}

/**
 * Derives the registro cronologico from the accepted movements: one carico
 * entry per movement, numbered progressively per calendar year in
 * chronological order (date, then creation time for same-day arrivals).
 */
export function registroEntries(movements: MovementRecord[]): RegistroEntry[] {
  const accepted = movements
    .filter((m) => m.status === "accettato")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  const counters = new Map<number, number>();
  return accepted.map((m) => {
    const year = Number(m.date.slice(0, 4));
    const n = (counters.get(year) ?? 0) + 1;
    counters.set(year, n);
    return {
      progressivo: n,
      year,
      date: m.date,
      fir_number: m.fir_number,
      eer: m.eer,
      description: m.description,
      producer_name: m.producer_name,
      quantity_kg: effectiveKg(m),
      line_id: m.line_id,
      rentri_transaction_id: m.rentri?.transaction_id ?? null,
    };
  });
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Registro cronologico as CSV (semicolon-separated, Excel-friendly in it-IT). */
export function registroCsv(entries: RegistroEntry[]): string {
  const header = [
    "Progressivo",
    "Anno",
    "Data",
    "FIR",
    "EER",
    "Descrizione",
    "Produttore",
    "Quantita_kg",
    "Linea",
    "RENTRI",
  ];
  const rows = entries.map((e) =>
    [
      e.progressivo,
      e.year,
      e.date,
      e.fir_number,
      e.eer,
      e.description,
      e.producer_name,
      e.quantity_kg,
      e.line_id,
      e.rentri_transaction_id ?? "",
    ]
      .map(csvCell)
      .join(";"),
  );
  return [header.join(";"), ...rows].join("\n");
}

// ---- weighbridge (pesa) CSV import ----------------------------------------

export interface WeighbridgeRow {
  fir_number: string;
  gross_kg: number;
  tare_kg: number;
  net_kg: number;
}

export interface WeighbridgeParseResult {
  rows: WeighbridgeRow[];
  errors: string[];
}

const WEIGH_HEADER = ["fir_number", "gross_kg", "tare_kg"];

/**
 * Parses a weighbridge export. Expected header: fir_number;gross_kg;tare_kg
 * (comma or semicolon separated; decimal comma accepted; extra columns kept
 * but ignored). Malformed lines are reported, not silently dropped.
 */
export function parseWeighbridgeCsv(text: string): WeighbridgeParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], errors: ["file vuoto"] };

  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const idx = WEIGH_HEADER.map((h) => header.indexOf(h));
  if (idx.some((i) => i < 0)) {
    return {
      rows: [],
      errors: [`intestazione non valida: attese le colonne ${WEIGH_HEADER.join(", ")}`],
    };
  }

  const rows: WeighbridgeRow[] = [];
  const errors: string[] = [];
  const num = (s: string) => Number(s.trim().replace(/\./g, "").replace(",", "."));
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep);
    const fir = (cells[idx[0]] ?? "").trim();
    const gross = num(cells[idx[1]] ?? "");
    const tare = num(cells[idx[2]] ?? "");
    if (!fir) {
      errors.push(`riga ${i + 1}: FIR mancante`);
      continue;
    }
    if (!Number.isFinite(gross) || !Number.isFinite(tare) || gross <= 0 || tare < 0) {
      errors.push(`riga ${i + 1} (${fir}): pesi non validi`);
      continue;
    }
    if (tare >= gross) {
      errors.push(`riga ${i + 1} (${fir}): la tara (${tare}) non è inferiore al lordo (${gross})`);
      continue;
    }
    rows.push({ fir_number: fir, gross_kg: gross, tare_kg: tare, net_kg: gross - tare });
  }
  return { rows, errors };
}

/** Template offered for download next to the import button. */
export const WEIGHBRIDGE_TEMPLATE =
  "fir_number;gross_kg;tare_kg\nFIR-SIM-2026-0013;41200;13300\n";

// ---- RENTRI (SIMULATED) ---------------------------------------------------

/**
 * The FIR digitale payload a real RENTRI integration would transmit
 * (DM 59/2023 data model, simplified). Nothing leaves the app in this build:
 * the payload is stored and shown so the customer can validate the mapping.
 */
export function rentriPayload(
  m: MovementRecord,
  plant: { name: string; authorization: { reference: string } },
): Record<string, unknown> {
  return {
    simulazione: true,
    schema: "FIR-digitale/DM-59-2023 (SEMPLIFICATO, DA VALIDARE)",
    identificativo_fir: m.fir_number,
    data_movimento: m.date,
    produttore: { denominazione: m.producer_name, codice: m.producer_id },
    trasportatore: {
      denominazione: m.transporter.name,
      iscrizione_albo: m.transporter.albo_number,
      targa_automezzo: m.transporter.plate,
    },
    destinatario: {
      denominazione: plant.name,
      autorizzazione: plant.authorization.reference,
      operazione: m.line_id,
    },
    rifiuto: {
      eer: m.eer,
      denominazione: m.description,
      quantita_dichiarata_kg: m.quantity_declared_kg,
      quantita_a_destino_kg: m.quantity_weighed_kg,
    },
    esito_conferimento:
      m.status === "respinto"
        ? { accettato: false, motivo: m.rejection_reason ?? "" }
        : { accettato: m.status === "accettato" },
  };
}

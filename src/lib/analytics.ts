// Dashboard aggregations (Phase 3). Pure functions over store records so the
// numbers are unit-testable; the dashboard page only renders them.

import { effectiveKg } from "./movements";
import type { MovementRecord, OmologaRecord, PlantLine, VerificationRecord } from "./types";

export interface MonthBucket {
  /** "YYYY-MM" */
  month: string;
  /** Short Italian label, e.g. "gen". */
  label: string;
  tonnes: number;
  movements: number;
}

const MONTH_LABELS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** Accepted tonnage per month for the trailing `months` window ending at `now`. */
export function monthlyTonnage(
  movements: MovementRecord[],
  now: Date,
  months = 12,
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({ month: key, label: MONTH_LABELS[d.getUTCMonth()], tonnes: 0, movements: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.month, b]));
  for (const m of movements) {
    if (m.status !== "accettato") continue;
    const b = byKey.get(m.date.slice(0, 7));
    if (!b) continue;
    b.tonnes += effectiveKg(m) / 1000;
    b.movements += 1;
  }
  for (const b of buckets) b.tonnes = Math.round(b.tonnes * 10) / 10;
  return buckets;
}

export interface EerShare {
  eer: string;
  tonnes: number;
  movements: number;
}

/** Accepted tonnage grouped by EER code, heaviest first. */
export function topEer(movements: MovementRecord[], limit = 5): EerShare[] {
  const map = new Map<string, EerShare>();
  for (const m of movements) {
    if (m.status !== "accettato") continue;
    const e = map.get(m.eer) ?? { eer: m.eer, tonnes: 0, movements: 0 };
    e.tonnes += effectiveKg(m) / 1000;
    e.movements += 1;
    map.set(m.eer, e);
  }
  return [...map.values()]
    .map((e) => ({ ...e, tonnes: Math.round(e.tonnes * 10) / 10 }))
    .sort((a, b) => b.tonnes - a.tonnes)
    .slice(0, limit);
}

export interface LineUtilization {
  line_id: string;
  line_name: string;
  tonnes_ytd: number;
  capacity_t: number;
  /** 0..1, capped at 1 for rendering; raw ratio in `ratio`. */
  pct: number;
  ratio: number;
}

/** Accepted tonnage per line for `year` vs the line's authorized capacity. */
export function lineUtilization(
  movements: MovementRecord[],
  lines: PlantLine[],
  year: number,
): LineUtilization[] {
  return lines.map((l) => {
    const kg = movements
      .filter((m) => m.status === "accettato" && m.line_id === l.id && m.date.startsWith(String(year)))
      .reduce((acc, m) => acc + effectiveKg(m), 0);
    const tonnes = Math.round(kg / 100) / 10;
    const ratio = l.annual_capacity_t > 0 ? tonnes / l.annual_capacity_t : 0;
    return {
      line_id: l.id,
      line_name: l.name,
      tonnes_ytd: tonnes,
      capacity_t: l.annual_capacity_t,
      pct: Math.min(1, ratio),
      ratio,
    };
  });
}

export interface EsitoStats {
  total: number;
  conformi: number;
  non_conformi: number;
  di_cui_bloccanti: number;
}

/** Outcome split of the recorded verifications (audit trail). */
export function esitoStats(verifications: VerificationRecord[]): EsitoStats {
  let conformi = 0;
  let non_conformi = 0;
  let di_cui_bloccanti = 0;
  for (const v of verifications) {
    if (v.overall === "conforme") conformi += 1;
    else {
      non_conformi += 1;
      if (v.blocking) di_cui_bloccanti += 1;
    }
  }
  return { total: verifications.length, conformi, non_conformi, di_cui_bloccanti };
}

export interface DashboardKpis {
  movements_ytd: number;
  tonnes_ytd: number;
  in_arrivo: number;
  respinti_ytd: number;
  omologhe_attive: number;
  omologhe_in_scadenza: number;
}

export function dashboardKpis(
  movements: MovementRecord[],
  omologhe: (OmologaRecord & { effective_status: string })[],
  year: number,
): DashboardKpis {
  const ytd = movements.filter((m) => m.date.startsWith(String(year)));
  const accepted = ytd.filter((m) => m.status === "accettato");
  return {
    movements_ytd: accepted.length,
    tonnes_ytd: Math.round(accepted.reduce((acc, m) => acc + effectiveKg(m), 0) / 100) / 10,
    in_arrivo: movements.filter((m) => m.status === "in_arrivo").length,
    respinti_ytd: ytd.filter((m) => m.status === "respinto").length,
    omologhe_attive: omologhe.filter((o) => o.effective_status === "attiva").length,
    omologhe_in_scadenza: omologhe.filter((o) => o.effective_status === "in_scadenza").length,
  };
}

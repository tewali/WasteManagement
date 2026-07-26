import type { OmologaRecord } from "./types";

export type OmologaStatus = "bozza" | "attiva" | "in_scadenza" | "scaduta";

/** Effective status computed from dates: expired wins, then ≤30 days = in scadenza. */
export function effectiveStatus(o: OmologaRecord): OmologaStatus {
  if (o.status === "bozza") return "bozza";
  const now = new Date();
  const to = new Date(o.valid_to + "T23:59:59");
  if (to < now) return "scaduta";
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 30);
  if (to <= soon) return "in_scadenza";
  return "attiva";
}

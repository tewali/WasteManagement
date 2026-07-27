// Domain types shared by seed data, rules engine, API and UI.

export type Basis = "total" | "eluate";

export type Esito = "conforme" | "non_conforme" | "non_determinato" | "non_applicabile";

export interface Analyte {
  key: string;
  label: string;
  unit: string;
  default_basis: Basis;
  kind?: "sum";
}

export interface ReportParameter {
  analyte_key: string;
  result_raw: string;
  operator: "<" | null;
  value: number;
  unit: string;
  basis: Basis;
  method: string;
  lab_claimed_limit?: string;
}

export interface ReportHeader {
  report_number: string;
  laboratory: string;
  sampling_date?: string;
  report_date?: string;
  received_date?: string;
  sampled_by?: string;
  eer_declared: string;
  waste_description: string;
  sample_type?: string;
  physical_state?: string;
  digestion_method?: string;
  leaching_test?: string;
  lab_claimed_conclusion?: string;
  notes?: string;
}

export interface SeedReport {
  id: string;
  scenario: string;
  pdf: string | null;
  producer_id: string;
  extraction: {
    header: ReportHeader;
    parameters: ReportParameter[];
  };
  expected?: unknown;
}

export interface LimitEntry {
  analyte_key: string;
  limit?: number;
  kind?: "sum" | "range";
  min?: number;
  max?: number;
  unit?: string;
  notes?: string;
}

export interface LimitTable {
  id: string;
  name: string;
  normativa: string;
  status: string;
  version: number;
  valid_from: string;
  valid_to: string | null;
  basis: Basis;
  unit: string;
  blocking?: boolean;
  blocking_consequence?: string;
  entries: LimitEntry[];
}

export interface PlantLine {
  id: string;
  name: string;
  operation: string;
  description: string;
  admissible_eer: string[];
  annual_capacity_t: number;
  /**
   * Limit tables bound to the line. Exactly one binding is the `primary` one:
   * the standard limits every acceptance check runs against by default.
   * `blocking` bindings (POP) are an additional layer, never a substitute.
   */
  limit_bindings: { limit_table_id: string; purpose: string; blocking?: boolean; primary?: boolean }[];
}

export interface ParamVerdict {
  analyte_key: string;
  label: string;
  result_raw: string;
  operator: "<" | null;
  value: number;
  unit: string;
  limit_display: string | null;
  esito: Esito;
  reason?: string;
}

export interface VerificationResult {
  limit_table_id: string;
  limit_table_name: string;
  normativa: string;
  table_status: string;
  basis: Basis;
  line_id?: string;
  verdicts: ParamVerdict[];
  counts: Record<Esito, number>;
  evaluated_total: number; // conforme + non_conforme + non_determinato
  missing_analytes: { analyte_key: string; label: string }[];
  overall: "conforme" | "non_conforme";
  blocking: boolean;
  blocking_consequence?: string;
}

// ---- omologhe (Phase 2) ------------------------------------------------

export interface OmologaRecord {
  id: string;
  producer_name: string;
  eer: string;
  waste_description: string;
  line_id: string;
  document_id: string | null;
  analysis_id: string | null;
  status: "bozza" | "attiva";
  valid_from: string; // ISO date
  valid_to: string; // ISO date
  created_at: string;
  created_by: string;
  notes?: string;
}

// ---- movimenti / FIR digitale (Phase 3) --------------------------------

export interface Transporter {
  name: string;
  /** Iscrizione Albo Gestori Ambientali (es. MI12345). */
  albo_number: string;
  plate: string;
}

/**
 * A single conferimento (incoming waste movement) with its FIR. RENTRI
 * transmission is SIMULATED in this build: the payload mirrors the FIR
 * digitale structure (DM 59/2023) but nothing leaves the app.
 */
export interface MovementRecord {
  id: string;
  fir_number: string;
  /** ISO date of transport/arrival at the plant. */
  date: string;
  producer_id: string | null;
  producer_name: string;
  transporter: Transporter;
  eer: string;
  description: string;
  line_id: string;
  omologa_id: string | null;
  quantity_declared_kg: number;
  /** Net weight from the weighbridge (gross − tare); null until weighed. */
  quantity_weighed_kg: number | null;
  /** True when |weighed − declared| exceeds 5% of the declared quantity. */
  weigh_discrepancy?: boolean;
  status: "in_arrivo" | "accettato" | "respinto";
  rejection_reason?: string;
  rentri: { transmitted_at: string; transaction_id: string } | null;
  created_at: string;
  created_by: string;
}

// ---- portale clienti (Phase 3) -----------------------------------------

/** A lab report submitted by a producer through the customer portal. */
export interface PortalSubmission {
  id: string;
  producer_email: string;
  producer_name: string;
  document_id: string;
  analysis_id: string;
  message?: string;
  status: "inviato" | "completato";
  esito?: "conforme" | "non_conforme";
  verification_id: string | null;
  conversation_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

// ---- persisted records -------------------------------------------------

export interface DocumentRecord {
  id: string;
  filename: string;
  uploaded_at: string;
  size: number;
  source: "seed_fixture" | "upload";
  fixture_id: string | null; // R1..R4 when matched
  pdf_url: string | null;
  pages: number;
}

export interface AnalysisRecord {
  id: string;
  document_id: string;
  header: ReportHeader;
  parameters: ReportParameter[];
  edited: boolean;
  extraction_source?: "claude" | "fixture";
}

export interface VerificationRecord extends VerificationResult {
  id: string;
  analysis_id: string;
  document_id: string;
  created_at: string;
  requested_by: string;
}

// ---- quadro di conformità (aggregated stoplight across active tables) ----

/** Stoplight state. `bloccante` is red-plus: a blocking layer was exceeded. */
export type QuadroStatus = "conforme" | "riserve" | "non_conforme" | "bloccante";

export interface QuadroRow {
  limit_table_id: string;
  table_name: string;
  normativa: string;
  status: QuadroStatus;
  blocking: boolean;
  counts: Record<Esito, number>;
  evaluated_total: number;
  /** Parameters that put the table in the red, for the row's caption. */
  offenders: string[];
  /**
   * Per-parameter detail behind the row, non-conformi first. Excludes the
   * parameters this table does not govern.
   */
  verdicts: ParamVerdict[];
}

export interface QuadroData {
  overall: QuadroStatus;
  headline: string;
  rows: QuadroRow[];
  skipped: { table_name: string; reason: string }[];
}

export type MessageBlock =
  | { type: "text"; text: string }
  | { type: "inquadramento"; items: { label: string; value: string }[] }
  | { type: "quadro"; quadro: QuadroData }
  /**
   * A request that could not reach the API. Transient UI only — never persisted
   * with the conversation; `retry_id` looks up the action that replays it.
   */
  | { type: "errore"; text: string; hint?: string; retry_id: string }
  | { type: "esito"; verification: VerificationResult; document_name: string }
  | { type: "conclusione"; tone: "ok" | "ko" | "warn"; title: string; lines: string[]; footer?: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  time: string;
  text?: string;
  attachment?: { document_id: string; filename: string };
  blocks?: MessageBlock[];
}

export interface Conversation {
  id: string;
  title: string;
  /** True once the user renamed the chat — auto-titling then leaves it alone. */
  title_custom?: boolean;
  created_at: string;
  messages: ChatMessage[];
  active_document_id: string | null;
  active_table_id: string | null;
  active_line_id: string | null;
}

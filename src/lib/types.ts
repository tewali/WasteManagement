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

export type MessageBlock =
  | { type: "text"; text: string }
  | { type: "inquadramento"; items: { label: string; value: string }[] }
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

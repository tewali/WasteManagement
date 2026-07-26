// Real Claude integration (Phase 1.1).
//
// Active when ANTHROPIC_API_KEY is set (locally via .env.local, on Render via
// the dashboard env var). Two capabilities:
//
//  1. extractFromPdf  — reads an uploaded rapporto di prova (PDF) and returns
//     structured header + parameters, constrained by a JSON schema whose
//     analyte keys come from the canonical registry.
//  2. annaChat        — the chat assistant. Claude answers technical questions
//     and calls the `run_comparison` tool for any conformity verdict; the
//     deterministic rules engine computes every number (the model never does).
//
// Design guardrails: server-side refusal fallbacks are enabled by default
// (fallbacks: "default"); stop_reason is checked before reading content; on
// any AI failure the caller falls back to the deterministic demo path.

import Anthropic from "@anthropic-ai/sdk";
import { runVerification } from "./rules-engine";
import { analyteLabel, getSeed } from "./seed";
import type {
  AnalysisRecord,
  DocumentRecord,
  MessageBlock,
  ReportHeader,
  ReportParameter,
  VerificationResult,
} from "./types";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = "claude-opus-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

// Create with server-side refusal fallbacks; if the org doesn't have the
// beta (400), retry the identical request without it rather than failing.
// Streaming + finalMessage() so large max_tokens never hits the SDK's
// non-streaming timeout guard.
async function createMessage(
  params: Omit<Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, "model" | "betas" | "fallbacks">,
) {
  const attempt = (withFallbacks: boolean) =>
    client()
      .beta.messages.stream({
        model: MODEL,
        ...(withFallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" } : {}),
        ...params,
      } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming)
      .finalMessage();
  try {
    return await attempt(true);
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) return await attempt(false);
    throw e;
  }
}

const nullable = (t: "string" | "number") => ({ anyOf: [{ type: t }, { type: "null" }] });

function extractionSchema() {
  const keys = getSeed().analytes.map((a) => a.key);
  return {
    type: "object",
    additionalProperties: false,
    required: ["header", "parameters"],
    properties: {
      header: {
        type: "object",
        additionalProperties: false,
        required: [
          "report_number", "laboratory", "sampling_date", "report_date",
          "eer_declared", "waste_description", "sample_type", "physical_state",
          "digestion_method", "sampled_by", "notes", "lab_claimed_conclusion",
        ],
        properties: {
          report_number: { type: "string" },
          laboratory: { type: "string" },
          sampling_date: nullable("string"),
          report_date: nullable("string"),
          eer_declared: { type: "string", description: "Codice EER/CER, formato 'NN NN NN' con asterisco se pericoloso" },
          waste_description: { type: "string" },
          sample_type: nullable("string"),
          physical_state: nullable("string"),
          digestion_method: nullable("string"),
          sampled_by: nullable("string"),
          notes: nullable("string"),
          lab_claimed_conclusion: nullable("string"),
        },
      },
      parameters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["analyte_key", "result_raw", "operator", "value", "unit", "basis", "method", "lab_claimed_limit"],
          properties: {
            analyte_key: {
              type: "string",
              enum: keys,
              description: "Chiave canonica dell'analita. Usare le chiavi *_el per i risultati su eluato (mg/l).",
            },
            result_raw: { type: "string", description: "Risultato come stampato, virgola decimale inclusa (es. '< 0,05')" },
            operator: { type: "string", enum: ["<", "="], description: "'<' se il risultato è sotto il LOQ, altrimenti '='" },
            value: { type: "number", description: "Valore numerico parsato (per '< X' usare X)" },
            unit: { type: "string" },
            basis: { type: "string", enum: ["total", "eluate"] },
            method: { type: "string" },
            lab_claimed_limit: nullable("string"),
          },
        },
      },
    },
  };
}

export async function extractFromPdf(
  pdf: Buffer,
  filename: string,
): Promise<{ header: ReportHeader; parameters: ReportParameter[] }> {
  const response = await createMessage({
    max_tokens: 32000,
    output_config: { format: { type: "json_schema", schema: extractionSchema() } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdf.toString("base64"),
            },
          },
          {
            type: "text",
            text:
              `Estrai i dati da questo rapporto di prova ("${filename}") per la caratterizzazione di un rifiuto. ` +
              `Estrai l'intestazione e TUTTI i parametri analitici. Distingui i risultati sul tal quale ` +
              `(basis "total", chiavi normali) da quelli sull'eluato/test di cessione (basis "eluate", chiavi *_el). ` +
              `Non convertire le unità; conserva result_raw esattamente come stampato. Se il rapporto dichiara ` +
              `limiti o conclusioni proprie, riportali in lab_claimed_limit / lab_claimed_conclusion ma non usarli ` +
              `per alcuna valutazione. Date in formato ISO (YYYY-MM-DD).`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("estrazione rifiutata dai classificatori di sicurezza");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("risposta senza contenuto testuale");
  const parsed = JSON.parse(text.text) as {
    header: Record<string, string | null>;
    parameters: (Omit<ReportParameter, "operator"> & { operator: "<" | "=" })[];
  };

  const header = Object.fromEntries(
    Object.entries(parsed.header).filter(([, v]) => v !== null),
  ) as unknown as ReportHeader;
  const parameters: ReportParameter[] = parsed.parameters.map((p) => ({
    ...p,
    lab_claimed_limit: p.lab_claimed_limit ?? undefined,
    operator: p.operator === "<" ? "<" : null,
  }));
  return { header, parameters };
}

// ---- chat -----------------------------------------------------------------

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

function systemPrompt(analysis: AnalysisRecord | null, document: DocumentRecord | null): string {
  const seed = getSeed();
  const tables = seed.tables
    .map((t) => `- id "${t.id}": ${t.name} [base: ${t.basis}] — ${t.normativa}`)
    .join("\n");
  const lines = seed.lines
    .map((l) => `- id "${l.id}": ${l.name} (${l.operation}) — EER ammessi: ${l.admissible_eer.join(", ")}`)
    .join("\n");
  const singleLineNote =
    seed.lines.length === 1
      ? `\nL'impianto ha un'UNICA linea operativa (${seed.lines[0].name}, id "${seed.lines[0].id}"): assumi sempre questa linea per ogni verifica di accettazione, senza chiederla all'utente.`
      : "";

  let docContext = "Nessun documento attivo nella conversazione.";
  if (analysis && document) {
    const params = analysis.parameters
      .map((p) => `${analyteLabel(p.analyte_key)}: ${p.result_raw} ${p.unit} [${p.basis}]`)
      .join("; ");
    docContext =
      `Documento attivo: "${document.filename}". CER dichiarato: ${analysis.header.eer_declared}. ` +
      `Descrizione: ${analysis.header.waste_description}. Laboratorio: ${analysis.header.laboratory}. ` +
      `Data rapporto: ${analysis.header.report_date ?? "n.d."}. Parametri estratti: ${params}.`;
  }

  return (
    `Sei Anna, l'assistente tecnica AI di Valli S.p.A., impianto italiano di trattamento e recupero rifiuti. ` +
    `Rispondi in italiano, con tono professionale e conciso, a domande su classificazione rifiuti (EER/CER, ` +
    `codici a specchio, HP), conformità ai limiti normativi, ammissibilità in discarica, End of Waste e vincolo POP.\n\n` +
    `REGOLA FONDAMENTALE: non calcolare MAI tu stessa un esito di conformità e non citare valori limite a memoria. ` +
    `Per qualsiasi verifica o confronto con una tabella limiti chiama lo strumento run_comparison: il motore ` +
    `deterministico dell'applicazione calcola ogni esito e i risultati ti vengono restituiti. Basa le conclusioni ` +
    `esclusivamente su quei risultati. L'interfaccia mostra all'utente una tabella dettagliata dell'esito: nel testo ` +
    `commenta i punti salienti (parametri non conformi, non determinati, vincoli bloccanti) senza ripetere tutta la tabella.\n\n` +
    `Le tabelle limiti sono in stato SIMULATO/da validare: se esegui una verifica, ricordalo brevemente.\n\n` +
    `Tabelle limiti disponibili:\n${tables}\n\nLinee dell'impianto:\n${lines}${singleLineNote}\n\n${docContext}`
  );
}

export interface AiChatResult {
  blocks: MessageBlock[];
  verification: VerificationResult | null;
  table_id: string | null;
  line_id: string | null;
}

export async function annaChat(opts: {
  message: string;
  history: ChatTurn[];
  analysis: AnalysisRecord | null;
  document: DocumentRecord | null;
}): Promise<AiChatResult> {
  const seed = getSeed();
  const tableIds = seed.tables.map((t) => t.id);
  const lineIds = seed.lines.map((l) => l.id);

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      name: "run_comparison",
      description:
        "Esegue il confronto deterministico dei parametri del documento attivo contro una tabella limiti. " +
        "Da chiamare per QUALSIASI valutazione di conformità o ammissibilità. Restituisce l'esito per parametro " +
        "e complessivo calcolato dal motore dell'applicazione.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["table_id", "line_id"],
        properties: {
          table_id: { type: "string", enum: tableIds },
          line_id: { type: "string", enum: lineIds },
        },
      },
    },
  ];

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...opts.history.slice(-12).map((t) => ({ role: t.role, content: t.text })),
    { role: "user" as const, content: opts.message },
  ];

  let verification: VerificationResult | null = null;
  let tableId: string | null = null;
  let lineId: string | null = null;

  for (let i = 0; i < 4; i++) {
    const response = await createMessage({
      max_tokens: 16000,
      system: systemPrompt(opts.analysis, opts.document),
      tools,
      messages,
    });

    if (response.stop_reason === "refusal") {
      throw new Error("risposta rifiutata dai classificatori di sicurezza");
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const input = block.input as { table_id: string; line_id: string };
        const table = seed.tables.find((t) => t.id === input.table_id);
        if (table && opts.analysis) {
          verification = runVerification(opts.analysis.parameters, table, analyteLabel, input.line_id);
          tableId = input.table_id;
          lineId = input.line_id;
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({
              overall: verification.overall,
              blocking: verification.blocking,
              blocking_consequence: verification.blocking_consequence ?? null,
              counts: verification.counts,
              non_conformi: verification.verdicts
                .filter((v) => v.esito === "non_conforme")
                .map((v) => ({ parametro: v.label, risultato: v.result_raw, unita: v.unit, limite: v.limit_display })),
              non_determinati: verification.verdicts
                .filter((v) => v.esito === "non_determinato")
                .map((v) => ({ parametro: v.label, motivo: v.reason })),
              parametri_mancanti: verification.missing_analytes.map((m) => m.label),
              tabella: verification.limit_table_name,
              stato_tabella: verification.table_status,
            }),
          });
        } else {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: opts.analysis
              ? `Tabella ${input.table_id} non trovata`
              : "Nessun documento attivo: chiedere all'utente di caricare un rapporto di prova.",
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    // end_turn (or max_tokens): compose the reply blocks
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const blocks: MessageBlock[] = [];
    if (verification) {
      blocks.push({
        type: "esito",
        verification,
        document_name: opts.document?.filename ?? "",
      });
    }
    if (text) blocks.push({ type: "text", text });
    if (blocks.length === 0) blocks.push({ type: "text", text: "Non ho prodotto una risposta, riprovi." });
    return { blocks, verification, table_id: tableId, line_id: lineId };
  }

  throw new Error("troppi cicli di tool use senza risposta finale");
}

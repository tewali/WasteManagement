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
import { suggestLines } from "./line-suggest";
import {
  buildMatrice,
  buildQuadro,
  plantCheckLines,
  runPlantCheck,
  shortTableName,
  type PlantCheck,
} from "./plant-check";
import { runVerification } from "./rules-engine";
import { analyteLabel, defaultLineId, getSeed, isBlockingTable, standardTableId } from "./seed";
import { store } from "./store";
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
  const plantLines = store.lines();
  const lines = plantLines
    .map((l) => `- id "${l.id}": ${l.name} (${l.operation}) — EER ammessi: ${l.admissible_eer.join(", ")}`)
    .join("\n");
  const defaultLine =
    plantLines.find((l) => l.id === defaultLineId(plantLines)) ?? plantLines[0];
  const standardTable = seed.tables.find(
    (t) => t.id === standardTableId(defaultLine?.id, plantLines),
  )!;
  const singleLineNote =
    plantLines.length === 1
      ? `\nL'impianto ha un'UNICA linea operativa (${plantLines[0].name}, id "${plantLines[0].id}"): assumi sempre questa linea per ogni verifica di accettazione, senza chiederla all'utente.`
      : `\nLinea predefinita: ${defaultLine.name} (id "${defaultLine.id}") — usala quando l'utente non ne indica un'altra.`;

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
    `ESITO PREDEFINITO: quando l'utente chiede genericamente di analizzare un rapporto, di verificarne la conformità ` +
    `o l'accettabilità, il confronto da eseguire è SEMPRE quello con i limiti standard della linea ` +
    `(table_id "standard" = ${standardTable.name.split("(")[0].trim()}, linea ${defaultLine.name}). ` +
    `Usa un'altra tabella solo se l'utente la richiede esplicitamente.\n` +
    `Il vincolo POP (tabella "pop-reg-2019-1021") è un controllo BLOCCANTE AGGIUNTIVO: puoi eseguirlo in più ` +
    `rispetto al confronto standard, ma non sostituisce mai il confronto con i limiti standard della linea — ` +
    `da solo produrrebbe quasi solo esiti "non applicabile" e non risponde alla domanda di accettazione.\n` +
    `Per una verifica completa contro tutte le tabelle attive dell'impianto usa run_plant_check (una sola ` +
    `chiamata): al caricamento di un nuovo rapporto questa verifica è già stata eseguita automaticamente e i ` +
    `risultati ti vengono forniti nel messaggio — in quel caso limitati a commentarli.\n` +
    `Quando i confronti sono più d'uno, commenta l'esito complessivo: quali tabelle sono rispettate, quali no ` +
    `e con quali parametri fuori limite, e cosa comporta per l'accettazione.\n\n` +
    `Le tabelle limiti sono in stato SIMULATO/da validare: se esegui una verifica, ricordalo brevemente.\n\n` +
    `Tabelle limiti disponibili:\n${tables}\n\nLinee dell'impianto:\n${lines}${singleLineNote}\n\n${docContext}`
  );
}

export interface AiChatResult {
  blocks: MessageBlock[];
  /** Headline esito: the comparison against the line's standard limits. */
  verification: VerificationResult | null;
  /** Every comparison run this turn (standard first, blocking layers after). */
  verifications: VerificationResult[];
  table_id: string | null;
  line_id: string | null;
}

export async function annaChat(opts: {
  message: string;
  history: ChatTurn[];
  analysis: AnalysisRecord | null;
  document: DocumentRecord | null;
  /** Upload flow: check against every limit table active in the plant. */
  fullCheck?: boolean;
}): Promise<AiChatResult> {
  const seed = getSeed();
  const tableIds = seed.tables.map((t) => t.id);
  const plantLines = store.lines();
  const lineIds = plantLines.map((l) => l.id);

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
          table_id: {
            type: "string",
            enum: ["standard", ...tableIds],
            description:
              'Usare "standard" (impostazione predefinita) per i limiti standard della linea: è la scelta ' +
              "corretta per ogni richiesta generica di analisi, conformità o accettabilità. Indicare un id " +
              "specifico solo se l'utente chiede espressamente quella tabella.",
          },
          line_id: {
            type: "string",
            enum: lineIds,
            description: `Linea di destinazione; se l'utente non la indica usare "${defaultLineId(plantLines)}".`,
          },
        },
      },
    },
    {
      name: "run_plant_check",
      description:
        "Confronta i parametri del documento attivo con TUTTE le tabelle limiti attive nell'impianto " +
        "(quelle associate alle linee configurate e in vigore), in un'unica passata. Da chiamare quando " +
        "l'utente chiede una verifica completa o il confronto con tutte le tabelle. Le tabelle non " +
        "valutabili con i parametri disponibili sono riportate a parte.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: [],
        properties: {},
      },
    },
    {
      name: "suggest_line",
      description:
        "Valuta su quali linee dell'impianto il rifiuto del documento attivo può essere accettato: " +
        "ammissibilità del codice EER, vincolo bloccante POP e verdetto contro ogni tabella limiti della linea. " +
        "Da chiamare quando l'utente chiede quale linea può accettare il rifiuto o se è accettabile in impianto.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        required: [],
        properties: {},
      },
    },
  ];

  // Every comparison run this turn, in call order. The headline esito is the
  // one against the line's standard limits: a blocking layer (POP) can be run
  // in addition, but must never replace it in the card or in the doc panel.
  const verifications: VerificationResult[] = [];
  let lineId: string | null = null;
  // Set when the full plant battery ran, so the reply can carry the aggregated
  // stoplight (and name the tables the report could not address).
  let plantCheck: PlantCheck | null = null;

  // Upload flow: the battery against every active plant table is computed here,
  // deterministically, rather than left to the model to request — the check must
  // happen on every upload. The model receives the numbers and comments on them.
  let userMessage = opts.message;
  if (opts.fullCheck && opts.analysis) {
    const check = runPlantCheck(opts.analysis.parameters, plantLines, defaultLineId(plantLines));
    verifications.push(...check.verifications);
    plantCheck = check;
    lineId = defaultLineId(plantLines);
    if (check.verifications.length > 0) {
      userMessage =
        `${opts.message}\n\n[Verifica automatica già eseguita dal motore deterministico contro tutte le ` +
        `tabelle limiti attive nell'impianto. NON richiamare run_comparison o run_plant_check per questi ` +
        `stessi confronti: commenta questi risultati, già mostrati all'utente come tabelle di esito.\n` +
        `${plantCheckLines(check).map((l) => `- ${l}`).join("\n")}` +
        (check.skipped.length > 0
          ? `\nTabelle attive non valutabili: ${check.skipped
              .map((s) => `${shortTableName(s.table.name)} (${s.reason})`)
              .join("; ")}.`
          : "") +
        `]`;
    }
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...opts.history.slice(-12).map((t) => ({ role: t.role, content: t.text })),
    { role: "user" as const, content: userMessage },
  ];

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
        if (block.name === "suggest_line") {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            ...(opts.analysis
              ? {
                  content: JSON.stringify(
                    suggestLines(opts.analysis).map((s) => ({
                      linea: s.line.name,
                      eer_ammesso: s.eer_admissible,
                      vincolo_pop: s.pop_blocked,
                      esito: s.esito,
                      motivo: s.motivo,
                      tabelle: s.table_results.map((t) => ({
                        tabella: t.name,
                        finalita: t.purpose,
                        esito: t.overall,
                        conteggi: t.counts,
                      })),
                    })),
                  ),
                }
              : {
                  content: "Nessun documento attivo: chiedere all'utente di caricare un rapporto di prova.",
                  is_error: true,
                }),
          });
          continue;
        }
        if (block.name === "run_plant_check") {
          if (!opts.analysis) {
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "Nessun documento attivo: chiedere all'utente di caricare un rapporto di prova.",
              is_error: true,
            });
            continue;
          }
          const line = lineId ?? defaultLineId(plantLines);
          const check = runPlantCheck(opts.analysis.parameters, plantLines, line);
          verifications.push(...check.verifications);
          plantCheck = check;
          lineId = line;
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({
              tabelle_valutate: check.verifications.map((v) => ({
                tabella: shortTableName(v.limit_table_name),
                esito: v.overall,
                bloccante: v.blocking,
                conteggi: v.counts,
                non_conformi: v.verdicts
                  .filter((x) => x.esito === "non_conforme")
                  .map((x) => ({ parametro: x.label, risultato: x.result_raw, limite: x.limit_display })),
              })),
              tabelle_non_valutabili: check.skipped.map((s) => ({
                tabella: shortTableName(s.table.name),
                motivo: s.reason,
              })),
            }),
          });
          continue;
        }
        const input = block.input as { table_id: string; line_id: string };
        // Resolve the defaults the model is allowed to leave implicit: the
        // line's standard limits, on the default line.
        const line =
          plantLines.find((l) => l.id === input.line_id)?.id ?? defaultLineId(plantLines);
        const requestedTableId =
          input.table_id === "standard" ? standardTableId(line, plantLines) : input.table_id;
        const table = seed.tables.find((t) => t.id === requestedTableId);
        if (table && opts.analysis) {
          const verification = runVerification(
            opts.analysis.parameters,
            table,
            analyteLabel,
            line,
          );
          verifications.push(verification);
          lineId = line;
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

    // A blocking layer (POP) alone never answers "can we accept this waste?":
    // if the model only ran blocking tables, add the line's standard comparison.
    if (
      opts.analysis &&
      verifications.length > 0 &&
      verifications.every((v) => isBlockingTable(v.limit_table_id))
    ) {
      const line = lineId ?? defaultLineId(plantLines);
      const standard = seed.tables.find((t) => t.id === standardTableId(line, plantLines));
      if (standard) {
        verifications.unshift(
          runVerification(opts.analysis.parameters, standard, analyteLabel, line),
        );
      }
    }

    // One card per table: the model may re-run a comparison already covered by
    // the plant battery. Keep the first verdict for each table.
    const unique = verifications.filter(
      (v, i) => verifications.findIndex((o) => o.limit_table_id === v.limit_table_id) === i,
    );

    // Standard limits first, blocking layers after — in the card and in the panel.
    const ordered = [
      ...unique.filter((v) => !isBlockingTable(v.limit_table_id)),
      ...unique.filter((v) => isBlockingTable(v.limit_table_id)),
    ];
    const headline = ordered[0] ?? null;

    const blocks: MessageBlock[] = [];
    // More than one regulation in play: the stoplight summarises, the matrix
    // gives one column per norm. A single comparison keeps the plain esito card.
    const multi = { verifications: ordered, skipped: plantCheck?.skipped ?? [] };
    if (plantCheck || ordered.length > 1) {
      blocks.push({ type: "quadro", quadro: buildQuadro(multi) });
      blocks.push({
        type: "matrice",
        matrice: buildMatrice(multi),
        document_name: opts.document?.filename ?? "",
      });
    } else {
      blocks.push(
        ...ordered.map((v) => ({
          type: "esito" as const,
          verification: v,
          document_name: opts.document?.filename ?? "",
        })),
      );
    }
    if (text) blocks.push({ type: "text", text });
    if (blocks.length === 0) blocks.push({ type: "text", text: "Non ho prodotto una risposta, riprovi." });
    return {
      blocks,
      verification: headline,
      verifications: ordered,
      table_id: headline?.limit_table_id ?? null,
      line_id: lineId,
    };
  }

  throw new Error("troppi cicli di tool use senza risposta finale");
}

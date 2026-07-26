// "Anna" — deterministic assistant for the MVP.
//
// Intent parsing + response composition only: every number in a reply comes
// from the rules engine. When a Claude API key is configured (Phase 1.1),
// this module becomes the tool layer the model calls; the deterministic
// fallback keeps the demo fully functional offline.

import { suggestLines } from "./line-suggest";
import { buildQuadro, plantCheckLines, runPlantCheck, shortTableName } from "./plant-check";
import { runVerification } from "./rules-engine";
import { analyteLabel, defaultLineId, getSeed, getTable, standardTableId } from "./seed";
import { store } from "./store";
import type {
  AnalysisRecord,
  DocumentRecord,
  MessageBlock,
  VerificationResult,
} from "./types";

const EER_DESCRIPTIONS: Record<string, string> = {
  "17 09 03*": "rifiuti dell'attività di costruzione e demolizione contenenti sostanze pericolose",
  "17 09 04": "rifiuti misti dell'attività di costruzione e demolizione",
  "17 05 03*": "terra e rocce contenenti sostanze pericolose",
  "17 05 04": "terra e rocce, diverse da quelle di cui alla voce 17 05 03",
  "19 12 12": "altri rifiuti prodotti dal trattamento meccanico dei rifiuti",
};

const fmtIt = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 6 });

export function detectTableId(message: string): string | null {
  const m = message.toLowerCase();
  if (/colonna\s*b|col\.?\s*b\b/.test(m)) return "tab5-121-2020-colB";
  if (/colonna\s*a|col\.?\s*a\b|tabella\s*5/.test(m)) return "tab5-121-2020-colA";
  if (/non\s*pericolos/.test(m)) return "eluato-discarica-non-pericolosi";
  if (/inert/.test(m)) return "eluato-discarica-inerti";
  if (/pop|pfas|pfoa|persistent/.test(m)) return "pop-reg-2019-1021";
  return null;
}

export function detectLineId(message: string): string | null {
  const m = message.toLowerCase();
  if (/soil\s*washing|linea\s*1/.test(m)) return "L1-soil-washing";
  if (/inertizzazione|linea\s*2/.test(m)) return "L2-inertizzazione";
  if (/stoccaggio|linea\s*3/.test(m)) return "L3-stoccaggio";
  return null;
}

function wantsVerification(message: string): boolean {
  return /verific|conform|confront|accetta|analizz|limiti|ammissib/i.test(message);
}

function inquadramento(analysis: AnalysisRecord, lineId: string | null, limits: string): MessageBlock {
  const eer = analysis.header.eer_declared;
  const line = lineId ? store.line(lineId) : null;
  return {
    type: "inquadramento",
    items: [
      { label: "CER", value: `${eer} (${EER_DESCRIPTIONS[eer] ?? analysis.header.waste_description})` },
      { label: "Tipologia rifiuto", value: (analysis.header.waste_description || analysis.header.sample_type || "").replace(/^./, (c) => c.toLowerCase()) },
      ...(line ? [{ label: "Linea di destinazione", value: line.name.replace(/^Linea \d+ — /, "") }] : []),
      { label: "Limiti di riferimento", value: limits },
    ],
  };
}

const tableLimitsLabel = (table: { name: string; normativa: string }) =>
  `${table.name} – ${table.normativa.split("(")[0].trim()}`;

function conclusione(v: VerificationResult, lineId: string | null): MessageBlock {
  const line = lineId ? store.line(lineId) : null;
  const tableShort = v.limit_table_name.split("(")[0].trim();
  if (v.blocking) {
    const nc = v.verdicts.filter((x) => x.esito === "non_conforme");
    return {
      type: "conclusione",
      tone: "ko",
      title: "Vincolo POP — rifiuto non ammissibile",
      lines: nc.map((x) => `${x.label}: ${x.result_raw} ${x.unit} > ${x.limit_display} ${x.unit}`),
      footer: v.blocking_consequence,
    };
  }
  if (v.overall === "non_conforme") {
    const nc = v.verdicts.filter((x) => x.esito === "non_conforme");
    return {
      type: "conclusione",
      tone: "ko",
      title: `Il rifiuto NON è conforme ai limiti della ${tableShort}`,
      lines: nc.map((x) => `${x.label.replace(/\s*\(.*\)$/, "")} (${x.result_raw} > ${x.limit_display} ${x.unit})`),
      footer: line
        ? `Pertanto, non è accettabile sulla linea ${line.name.replace(/^Linea \d+ — /, "")} per l'ottenimento di EoW ai sensi del D.Lgs. 121/2020.`
        : undefined,
    };
  }
  const nd = v.counts.non_determinato;
  return {
    type: "conclusione",
    tone: nd > 0 ? "warn" : "ok",
    title: `Il rifiuto è conforme ai limiti della ${tableShort}`,
    lines:
      nd > 0
        ? [
            nd === 1
              ? "Attenzione: 1 parametro non determinato (LOQ superiore al limite) — richiedere ripetizione al laboratorio."
              : `Attenzione: ${nd} parametri non determinati (LOQ superiore al limite) — richiedere ripetizione al laboratorio.`,
          ]
        : [],
    footer: line ? `Accettabile sulla linea ${line.name.replace(/^Linea \d+ — /, "")}.` : undefined,
  };
}

/**
 * Conclusione for a full plant check: one line per evaluated table, tone driven
 * by the blocking layer first, then by how many tables are met.
 */
function conclusioneMulti(
  check: ReturnType<typeof runPlantCheck>,
  lineId: string | null,
): MessageBlock {
  const line = lineId ? store.line(lineId) : null;
  const lineName = line?.name.replace(/^Linea \d+ — /, "");
  const blocked = check.verifications.find((v) => v.blocking);
  if (blocked) {
    return {
      type: "conclusione",
      tone: "ko",
      title: "Vincolo POP superato — rifiuto non ammissibile su nessuna linea",
      lines: plantCheckLines(check),
      footer: blocked.blocking_consequence,
    };
  }

  const conformi = check.verifications.filter((v) => v.overall === "conforme");
  const total = check.verifications.length;
  const allOk = conformi.length === total && total > 0;
  const noneOk = conformi.length === 0 && total > 0;
  const nd = check.verifications.some((v) => v.counts.non_determinato > 0);

  return {
    type: "conclusione",
    tone: noneOk ? "ko" : allOk && !nd ? "ok" : "warn",
    title: allOk
      ? `Il rifiuto è conforme a tutte le ${total} tabelle limiti valutate`
      : noneOk
        ? `Il rifiuto non è conforme a nessuna delle ${total} tabelle limiti valutate`
        : `Il rifiuto è conforme a ${conformi.length} tabelle su ${total} valutate`,
    lines: plantCheckLines(check),
    footer: lineName
      ? conformi.some((v) => v.limit_table_id.includes("tab5"))
        ? `Accettabile sulla linea ${lineName} secondo almeno una delle tabelle di riferimento.`
        : `Non accettabile sulla linea ${lineName} per l'ottenimento di EoW ai sensi del D.Lgs. 121/2020.`
      : undefined,
  };
}

export interface AnnaReply {
  blocks: MessageBlock[];
  verification: VerificationResult | null;
  verifications: VerificationResult[];
  table_id: string | null;
  line_id: string | null;
}

export function annaRespond(opts: {
  message: string;
  analysis: AnalysisRecord | null;
  document: DocumentRecord | null;
  defaultTableId?: string | null;
  defaultLineId?: string | null;
  /** Upload flow: check against every limit table active in the plant. */
  fullCheck?: boolean;
}): AnnaReply {
  const { message, analysis, document } = opts;
  const seed = getSeed();
  const plantLines = store.lines();
  const lineId = detectLineId(message) ?? opts.defaultLineId ?? defaultLineId(plantLines);
  // No table named in the message and none active: the line's standard limits.
  const tableId =
    detectTableId(message) ?? opts.defaultTableId ?? standardTableId(lineId, plantLines);

  if (!analysis || !document) {
    return {
      blocks: [
        {
          type: "text",
          text:
            "Buongiorno! Sono Anna, il suo assistente tecnico per l'ambiente e i rifiuti. " +
            "Carichi un rapporto di prova (PDF, Excel o immagine) con il pulsante «Carica analisi» " +
            "o trascinandolo qui in chat: estraggo i dati e verifico la conformità ai limiti normativi " +
            "per le linee dell'impianto.",
        },
      ],
      verification: null,
      verifications: [],
      table_id: tableId,
      line_id: lineId,
    };
  }

  // Upload flow: the report is measured against every active plant table.
  if (opts.fullCheck || /tutte le tabelle|tutte le verifiche|verifica completa/i.test(message)) {
    const check = runPlantCheck(analysis.parameters, plantLines, lineId);
    if (check.verifications.length > 0) {
      const names = check.verifications.map((v) => shortTableName(v.limit_table_name));
      const blocks: MessageBlock[] = [
        {
          type: "text",
          text:
            `Ho analizzato il rapporto di prova allegato: "${document.filename}". ` +
            `Ho confrontato i risultati con tutte le tabelle limiti attive nell'impianto ` +
            `(${names.length}: ${names.join("; ")}).`,
        },
        inquadramento(analysis, lineId, `${names.length} tabelle attive — ${names.join("; ")}`),
        // Aggregated stoplight first, per-table detail underneath.
        { type: "quadro" as const, quadro: buildQuadro(check) },
        ...check.verifications.map((verification) => ({
          type: "esito" as const,
          verification,
          document_name: document.filename,
        })),
        ...(check.skipped.length > 0
          ? [
              {
                type: "text" as const,
                text:
                  `*Tabelle attive non valutabili con i parametri disponibili:* ` +
                  check.skipped
                    .map((s) => `${shortTableName(s.table.name)} — ${s.reason}`)
                    .join("; ") +
                  ".",
              },
            ]
          : []),
        conclusioneMulti(check, lineId),
      ];
      return {
        blocks,
        verification: check.verifications[0],
        verifications: check.verifications,
        table_id: check.verifications[0].limit_table_id,
        line_id: lineId,
      };
    }
  }

  // Line suggestion: "quale linea può accettarlo?"
  if (/quale linea|linee? (può|possono)|su che linea|dove (può|posso) (accettar|conferir)/i.test(message)) {
    const suggestions = suggestLines(analysis);
    const ESITO_LABEL: Record<string, string> = {
      accettabile: "✅ Accettabile",
      accettabile_con_riserva: "⚠️ Accettabile con riserva",
      non_accettabile: "⛔ Non accettabile",
      eer_non_ammesso: "⛔ EER non ammesso",
    };
    const text =
      `**Valutazione di accettabilità per "${document.filename}"** (CER ${analysis.header.eer_declared}):\n\n` +
      suggestions
        .map(
          (s) =>
            `- **${s.line.name}** — ${ESITO_LABEL[s.esito]}. ${s.motivo}` +
            (s.table_results.length
              ? `\n  ${s.table_results
                  .map((t) => `${t.name}: ${t.overall === "conforme" ? "conforme" : "non conforme"}`)
                  .join(" · ")}`
              : ""),
        )
        .join("\n");
    return {
      blocks: [{ type: "text", text }],
      verification: null,
      verifications: [],
      table_id: tableId,
      line_id: lineId,
    };
  }

  if (wantsVerification(message) || detectTableId(message)) {
    const table = getTable(tableId) ?? getTable(standardTableId(lineId, plantLines))!;
    const verification = runVerification(analysis.parameters, table, analyteLabel, lineId ?? undefined);
    const colDesc = table.id.endsWith("colA")
      ? " (colonna A - siti ad uso verde pubblico, privato e residenziale)"
      : table.id.endsWith("colB")
        ? " (colonna B - siti ad uso commerciale e industriale)"
        : "";
    const blocks: MessageBlock[] = [
      {
        type: "text",
        text: `Ho analizzato il rapporto di prova allegato: "${document.filename}". Ecco il risultato del confronto con i limiti della ${table.name.split("(")[0].trim()}${colDesc}.`,
      },
      inquadramento(analysis, lineId, tableLimitsLabel(table)),
      { type: "esito", verification, document_name: document.filename },
      conclusione(verification, lineId),
    ];
    return { blocks, verification, verifications: [verification], table_id: table.id, line_id: lineId };
  }

  // Generic assistant answer with pointers.
  const line = store.line(lineId);
  return {
    blocks: [
      {
        type: "text",
        text:
          `Il documento attivo è "${document.filename}" (CER ${analysis.header.eer_declared}). ` +
          `Posso: verificare la conformità contro una tabella (es. «verifica contro Tabella 5 colonna B», «limiti discarica inerti»), ` +
          `controllare il vincolo POP («verifica POP/PFAS») o valutare l'accettabilità sulla linea ${line?.name ?? ""}. ` +
          `Le tabelle disponibili: ${seed.tables.map((t) => t.name.split("(")[0].trim()).join("; ")}.`,
      },
    ],
    verification: null,
    verifications: [],
    table_id: tableId,
    line_id: lineId,
  };
}

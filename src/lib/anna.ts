// "Anna" — deterministic assistant for the MVP.
//
// Intent parsing + response composition only: every number in a reply comes
// from the rules engine. When a Claude API key is configured (Phase 1.1),
// this module becomes the tool layer the model calls; the deterministic
// fallback keeps the demo fully functional offline.

import { runVerification } from "./rules-engine";
import { analyteLabel, defaultLineId, getLine, getSeed, getTable, standardTableId } from "./seed";
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

function inquadramento(analysis: AnalysisRecord, lineId: string | null, table: { name: string; normativa: string }): MessageBlock {
  const eer = analysis.header.eer_declared;
  const line = lineId ? getLine(lineId) : null;
  return {
    type: "inquadramento",
    items: [
      { label: "CER", value: `${eer} (${EER_DESCRIPTIONS[eer] ?? analysis.header.waste_description})` },
      { label: "Tipologia rifiuto", value: (analysis.header.waste_description || analysis.header.sample_type || "").replace(/^./, (c) => c.toLowerCase()) },
      ...(line ? [{ label: "Linea di destinazione", value: line.name.replace(/^Linea \d+ — /, "") }] : []),
      { label: "Limiti di riferimento", value: `${table.name} – ${table.normativa.split("(")[0].trim()}` },
    ],
  };
}

function conclusione(v: VerificationResult, lineId: string | null): MessageBlock {
  const line = lineId ? getLine(lineId) : null;
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
}): AnnaReply {
  const { message, analysis, document } = opts;
  const seed = getSeed();
  const lineId = detectLineId(message) ?? opts.defaultLineId ?? defaultLineId();
  // No table named in the message and none active: the line's standard limits.
  const tableId = detectTableId(message) ?? opts.defaultTableId ?? standardTableId(lineId);

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

  if (wantsVerification(message) || detectTableId(message)) {
    const table = getTable(tableId) ?? getTable(standardTableId(lineId))!;
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
      inquadramento(analysis, lineId, table),
      { type: "esito", verification, document_name: document.filename },
      conclusione(verification, lineId),
    ];
    return { blocks, verification, verifications: [verification], table_id: table.id, line_id: lineId };
  }

  // Generic assistant answer with pointers.
  const line = getLine(lineId);
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

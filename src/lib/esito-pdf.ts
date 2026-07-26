// PDF export of a verification (esito di conformità) — Phase 2.
// pdf-lib, A4, styled to match the app: header, document metadata, per-
// parameter table with colored verdicts, conclusion, disclaimer footer.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { AnalysisRecord, DocumentRecord, VerificationRecord } from "./types";

const GREEN = rgb(0.086, 0.639, 0.29);
const DARK = rgb(0.05, 0.16, 0.1);
const RED = rgb(0.86, 0.15, 0.15);
const GRAY = rgb(0.45, 0.5, 0.48);
const LIGHT = rgb(0.93, 0.95, 0.93);

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;

// pdf-lib standard fonts are WinAnsi — strip characters they cannot encode.
function safe(s: string): string {
  return s
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/’/g, "'")
    .replace(/“|”/g, '"')
    .replace(/≤/g, "<=")
    .replace(/[^\x20-\xFF]/g, "?");
}

export async function esitoPdf(
  verification: VerificationRecord,
  document: DocumentRecord | null,
  analysis: AnalysisRecord | null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const newPage = () => {
    page = pdf.addPage(A4);
    y = A4[1] - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 40) newPage();
  };
  const text = (s: string, x: number, size: number, f: PDFFont, color = DARK) => {
    page.drawText(safe(s), { x, y, size, font: f, color });
  };

  // Header band
  page.drawRectangle({ x: 0, y: A4[1] - 70, width: A4[0], height: 70, color: DARK });
  page.drawText("VALLI SPA AI", { x: MARGIN, y: A4[1] - 40, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Esito di conformita — verifica analitica", {
    x: MARGIN, y: A4[1] - 56, size: 10, font, color: rgb(0.7, 0.95, 0.78),
  });
  y = A4[1] - 100;

  // Metadata
  const meta: [string, string][] = [
    ["Documento", document?.filename ?? "-"],
    ["CER dichiarato", analysis?.header.eer_declared ?? "-"],
    ["Laboratorio", analysis?.header.laboratory ?? "-"],
    ["Tabella limiti", verification.limit_table_name],
    ["Normativa", verification.normativa],
    ["Verificato da", verification.requested_by],
    ["Data verifica", new Date(verification.created_at).toLocaleString("it-IT")],
  ];
  for (const [k, v] of meta) {
    text(k, MARGIN, 9, bold, GRAY);
    text(v, MARGIN + 110, 9, font);
    y -= 14;
  }
  y -= 8;

  // Summary chips
  const chips: [string, string, ReturnType<typeof rgb>][] = [
    ["Conformi", String(verification.counts.conforme), GREEN],
    ["Non conformi", String(verification.counts.non_conforme), RED],
    ["Non determinati", String(verification.counts.non_determinato), GRAY],
    ["Totale", String(verification.evaluated_total), DARK],
  ];
  let cx = MARGIN;
  for (const [label, value, color] of chips) {
    page.drawRectangle({ x: cx, y: y - 26, width: 110, height: 34, color: LIGHT });
    page.drawText(safe(label), { x: cx + 8, y: y - 4, size: 8, font, color: GRAY });
    page.drawText(value, { x: cx + 8, y: y - 20, size: 13, font: bold, color });
    cx += 120;
  }
  y -= 48;

  // Table header
  const cols = [MARGIN, MARGIN + 170, MARGIN + 250, MARGIN + 320, MARGIN + 400];
  const header = ["Parametro", "Risultato", "U.M.", "Limite", "Esito"];
  page.drawRectangle({ x: MARGIN - 4, y: y - 4, width: A4[0] - 2 * MARGIN + 8, height: 16, color: LIGHT });
  header.forEach((h, i) => text(h, cols[i], 8, bold, GRAY));
  y -= 16;

  const ESITO_LABEL: Record<string, [string, ReturnType<typeof rgb>]> = {
    conforme: ["Conforme", GREEN],
    non_conforme: ["NON conforme", RED],
    non_determinato: ["Non determinato", GRAY],
    non_applicabile: ["Non applicabile", GRAY],
  };

  for (const v of verification.verdicts) {
    ensure(14);
    if (v.esito === "non_conforme") {
      page.drawRectangle({ x: MARGIN - 4, y: y - 3, width: A4[0] - 2 * MARGIN + 8, height: 12, color: rgb(0.99, 0.93, 0.93) });
    }
    const [label, color] = ESITO_LABEL[v.esito];
    text(v.label.replace(/\s*—\s*eluato$/, "").slice(0, 38), cols[0], 8, font);
    text(v.result_raw, cols[1], 8, v.esito === "non_conforme" ? bold : font, v.esito === "non_conforme" ? RED : DARK);
    text(v.unit.slice(0, 14), cols[2], 8, font, GRAY);
    text(v.limit_display ?? "-", cols[3], 8, font);
    text(label, cols[4], 8, bold, color);
    y -= 12;
  }

  if (verification.missing_analytes.length > 0) {
    ensure(24);
    y -= 8;
    text(
      `Parametri previsti dalla tabella ma assenti nel rapporto: ${verification.missing_analytes
        .map((m) => m.label.replace(/\s*—\s*eluato$/, ""))
        .join(", ")}`.slice(0, 160),
      MARGIN, 7.5, font, GRAY,
    );
    y -= 10;
  }

  // Conclusion box
  ensure(80);
  y -= 10;
  const ok = verification.overall === "conforme";
  const nc = verification.verdicts.filter((x) => x.esito === "non_conforme");
  const lines = ok
    ? [
        `Il rifiuto E' CONFORME ai limiti della ${verification.limit_table_name.split("(")[0].trim()}.`,
        ...(verification.counts.non_determinato > 0
          ? [`Attenzione: ${verification.counts.non_determinato} parametri non determinati (LOQ > limite).`]
          : []),
      ]
    : [
        `Il rifiuto NON E' CONFORME ai limiti della ${verification.limit_table_name.split("(")[0].trim()}:`,
        ...nc.map((x) => `- ${x.label.replace(/\s*\(.*\)$/, "")}: ${x.result_raw} > ${x.limit_display} ${x.unit}`),
        ...(verification.blocking && verification.blocking_consequence
          ? [safe(verification.blocking_consequence)]
          : []),
      ];
  const boxH = 24 + lines.length * 12;
  page.drawRectangle({
    x: MARGIN - 4, y: y - boxH + 10, width: A4[0] - 2 * MARGIN + 8, height: boxH,
    color: ok ? rgb(0.93, 0.97, 0.94) : rgb(0.99, 0.94, 0.94),
  });
  text("CONCLUSIONE", MARGIN + 4, 9, bold, ok ? GREEN : RED);
  y -= 14;
  for (const l of lines) {
    text(l.slice(0, 120), MARGIN + 4, 8.5, font);
    y -= 12;
  }

  // Disclaimer footer on every page
  for (const p of pdf.getPages()) {
    p.drawText(
      safe(
        "Documento generato da Valli SPA AI. Tabelle limiti in stato SIMULATO - valori da validare prima dell'uso operativo.",
      ),
      { x: MARGIN, y: 28, size: 7, font, color: GRAY },
    );
  }

  return pdf.save();
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";
import { aiEnabled, extractFromPdf } from "@/lib/ai";
import { getSeed } from "@/lib/seed";
import { newId, store, UPLOAD_DIR } from "@/lib/store";
import type { AnalysisRecord, DocumentRecord } from "@/lib/types";

// Extraction: with ANTHROPIC_API_KEY set, uploaded PDFs are read by Claude
// (structured output constrained to the analyte registry). Without a key —
// or if the AI call fails — uploads fall back to the seed fixtures (matched
// by filename tokens) so the demo keeps working.
const FIXTURE_PATTERNS: [RegExp, string][] = [
  [/26M51914|170903|sond/i, "R1"],
  [/0842|170504|ANAL/i, "R2"],
  [/BON|pfas|pop/i, "R3"],
  [/SOV|19\s*12\s*12|sovvall/i, "R4"],
];

export async function POST(req: NextRequest) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file mancante" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const docId = newId("doc");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const stored = `${docId}_${safeName}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);

  let extraction: Pick<AnalysisRecord, "header" | "parameters"> | null = null;
  let source: "claude" | "fixture" = "fixture";
  let aiError: string | null = null;

  if (aiEnabled() && file.name.toLowerCase().endsWith(".pdf")) {
    try {
      extraction = await extractFromPdf(buffer, file.name);
      source = "claude";
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }
  }

  if (!extraction) {
    const fixtureId = FIXTURE_PATTERNS.find(([re]) => re.test(file.name))?.[1] ?? "R1";
    const fixture = getSeed().reports.find((r) => r.id === fixtureId)!;
    extraction = {
      header: structuredClone(fixture.extraction.header),
      parameters: structuredClone(fixture.extraction.parameters),
    };
  }

  const doc: DocumentRecord = {
    id: docId,
    filename: file.name,
    uploaded_at: new Date().toISOString(),
    size: file.size,
    source: "upload",
    fixture_id: source === "claude" ? null : "R1",
    pdf_url: `/api/files/${encodeURIComponent(stored)}`,
    pages: 1,
  };
  const analysis: AnalysisRecord = {
    id: newId("ana"),
    document_id: docId,
    header: extraction.header,
    parameters: extraction.parameters,
    edited: false,
    extraction_source: source,
  };
  store.addDocument(doc, analysis);
  return NextResponse.json({ document: doc, analysis, extraction_source: source, ai_error: aiError });
}

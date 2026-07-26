import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSeed } from "@/lib/seed";
import { newId, store, UPLOAD_DIR } from "@/lib/store";
import type { AnalysisRecord, DocumentRecord } from "@/lib/types";

// Simulated extraction: uploaded files are matched to a seed fixture
// (by tokens in the filename); unmatched files fall back to R1 so the
// demo always works. With ANTHROPIC_API_KEY configured, this is where
// the real Claude extraction call goes (Phase 1.1).
const FIXTURE_PATTERNS: [RegExp, string][] = [
  [/26M51914|170903|sond/i, "R1"],
  [/0842|170504|ANAL/i, "R2"],
  [/BON|pfas|pop/i, "R3"],
  [/SOV|19\s*12\s*12|sovvall/i, "R4"],
];

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file mancante" }, { status: 400 });
  }

  const fixtureId =
    FIXTURE_PATTERNS.find(([re]) => re.test(file.name))?.[1] ?? "R1";
  const fixture = getSeed().reports.find((r) => r.id === fixtureId)!;

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const docId = newId("doc");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const stored = `${docId}_${safeName}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));

  const doc: DocumentRecord = {
    id: docId,
    filename: file.name,
    uploaded_at: new Date().toISOString(),
    size: file.size,
    source: "upload",
    fixture_id: fixtureId,
    pdf_url: `/api/files/${encodeURIComponent(stored)}`,
    pages: fixtureId === "R2" ? 2 : 1,
  };
  const analysis: AnalysisRecord = {
    id: newId("ana"),
    document_id: docId,
    header: structuredClone(fixture.extraction.header),
    parameters: structuredClone(fixture.extraction.parameters),
    edited: false,
  };
  store.addDocument(doc, analysis);
  return NextResponse.json({ document: doc, analysis, simulated: true, fixture_id: fixtureId });
}

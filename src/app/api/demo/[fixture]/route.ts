import { NextRequest, NextResponse } from "next/server";
import { getSeed } from "@/lib/seed";
import { newId, store } from "@/lib/store";
import type { AnalysisRecord, DocumentRecord } from "@/lib/types";

// Instantiates a bundled demo fixture as an active document (no upload needed).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ fixture: string }> },
) {
  const { fixture } = await params;
  const report = getSeed().reports.find((r) => r.id === fixture);
  if (!report) return NextResponse.json({ error: "fixture sconosciuta" }, { status: 404 });

  const filename = report.pdf
    ? report.pdf.replace(/^pdf\//, "")
    : `${report.extraction.header.report_number.replace(/[^\w-]+/g, "_")}.pdf`;

  const doc: DocumentRecord = {
    id: newId("doc"),
    filename,
    uploaded_at: new Date().toISOString(),
    size: 1_200_000,
    source: "seed_fixture",
    fixture_id: report.id,
    pdf_url: report.pdf ? `/api/seed-pdf/${report.id}` : null,
    pages: report.id === "R2" ? 2 : 1,
  };
  const analysis: AnalysisRecord = {
    id: newId("ana"),
    document_id: doc.id,
    header: structuredClone(report.extraction.header),
    parameters: structuredClone(report.extraction.parameters),
    edited: false,
    extraction_source: "fixture",
  };
  store.addDocument(doc, analysis);
  return NextResponse.json({ document: doc, analysis });
}

import { NextRequest, NextResponse } from "next/server";
import { annaRespond } from "@/lib/anna";
import { newId, store } from "@/lib/store";
import type { VerificationRecord } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    message: string;
    document_id?: string | null;
    table_id?: string | null;
    line_id?: string | null;
  };

  const document = body.document_id ? store.document(body.document_id) : null;
  const analysis = document ? store.analysisForDocument(document.id) : null;

  const reply = annaRespond({
    message: body.message ?? "",
    analysis,
    document,
    defaultTableId: body.table_id,
    defaultLineId: body.line_id,
  });

  if (reply.verification && document && analysis) {
    const record: VerificationRecord = {
      ...reply.verification,
      id: newId("ver"),
      analysis_id: analysis.id,
      document_id: document.id,
      created_at: new Date().toISOString(),
      requested_by: "Federico Parolini",
    };
    store.addVerification(record);
  }

  return NextResponse.json(reply);
}

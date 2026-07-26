import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { newId, store } from "@/lib/store";
import type { PortalSubmission } from "@/lib/types";

// Portale clienti (Phase 3).
// GET  -> producer: own submissions; staff: all submissions
// POST -> producer submits an uploaded report (document created via /api/upload)

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  const all = store.submissions();
  const user = session!.user;
  const visible =
    user.role === "producer"
      ? all.filter((s) => s.producer_email.toLowerCase() === (user.email ?? "").toLowerCase())
      : all;
  return NextResponse.json({ submissions: visible });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  const user = session!.user;
  if (user.role !== "producer") {
    return NextResponse.json(
      { error: "solo gli account produttore inviano rapporti dal portale" },
      { status: 403 },
    );
  }
  const body = (await req.json()) as { document_id?: string; message?: string };
  const document = body.document_id ? store.document(body.document_id) : null;
  const analysis = document ? store.analysisForDocument(document.id) : null;
  if (!document || !analysis) {
    return NextResponse.json({ error: "documento non trovato" }, { status: 400 });
  }
  const submission: PortalSubmission = {
    id: newId("sub"),
    producer_email: user.email ?? "",
    producer_name: user.company ?? user.name ?? "",
    document_id: document.id,
    analysis_id: analysis.id,
    message: body.message?.trim() || undefined,
    status: "inviato",
    verification_id: null,
    conversation_id: null,
    created_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
  };
  store.addSubmission(submission);
  return NextResponse.json({ ok: true, submission });
}

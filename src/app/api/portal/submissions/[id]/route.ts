import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { runVerification } from "@/lib/rules-engine";
import { analyteLabel, getTable, standardTableId } from "@/lib/seed";
import { newId, store } from "@/lib/store";
import type { Conversation, VerificationRecord } from "@/lib/types";

// Staff review of a portal submission.
// PATCH {action:"verifica"} -> run the standard comparison for the default
//   line, record it in the audit trail and close the submission with the esito.
// PATCH {action:"chat"}     -> open (or reuse) a conversation with the
//   submitted document attached, for a full review with Anna.

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;
  const submission = store.submission(id);
  if (!submission) return NextResponse.json({ error: "invio non trovato" }, { status: 404 });
  const document = store.document(submission.document_id);
  const analysis = document ? store.analysisForDocument(document.id) : null;
  if (!document || !analysis) {
    return NextResponse.json({ error: "documento dell'invio non trovato" }, { status: 404 });
  }
  const body = (await req.json()) as { action: "verifica" | "chat"; line_id?: string };

  if (body.action === "chat") {
    if (submission.conversation_id && store.conversation(submission.conversation_id)) {
      return NextResponse.json({ ok: true, conversation_id: submission.conversation_id });
    }
    const plantLines = store.lines();
    const lineId = body.line_id && store.line(body.line_id) ? body.line_id : plantLines[0]?.id ?? null;
    const conversation: Conversation = {
      id: newId("conv"),
      title: `Portale — ${submission.producer_name} · ${document.filename}`,
      created_at: new Date().toISOString(),
      messages: [
        {
          id: newId("msg"),
          role: "user",
          time: new Date().toISOString(),
          text: `Rapporto di prova ricevuto dal portale clienti (${submission.producer_name}).${
            submission.message ? ` Nota del cliente: "${submission.message}"` : ""
          }`,
          attachment: { document_id: document.id, filename: document.filename },
        },
      ],
      active_document_id: document.id,
      active_table_id: standardTableId(lineId, plantLines),
      active_line_id: lineId,
    };
    store.upsertConversation(conversation);
    store.updateSubmission(id, { conversation_id: conversation.id });
    return NextResponse.json({ ok: true, conversation_id: conversation.id });
  }

  if (body.action === "verifica") {
    const plantLines = store.lines();
    const lineId = body.line_id && store.line(body.line_id) ? body.line_id! : plantLines[0]?.id;
    const table = getTable(standardTableId(lineId, plantLines));
    if (!table) return NextResponse.json({ error: "tabella limiti non trovata" }, { status: 500 });
    const verification = runVerification(analysis.parameters, table, analyteLabel, lineId);
    const record: VerificationRecord = {
      ...verification,
      id: newId("ver"),
      analysis_id: analysis.id,
      document_id: document.id,
      created_at: new Date().toISOString(),
      requested_by: session!.user.name ?? "Operatore",
    };
    store.addVerification(record);
    const updated = store.updateSubmission(id, {
      status: "completato",
      esito: verification.overall,
      verification_id: record.id,
      reviewed_at: record.created_at,
      reviewed_by: record.requested_by,
    });
    return NextResponse.json({ ok: true, submission: updated, verification: record });
  }

  return NextResponse.json({ error: "azione sconosciuta" }, { status: 400 });
}

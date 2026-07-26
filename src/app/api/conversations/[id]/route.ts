import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

// Full conversation + its active document/analysis, for restoring a chat
// from the history view.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const conversation = store.conversation(id);
  if (!conversation) return NextResponse.json({ error: "conversazione non trovata" }, { status: 404 });
  const document = conversation.active_document_id
    ? store.document(conversation.active_document_id)
    : null;
  const analysis = document ? store.analysisForDocument(document.id) : null;
  return NextResponse.json({ conversation, document, analysis });
}

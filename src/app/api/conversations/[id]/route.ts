import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { store } from "@/lib/store";

// Full conversation + its active document/analysis, for restoring a chat
// from the history view.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = store.conversation(id);
  if (!conversation) return NextResponse.json({ error: "conversazione non trovata" }, { status: 404 });
  const document = conversation.active_document_id
    ? store.document(conversation.active_document_id)
    : null;
  const analysis = document ? store.analysisForDocument(document.id) : null;
  return NextResponse.json({ conversation, document, analysis });
}

// PATCH: rename the conversation (user-chosen title wins over auto-titling).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = store.conversation(id);
  if (!conversation) return NextResponse.json({ error: "conversazione non trovata" }, { status: 404 });
  const body = (await req.json()) as { title?: string };
  const title = body.title?.trim() ?? "";
  if (title.length < 1 || title.length > 90) {
    return NextResponse.json({ error: "titolo non valido (1-90 caratteri)" }, { status: 400 });
  }
  conversation.title = title;
  conversation.title_custom = true;
  store.upsertConversation(conversation);
  return NextResponse.json({ ok: true, conversation: { id: conversation.id, title: conversation.title } });
}

// DELETE: remove the conversation (documents and verifications are kept).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  if (!store.deleteConversation(id)) {
    return NextResponse.json({ error: "conversazione non trovata" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

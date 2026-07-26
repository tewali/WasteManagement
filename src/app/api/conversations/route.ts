import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSeed } from "@/lib/seed";
import { newId, store } from "@/lib/store";
import type { ChatMessage, Conversation } from "@/lib/types";

// GET  -> conversation summaries for the history view (newest first)
// POST -> upsert the full conversation; auto-titles it from the active
//         document (producer + CER + waste type) when possible.

export async function GET() {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const list = store.get().conversations.map((c) => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
    messages: c.messages.length,
    active_document_id: c.active_document_id,
  }));
  return NextResponse.json({ conversations: list });
}

function autoTitle(activeDocumentId: string | null, messages: ChatMessage[]): string {
  if (activeDocumentId) {
    const doc = store.document(activeDocumentId);
    const analysis = doc ? store.analysisForDocument(doc.id) : null;
    if (doc && analysis) {
      const seed = getSeed();
      const fixture = doc.fixture_id ? seed.reports.find((r) => r.id === doc.fixture_id) : null;
      const producer = fixture
        ? seed.producers.find((p) => p.id === fixture.producer_id)?.name
        : null;
      const type = analysis.header.sample_type ?? analysis.header.waste_description;
      const parts = [producer, `CER ${analysis.header.eer_declared}`, type].filter(Boolean);
      return parts.join(" · ").slice(0, 90);
    }
  }
  const firstUser = messages.find((m) => m.role === "user")?.text?.trim();
  if (firstUser) return firstUser.slice(0, 60) + (firstUser.length > 60 ? "…" : "");
  return `Conversazione del ${new Date().toLocaleDateString("it-IT")}`;
}

export async function POST(req: NextRequest) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<Conversation> & { messages: ChatMessage[] };
  const existing = body.id ? store.conversation(body.id) : null;
  const conversation: Conversation = {
    id: existing?.id ?? newId("conv"),
    created_at: existing?.created_at ?? new Date().toISOString(),
    title: autoTitle(body.active_document_id ?? null, body.messages ?? []),
    messages: body.messages ?? [],
    active_document_id: body.active_document_id ?? null,
    active_table_id: body.active_table_id ?? null,
    active_line_id: body.active_line_id ?? null,
  };
  store.upsertConversation(conversation);
  return NextResponse.json({ conversation: { ...conversation, messages: conversation.messages.length } });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSeed } from "@/lib/seed";
import { newId, store } from "@/lib/store";
import type { ChatMessage, Conversation } from "@/lib/types";

// GET  -> conversation summaries for the history view (newest first)
// POST -> upsert the full conversation; auto-titles it from the active
//         document (producer + CER + waste type) when possible.

export async function GET(req: NextRequest) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "15", 10) || 15));

  const { conversations, documents } = store.get();
  const all = conversations.map((c) => {
    const document = c.active_document_id
      ? (documents.find((d) => d.id === c.active_document_id)?.filename ?? null)
      : null;
    return {
      id: c.id,
      title: c.title,
      created_at: c.created_at,
      messages: c.messages.length,
      document,
      // Search haystack: title + document name + message texts.
      _hay: q
        ? `${c.title}\n${document ?? ""}\n${c.messages.map((m) => m.text ?? "").join("\n")}`.toLowerCase()
        : "",
    };
  });
  const filtered = q ? all.filter((c) => c._hay.includes(q)) : all;
  const page = filtered.slice(offset, offset + limit).map(({ _hay: _h, ...c }) => c);
  return NextResponse.json({
    conversations: page,
    total: filtered.length,
    has_more: offset + limit < filtered.length,
  });
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
    // A user-chosen title survives; otherwise keep auto-titling.
    title: existing?.title_custom
      ? existing.title
      : autoTitle(body.active_document_id ?? null, body.messages ?? []),
    title_custom: existing?.title_custom ?? false,
    messages: body.messages ?? [],
    active_document_id: body.active_document_id ?? null,
    active_table_id: body.active_table_id ?? null,
    active_line_id: body.active_line_id ?? null,
  };
  store.upsertConversation(conversation);
  return NextResponse.json({ conversation: { ...conversation, messages: conversation.messages.length } });
}

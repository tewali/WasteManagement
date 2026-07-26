import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { aiEnabled, annaChat } from "@/lib/ai";
import { annaRespond } from "@/lib/anna";
import { newId, store } from "@/lib/store";
import type { VerificationRecord } from "@/lib/types";

// With ANTHROPIC_API_KEY set, Anna is Claude (claude-opus-5) with the
// run_comparison tool — every conformity number still comes from the
// deterministic rules engine. Without a key, the deterministic intent
// parser answers so the demo keeps working offline.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  const body = (await req.json()) as {
    message: string;
    history?: { role: "user" | "assistant"; text: string }[];
    document_id?: string | null;
    table_id?: string | null;
    line_id?: string | null;
  };

  const document = body.document_id ? store.document(body.document_id) : null;
  const analysis = document ? store.analysisForDocument(document.id) : null;

  let reply;
  let engine: "claude" | "deterministic" = "deterministic";
  if (aiEnabled()) {
    try {
      reply = await annaChat({
        message: body.message ?? "",
        history: body.history ?? [],
        analysis,
        document,
      });
      engine = "claude";
    } catch {
      reply = null;
    }
  }
  if (!reply) {
    reply = annaRespond({
      message: body.message ?? "",
      analysis,
      document,
      defaultTableId: body.table_id,
      defaultLineId: body.line_id,
    });
  }

  if (reply.verification && document && analysis) {
    const record: VerificationRecord = {
      ...reply.verification,
      id: newId("ver"),
      analysis_id: analysis.id,
      document_id: document.id,
      created_at: new Date().toISOString(),
      requested_by: session.user.name ?? "Operatore",
    };
    store.addVerification(record);
  }

  return NextResponse.json({ ...reply, engine });
}

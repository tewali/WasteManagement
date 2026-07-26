import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { effectiveStatus } from "@/lib/omologhe";
import { newId, store } from "@/lib/store";
import type { OmologaRecord } from "@/lib/types";

// Omologa lifecycle (Phase 2): the periodic waste-characterization record
// between producer and plant, with an expiry date.
// GET  -> list (with computed effective status)
// POST -> create (defaults: valid_from today, 12 months validity)

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  const omologhe = store.omologhe().map((o) => ({ ...o, effective_status: effectiveStatus(o) }));
  return NextResponse.json({ omologhe });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  const body = (await req.json()) as Partial<OmologaRecord> & { months?: number };

  const producer = body.producer_name?.trim() ?? "";
  const eer = (body.eer ?? "").trim().replace(/\s+/g, " ");
  if (producer.length < 2) return NextResponse.json({ error: "Indicare il produttore." }, { status: 400 });
  if (!/^\d{2} \d{2} \d{2}\*?$/.test(eer)) {
    return NextResponse.json({ error: "Codice EER non valido (formato 'NN NN NN' o 'NN NN NN*')." }, { status: 400 });
  }
  const line = body.line_id ? store.line(body.line_id) : store.lines()[0];
  if (!line) return NextResponse.json({ error: "Linea non trovata." }, { status: 400 });

  const from = body.valid_from ?? new Date().toISOString().slice(0, 10);
  const months = Math.min(36, Math.max(1, body.months ?? 12));
  const to = new Date(from + "T00:00:00");
  to.setMonth(to.getMonth() + months);

  const omologa: OmologaRecord = {
    id: newId("omo"),
    producer_name: producer,
    eer,
    waste_description: body.waste_description?.trim() ?? "",
    line_id: line.id,
    document_id: body.document_id ?? null,
    analysis_id: body.analysis_id ?? null,
    status: body.status === "bozza" ? "bozza" : "attiva",
    valid_from: from,
    valid_to: to.toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    created_by: session.user.name ?? "Operatore",
    notes: body.notes?.trim() || undefined,
  };
  store.addOmologa(omologa);
  return NextResponse.json({ ok: true, omologa });
}

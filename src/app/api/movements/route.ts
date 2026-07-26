import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { nextFirNumber, registroEntries } from "@/lib/movements";
import { newId, store } from "@/lib/store";
import type { MovementRecord } from "@/lib/types";

// Movimenti / FIR digitale (Phase 3).
// GET  -> movements (newest first) + derived registro cronologico
// POST -> register an incoming conferimento (FIR number auto-assigned)

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  const movements = store.movements();
  return NextResponse.json({ movements, registro: registroEntries(movements) });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireStaff();
  if (error) return error;
  const body = (await req.json()) as Partial<MovementRecord>;

  const producer = body.producer_name?.trim() ?? "";
  if (producer.length < 3) {
    return NextResponse.json({ error: "Indicare il produttore." }, { status: 400 });
  }
  const eer = (body.eer ?? "").trim().replace(/\s+/g, " ");
  if (!/^\d{2} \d{2} \d{2}\*?$/.test(eer)) {
    return NextResponse.json(
      { error: "Codice EER non valido (formato 'NN NN NN' o 'NN NN NN*')." },
      { status: 400 },
    );
  }
  const line = body.line_id ? store.line(body.line_id) : null;
  if (!line) {
    return NextResponse.json({ error: "Linea di destinazione non trovata." }, { status: 400 });
  }
  const declared = Number(body.quantity_declared_kg);
  if (!Number.isFinite(declared) || declared <= 0) {
    return NextResponse.json({ error: "Quantità dichiarata (kg) non valida." }, { status: 400 });
  }
  const date = (body.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Data del movimento non valida." }, { status: 400 });
  }
  const t = body.transporter;
  if (!t?.name?.trim()) {
    return NextResponse.json({ error: "Indicare il trasportatore." }, { status: 400 });
  }

  const movements = store.movements();
  const movement: MovementRecord = {
    id: newId("mov"),
    fir_number: nextFirNumber(movements, Number(date.slice(0, 4))),
    date,
    producer_id: body.producer_id ?? null,
    producer_name: producer,
    transporter: {
      name: t.name.trim(),
      albo_number: t.albo_number?.trim() ?? "",
      plate: t.plate?.trim() ?? "",
    },
    eer,
    description: body.description?.trim() ?? "",
    line_id: line.id,
    omologa_id: body.omologa_id ?? null,
    quantity_declared_kg: declared,
    quantity_weighed_kg: null,
    status: "in_arrivo",
    rentri: null,
    created_at: new Date().toISOString(),
    created_by: session!.user.name ?? "Operatore",
  };
  // EER admissibility on the target line is a warning, not a hard stop —
  // acceptance is the explicit decision recorded later.
  const eer_admissible = line.admissible_eer.some(
    (c) => c.trim().replace(/\s+/g, " ") === eer,
  );
  store.addMovement(movement);
  return NextResponse.json({ ok: true, movement, eer_admissible });
}

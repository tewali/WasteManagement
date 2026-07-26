import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { hasWeighDiscrepancy } from "@/lib/movements";
import { store } from "@/lib/store";

// Single movement actions.
// PATCH {action:"accetta"} | {action:"respingi", reason} | {action:"pesa", gross_kg, tare_kg}
// DELETE -> only movements still "in_arrivo" and never transmitted

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;
  const m = store.movement(id);
  if (!m) return NextResponse.json({ error: "movimento non trovato" }, { status: 404 });
  const body = (await req.json()) as {
    action: "accetta" | "respingi" | "pesa";
    reason?: string;
    gross_kg?: number;
    tare_kg?: number;
  };

  if (body.action === "accetta") {
    if (m.status === "respinto") {
      return NextResponse.json({ error: "il movimento è già stato respinto" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, movement: store.updateMovement(id, { status: "accettato" }) });
  }

  if (body.action === "respingi") {
    const reason = body.reason?.trim();
    if (!reason) {
      return NextResponse.json({ error: "indicare il motivo del respingimento" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      movement: store.updateMovement(id, { status: "respinto", rejection_reason: reason }),
    });
  }

  if (body.action === "pesa") {
    const gross = Number(body.gross_kg);
    const tare = Number(body.tare_kg);
    if (!Number.isFinite(gross) || !Number.isFinite(tare) || gross <= 0 || tare < 0 || tare >= gross) {
      return NextResponse.json({ error: "pesi non validi (lordo > tara ≥ 0)" }, { status: 400 });
    }
    const net = gross - tare;
    return NextResponse.json({
      ok: true,
      movement: store.updateMovement(id, {
        quantity_weighed_kg: net,
        weigh_discrepancy: hasWeighDiscrepancy(m.quantity_declared_kg, net),
      }),
    });
  }

  return NextResponse.json({ error: "azione sconosciuta" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;
  const m = store.movement(id);
  if (!m) return NextResponse.json({ error: "movimento non trovato" }, { status: 404 });
  if (m.status !== "in_arrivo" || m.rentri) {
    return NextResponse.json(
      { error: "si possono eliminare solo movimenti in arrivo non trasmessi a RENTRI" },
      { status: 400 },
    );
  }
  store.deleteMovement(id);
  return NextResponse.json({ ok: true });
}

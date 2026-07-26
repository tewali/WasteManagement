import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { rentriPayload } from "@/lib/movements";
import { getSeed } from "@/lib/seed";
import { store } from "@/lib/store";

// RENTRI transmission — SIMULATED. POST marks the movement as transmitted and
// assigns a transaction id; GET returns the FIR digitale payload that a real
// integration would send (viewable/downloadable for validation). Nothing
// leaves the application.

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;
  const m = store.movement(id);
  if (!m) return NextResponse.json({ error: "movimento non trovato" }, { status: 404 });
  return NextResponse.json({
    payload: rentriPayload(m, getSeed().plant),
    transmitted: m.rentri,
  });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff();
  if (error) return error;
  const { id } = await ctx.params;
  const m = store.movement(id);
  if (!m) return NextResponse.json({ error: "movimento non trovato" }, { status: 404 });
  if (m.status === "in_arrivo") {
    return NextResponse.json(
      { error: "registrare prima l'esito del conferimento (accettato o respinto)" },
      { status: 400 },
    );
  }
  if (m.rentri) {
    return NextResponse.json({ error: "movimento già trasmesso a RENTRI" }, { status: 400 });
  }
  const movement = store.updateMovement(id, {
    rentri: {
      transmitted_at: new Date().toISOString(),
      transaction_id: `RENTRI-SIM-${randomBytes(3).toString("hex").toUpperCase()}`,
    },
  });
  return NextResponse.json({ ok: true, movement });
}

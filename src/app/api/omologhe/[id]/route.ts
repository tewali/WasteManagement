import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { store } from "@/lib/store";

// PATCH: activate a draft, add notes, or renew (extend validity by N months).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await auth())?.user) return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  const { id } = await params;
  const o = store.omologa(id);
  if (!o) return NextResponse.json({ error: "omologa non trovata" }, { status: 404 });
  const body = (await req.json()) as { action?: "attiva" | "rinnova"; months?: number; notes?: string };

  if (body.action === "attiva") {
    store.updateOmologa(id, { status: "attiva" });
  } else if (body.action === "rinnova") {
    const months = Math.min(36, Math.max(1, body.months ?? 12));
    const base = new Date() > new Date(o.valid_to) ? new Date() : new Date(o.valid_to);
    const to = new Date(base);
    to.setMonth(to.getMonth() + months);
    store.updateOmologa(id, { status: "attiva", valid_to: to.toISOString().slice(0, 10) });
  }
  if (typeof body.notes === "string") store.updateOmologa(id, { notes: body.notes.trim() || undefined });

  return NextResponse.json({ ok: true, omologa: store.omologa(id) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await auth())?.user) return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  const { id } = await params;
  if (!store.deleteOmologa(id)) return NextResponse.json({ error: "omologa non trovata" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

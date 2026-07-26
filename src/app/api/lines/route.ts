import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSeed } from "@/lib/seed";
import { newId, store } from "@/lib/store";
import type { PlantLine } from "@/lib/types";

// Plant line configuration (Phase 2).
// GET  -> configured lines
// POST -> create a line
// PUT  -> replace a line (body: full PlantLine with id)
// DELETE ?id= -> remove a line (the last line cannot be removed)

function sanitize(body: Partial<PlantLine>, id: string): PlantLine | string {
  const name = body.name?.trim() ?? "";
  if (name.length < 3) return "Nome linea non valido.";
  const operation = body.operation?.trim() || "R13";
  const eer = (body.admissible_eer ?? [])
    .map((c) => c.trim().replace(/\s+/g, " "))
    .filter((c) => /^\d{2} \d{2} \d{2}\*?$/.test(c));
  if (eer.length === 0) return "Indicare almeno un codice EER valido (formato 'NN NN NN' o 'NN NN NN*').";
  const tables = getSeed().tables;
  const validTables = new Set(tables.map((t) => t.id));
  const blockingTables = new Set(tables.filter((t) => t.blocking).map((t) => t.id));
  const raw = (body.limit_bindings ?? []).filter((b) => validTables.has(b.limit_table_id));
  // The standard comparison (standardTableId) resolves the line's `primary`
  // binding: keep the one the client sent, or promote the first non-blocking
  // binding. A blocking layer (POP) can never be the standard table.
  const primaryId =
    raw.find((b) => !blockingTables.has(b.limit_table_id) && b.primary)?.limit_table_id ??
    raw.find((b) => !blockingTables.has(b.limit_table_id))?.limit_table_id;
  const bindings = raw.map((b) => ({
    limit_table_id: b.limit_table_id,
    purpose: b.purpose,
    ...(blockingTables.has(b.limit_table_id) ? { blocking: true } : {}),
    ...(b.limit_table_id === primaryId ? { primary: true } : {}),
  }));
  return {
    id,
    name,
    operation,
    description: body.description?.trim() ?? "",
    admissible_eer: eer,
    annual_capacity_t: Math.max(0, Number(body.annual_capacity_t) || 0),
    limit_bindings: bindings,
  };
}

export async function GET() {
  if (!(await auth())?.user) return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  return NextResponse.json({ lines: store.lines() });
}

export async function POST(req: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  const body = (await req.json()) as Partial<PlantLine>;
  const line = sanitize(body, newId("line"));
  if (typeof line === "string") return NextResponse.json({ error: line }, { status: 400 });
  store.saveLines([...store.lines(), line]);
  return NextResponse.json({ ok: true, line });
}

export async function PUT(req: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  const body = (await req.json()) as Partial<PlantLine>;
  if (!body.id) return NextResponse.json({ error: "id mancante" }, { status: 400 });
  const lines = store.lines();
  const i = lines.findIndex((l) => l.id === body.id);
  if (i < 0) return NextResponse.json({ error: "linea non trovata" }, { status: 404 });
  const line = sanitize(body, body.id);
  if (typeof line === "string") return NextResponse.json({ error: line }, { status: 400 });
  const next = [...lines];
  next[i] = line;
  store.saveLines(next);
  return NextResponse.json({ ok: true, line });
}

export async function DELETE(req: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  const lines = store.lines();
  if (lines.length <= 1) {
    return NextResponse.json(
      { error: "l'impianto deve avere almeno una linea operativa" },
      { status: 400 },
    );
  }
  const next = lines.filter((l) => l.id !== id);
  if (next.length === lines.length) return NextResponse.json({ error: "linea non trovata" }, { status: 404 });
  store.saveLines(next);
  return NextResponse.json({ ok: true });
}

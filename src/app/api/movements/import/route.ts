import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { hasWeighDiscrepancy, parseWeighbridgeCsv, WEIGHBRIDGE_TEMPLATE } from "@/lib/movements";
import { store } from "@/lib/store";

// Weighbridge (pesa) CSV import: matches rows to movements by FIR number and
// records the net weight. GET returns the CSV template.

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return new NextResponse(WEIGHBRIDGE_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pesa-template.csv"',
    },
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  let text: string | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const file = (await req.formData()).get("file");
    if (file instanceof File) text = await file.text();
  } else {
    text = await req.text();
  }
  if (!text?.trim()) {
    return NextResponse.json({ error: "nessun file CSV ricevuto" }, { status: 400 });
  }

  const { rows, errors } = parseWeighbridgeCsv(text);
  const movements = store.movements();
  const updated: { fir_number: string; net_kg: number; discrepancy: boolean }[] = [];
  const unmatched: string[] = [];
  for (const row of rows) {
    const m = movements.find((x) => x.fir_number === row.fir_number);
    if (!m) {
      unmatched.push(row.fir_number);
      continue;
    }
    const discrepancy = hasWeighDiscrepancy(m.quantity_declared_kg, row.net_kg);
    store.updateMovement(m.id, {
      quantity_weighed_kg: row.net_kg,
      weigh_discrepancy: discrepancy,
    });
    updated.push({ fir_number: row.fir_number, net_kg: row.net_kg, discrepancy });
  }
  return NextResponse.json({ ok: true, updated, unmatched, errors });
}

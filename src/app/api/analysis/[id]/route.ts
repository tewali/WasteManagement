import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { ReportHeader, ReportParameter } from "@/lib/types";

// PATCH: save operator corrections to the extracted data ("Modifica").
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json()) as {
    header?: Partial<ReportHeader>;
    parameters?: ReportParameter[];
  };
  const current = store.get().analyses.find((a) => a.id === id);
  if (!current) return NextResponse.json({ error: "analisi non trovata" }, { status: 404 });
  const updated = store.updateAnalysis(id, {
    header: { ...current.header, ...body.header },
    ...(body.parameters ? { parameters: body.parameters } : {}),
  });
  return NextResponse.json({ analysis: updated });
}

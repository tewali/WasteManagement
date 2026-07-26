import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { esitoPdf } from "@/lib/esito-pdf";
import { store } from "@/lib/store";

// Download a verification as a formatted PDF report (Phase 2).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }
  const { id } = await params;
  const verification = store.get().verifications.find((v) => v.id === id);
  if (!verification) return NextResponse.json({ error: "verifica non trovata" }, { status: 404 });
  const document = store.document(verification.document_id);
  const analysis = store.get().analyses.find((a) => a.id === verification.analysis_id) ?? null;

  const bytes = await esitoPdf(verification, document, analysis);
  const filename = `esito_${(document?.filename ?? id).replace(/\.pdf$/i, "")}_${verification.limit_table_id}.pdf`;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\-]+/g, "_")}"`,
    },
  });
}

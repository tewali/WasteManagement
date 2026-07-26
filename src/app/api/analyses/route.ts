import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { store } from "@/lib/store";
import type { VerificationRecord } from "@/lib/types";

// GET -> paginated verification list for "Analisi e confronti" (newest first).
// Query params mirror /api/conversations: q (search), offset, limit.

export interface AnalysisListItem {
  verification: VerificationRecord;
  document: string | null;
  eer: string | null;
}

export async function GET(req: NextRequest) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10));

  const { verifications, documents, analyses } = store.get();
  const all = [...verifications]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((v) => {
      const document = documents.find((d) => d.id === v.document_id)?.filename ?? null;
      const eer = analyses.find((a) => a.id === v.analysis_id)?.header.eer_declared ?? null;
      return {
        verification: v,
        document,
        eer,
        // Search haystack: document + CER + table/normativa + requester + analytes.
        _hay: q
          ? [
              document ?? "",
              eer ?? "",
              v.limit_table_name,
              v.normativa,
              v.requested_by,
              v.overall,
              ...v.verdicts.map((x) => x.label),
            ]
              .join("\n")
              .toLowerCase()
          : "",
      };
    });
  const filtered = q ? all.filter((v) => v._hay.includes(q)) : all;
  const page: AnalysisListItem[] = filtered
    .slice(offset, offset + limit)
    .map(({ _hay: _h, ...v }) => v);
  return NextResponse.json({
    verifications: page,
    total: filtered.length,
    has_more: offset + limit < filtered.length,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { store } from "@/lib/store";

// GET -> paginated document list for "I miei documenti" (newest first).
// Query params mirror /api/conversations: q (search), offset, limit.

export interface DocumentListItem {
  id: string;
  filename: string;
  pdf_url: string | null;
  uploaded_at: string;
  eer: string | null;
  laboratory: string | null;
  extraction_source: "claude" | "fixture" | null;
  conversation: { id: string; title: string } | null;
}

export async function GET(req: NextRequest) {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "15", 10) || 15));

  const { documents, analyses, conversations } = store.get();
  const all = [...documents]
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
    .map((d) => {
      const a = analyses.find((x) => x.document_id === d.id);
      const conv = conversations.find((c) => c.active_document_id === d.id);
      const item: DocumentListItem = {
        id: d.id,
        filename: d.filename,
        pdf_url: d.pdf_url,
        uploaded_at: d.uploaded_at,
        eer: a?.header.eer_declared ?? null,
        laboratory: a?.header.laboratory ?? null,
        extraction_source: a?.extraction_source ?? (a ? "fixture" : null),
        conversation: conv ? { id: conv.id, title: conv.title } : null,
      };
      return {
        ...item,
        // Search haystack: filename + CER + laboratory + chat title.
        _hay: q
          ? [d.filename, item.eer ?? "", item.laboratory ?? "", conv?.title ?? ""]
              .join("\n")
              .toLowerCase()
          : "",
      };
    });
  const filtered = q ? all.filter((d) => d._hay.includes(q)) : all;
  const page: DocumentListItem[] = filtered
    .slice(offset, offset + limit)
    .map(({ _hay: _h, ...d }) => d);
  return NextResponse.json({
    documents: page,
    total: filtered.length,
    has_more: offset + limit < filtered.length,
  });
}

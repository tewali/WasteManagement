import { NextResponse } from "next/server";
import { store } from "@/lib/store";

// Notification feed: derived from app activity (verifications + uploads),
// newest first. The client tracks "seen" state locally.
export async function GET() {
  const { verifications, documents } = store.get();
  const items = [
    ...verifications.map((v) => ({
      id: `ver_${v.id}`,
      time: v.created_at,
      tone: v.blocking ? "ko" : v.overall === "conforme" ? "ok" : "ko",
      title: v.blocking
        ? "Vincolo POP — rifiuto non ammissibile"
        : v.overall === "conforme"
          ? "Verifica conforme"
          : "Verifica NON conforme",
      detail: `${documents.find((d) => d.id === v.document_id)?.filename ?? "—"} · ${v.limit_table_name.split("(")[0].trim()} (${v.counts.conforme}/${v.counts.non_conforme}/${v.counts.non_determinato})`,
    })),
    ...documents.map((d) => ({
      id: `doc_${d.id}`,
      time: d.uploaded_at,
      tone: "info",
      title: "Documento acquisito",
      detail: d.filename,
    })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 20);
  return NextResponse.json({ notifications: items });
}

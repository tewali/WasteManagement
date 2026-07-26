import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { effectiveStatus } from "@/lib/omologhe";
import { store } from "@/lib/store";

// Notification feed: derived from app activity (verifications + uploads),
// newest first. The client tracks "seen" state locally.
export async function GET() {
  if (!(await auth())?.user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const { verifications, documents, conversations } = store.get();
  // Link each notification to the chat its document belongs to.
  const chatFor = (documentId: string | null) => {
    if (!documentId) return null;
    const conv = conversations.find((c) => c.active_document_id === documentId);
    return conv ? `/?c=${conv.id}` : null;
  };
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
      href: chatFor(v.document_id),
    })),
    ...documents.map((d) => ({
      id: `doc_${d.id}`,
      time: d.uploaded_at,
      tone: "info",
      title: "Documento acquisito",
      detail: d.filename,
      href: chatFor(d.id),
    })),
    // Portal submissions awaiting review — Phase 3.
    ...store
      .submissions()
      .filter((s) => s.status === "inviato")
      .map((s) => ({
        id: `sub_${s.id}`,
        time: s.created_at,
        tone: "info",
        title: "Nuovo rapporto dal portale clienti",
        detail: `${s.producer_name} · ${documents.find((d) => d.id === s.document_id)?.filename ?? "—"}`,
        href: "/portale-clienti",
      })),
    // Weighbridge discrepancies on accepted movements — Phase 3.
    ...store
      .movements()
      .filter((m) => m.weigh_discrepancy)
      .map((m) => ({
        id: `movw_${m.id}`,
        time: m.created_at,
        tone: "ko",
        title: "Scostamento pesa oltre il 5%",
        detail: `${m.fir_number} · ${m.producer_name} · dichiarati ${m.quantity_declared_kg.toLocaleString("it-IT")} kg, pesati ${m.quantity_weighed_kg?.toLocaleString("it-IT")} kg`,
        href: "/movimenti",
      })),
    // Omologhe expiring within 30 days (or expired) — Phase 2.
    ...store
      .omologhe()
      .filter((o) => ["in_scadenza", "scaduta"].includes(effectiveStatus(o)))
      .map((o) => ({
        id: `omo_${o.id}_${o.valid_to}`,
        time: new Date().toISOString().slice(0, 11) + "00:00:00.000Z",
        tone: effectiveStatus(o) === "scaduta" ? "ko" : "info",
        title:
          effectiveStatus(o) === "scaduta"
            ? "Omologa SCADUTA — richiedere nuova caratterizzazione"
            : "Omologa in scadenza entro 30 giorni",
        detail: `${o.producer_name} · EER ${o.eer} · valida fino al ${new Date(o.valid_to + "T00:00:00").toLocaleDateString("it-IT")}`,
        href: "/omologhe",
      })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 20);
  return NextResponse.json({ notifications: items });
}

import { auth } from "@/auth";
import PortalClient from "@/components/portal/PortalClient";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PortalePage() {
  const session = await auth();
  const email = (session?.user?.email ?? "").toLowerCase();
  const submissions = store
    .submissions()
    .filter((s) => s.producer_email.toLowerCase() === email)
    .map((s) => ({
      ...s,
      filename: store.document(s.document_id)?.filename ?? "documento",
    }));
  return <PortalClient submissions={submissions} />;
}

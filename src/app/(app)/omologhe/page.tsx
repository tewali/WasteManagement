import PageShell from "@/components/PageShell";
import OmologheClient from "@/components/OmologheClient";
import { effectiveStatus } from "@/lib/omologhe";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function OmologhePage() {
  const omologhe = store.omologhe().map((o) => ({ ...o, effective_status: effectiveStatus(o) }));
  return (
    <PageShell title="Omologhe">
      <OmologheClient omologhe={omologhe} lines={store.lines()} />
    </PageShell>
  );
}

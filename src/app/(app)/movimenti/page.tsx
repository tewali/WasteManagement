import PageShell from "@/components/PageShell";
import MovimentiClient from "@/components/MovimentiClient";
import { registroEntries } from "@/lib/movements";
import { getSeed } from "@/lib/seed";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function MovimentiPage() {
  const movements = store.movements();
  return (
    <PageShell title="Movimenti e FIR" badge="RENTRI SIMULATO">
      <MovimentiClient
        movements={movements}
        registro={registroEntries(movements)}
        lines={store.lines().map((l) => ({ id: l.id, name: l.name, admissible_eer: l.admissible_eer }))}
        producers={getSeed().producers.map((p) => ({ id: p.id, name: p.name }))}
      />
    </PageShell>
  );
}

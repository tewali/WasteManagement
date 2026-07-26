"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconPlus, IconTrash } from "./icons";
import type { OmologaRecord, PlantLine } from "@/lib/types";
import type { OmologaStatus } from "@/lib/omologhe";

type Row = OmologaRecord & { effective_status: OmologaStatus };

const STATUS_STYLE: Record<OmologaStatus, { cls: string; label: string }> = {
  attiva: { cls: "bg-brand-pale text-brand-dark", label: "Attiva" },
  in_scadenza: { cls: "bg-amber-100 text-amber-700", label: "In scadenza" },
  scaduta: { cls: "bg-red-100 text-red-700", label: "Scaduta" },
  bozza: { cls: "bg-slate-200 text-slate-600", label: "Bozza" },
};

export default function OmologheClient({ omologhe, lines }: { omologhe: Row[]; lines: PlantLine[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    producer_name: "",
    eer: "",
    waste_description: "",
    line_id: lines[0]?.id ?? "",
    months: 12,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/omologhe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Creazione non riuscita.");
      return;
    }
    setCreating(false);
    setForm({ producer_name: "", eer: "", waste_description: "", line_id: lines[0]?.id ?? "", months: 12 });
    router.refresh();
  }

  async function action(id: string, body: Record<string, unknown>) {
    await fetch(`/api/omologhe/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    router.refresh();
  }

  async function remove(o: Row) {
    if (!window.confirm(`Eliminare l'omologa di "${o.producer_name}" (${o.eer})?`)) return;
    await fetch(`/api/omologhe/${o.id}`, { method: "DELETE" }).catch(() => {});
    router.refresh();
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-brand";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-slate-500">
          L&apos;omologa è la caratterizzazione periodica produttore/rifiuto: alla scadenza va rinnovata
          con una nuova analisi. Le scadenze entro 30 giorni compaiono nelle notifiche.
        </p>
        <button
          onClick={() => setCreating((c) => !c)}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-dark px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-brand"
        >
          <IconPlus size={14} /> Nuova omologa
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border-2 border-brand/40 bg-white p-5 shadow-panel">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Produttore</span>
              <input
                className={inputCls}
                value={form.producer_name}
                onChange={(e) => setForm({ ...form, producer_name: e.target.value })}
                placeholder="Azienda Esempio S.r.l."
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Codice EER</span>
              <input
                className={inputCls}
                value={form.eer}
                onChange={(e) => setForm({ ...form, eer: e.target.value })}
                placeholder="17 05 04"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Descrizione rifiuto</span>
              <input
                className={inputCls}
                value={form.waste_description}
                onChange={(e) => setForm({ ...form, waste_description: e.target.value })}
                placeholder="Terre e rocce da scavo…"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Linea</span>
              <select
                className={inputCls}
                value={form.line_id}
                onChange={(e) => setForm({ ...form, line_id: e.target.value })}
              >
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Validità (mesi)</span>
              <input
                type="number"
                min={1}
                max={36}
                className={inputCls}
                value={form.months}
                onChange={(e) => setForm({ ...form, months: Number(e.target.value) })}
              />
            </label>
          </div>
          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void create()}
              disabled={busy}
              className="rounded-lg bg-brand-dark px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand disabled:opacity-50"
            >
              {busy ? "Creo…" : "Crea omologa"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-slate-500 hover:bg-slate-100"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {omologhe.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[13.5px] text-slate-500">
          Nessuna omologa registrata.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Produttore</th>
                <th className="px-4 py-2.5">EER</th>
                <th className="px-4 py-2.5">Linea</th>
                <th className="px-4 py-2.5">Validità</th>
                <th className="px-4 py-2.5">Stato</th>
                <th className="px-4 py-2.5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {omologhe.map((o) => {
                const st = STATUS_STYLE[o.effective_status];
                const line = lines.find((l) => l.id === o.line_id);
                return (
                  <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-slate-800">{o.producer_name}</span>
                      {o.waste_description && (
                        <span className="block text-[11.5px] text-slate-400">{o.waste_description}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px]">{o.eer}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {line?.name.replace(/^Linea \d+ — /, "") ?? o.line_id}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(o.valid_from + "T00:00:00").toLocaleDateString("it-IT")} →{" "}
                      {new Date(o.valid_to + "T00:00:00").toLocaleDateString("it-IT")}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center justify-end gap-1.5">
                        {o.effective_status === "bozza" && (
                          <button
                            onClick={() => void action(o.id, { action: "attiva" })}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11.5px] font-semibold text-brand-dark hover:border-brand/50"
                          >
                            Attiva
                          </button>
                        )}
                        {(o.effective_status === "in_scadenza" || o.effective_status === "scaduta") && (
                          <button
                            onClick={() => void action(o.id, { action: "rinnova", months: 12 })}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11.5px] font-semibold text-brand-dark hover:border-brand/50"
                            title="Rinnova per 12 mesi"
                          >
                            Rinnova
                          </button>
                        )}
                        <button
                          onClick={() => void remove(o)}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-red-300 hover:text-red-600"
                          title="Elimina omologa"
                        >
                          <IconTrash size={13} />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

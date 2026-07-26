"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconPencil, IconPlus, IconTrash } from "./icons";
import type { PlantLine } from "@/lib/types";

interface TableOpt {
  id: string;
  name: string;
  blocking?: boolean;
}

const EMPTY: PlantLine = {
  id: "",
  name: "",
  operation: "R13",
  description: "",
  admissible_eer: [],
  annual_capacity_t: 0,
  limit_bindings: [],
};

/** Plant line configuration editor (Phase 2). */
export default function LineEditor({ lines, tables }: { lines: PlantLine[]; tables: TableOpt[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PlantLine | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/lines", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Salvataggio non riuscito.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(line: PlantLine) {
    if (!window.confirm(`Eliminare la linea "${line.name}"?`)) return;
    const res = await fetch(`/api/lines?id=${line.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      window.alert(data?.error ?? "Eliminazione non riuscita.");
      return;
    }
    router.refresh();
  }

  function field(label: string, input: React.ReactNode) {
    return (
      <label className="block">
        <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">{label}</span>
        {input}
      </label>
    );
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-brand";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-slate-500">
          Le linee configurate qui guidano l&apos;assistente: EER ammessi, tabelle limiti applicate e
          vincoli bloccanti.
        </p>
        <button
          onClick={() => {
            setEditing({ ...EMPTY });
            setIsNew(true);
            setError(null);
          }}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-dark px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-brand"
        >
          <IconPlus size={14} /> Aggiungi linea
        </button>
      </div>

      {editing && (
        <div className="rounded-xl border-2 border-brand/40 bg-white p-5 shadow-panel">
          <h3 className="text-[13px] font-bold text-slate-800">
            {isNew ? "Nuova linea" : `Modifica: ${editing.name}`}
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {field(
              "Nome linea",
              <input
                className={inputCls}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Linea 2 — Inertizzazione"
              />,
            )}
            {field(
              "Operazione (All. B/C D.Lgs. 152/2006)",
              <input
                className={inputCls}
                value={editing.operation}
                onChange={(e) => setEditing({ ...editing, operation: e.target.value })}
                placeholder="R5, D9, R13/D15…"
              />,
            )}
            {field(
              "Codici EER ammessi (separati da virgola)",
              <input
                className={inputCls}
                value={editing.admissible_eer.join(", ")}
                onChange={(e) =>
                  setEditing({ ...editing, admissible_eer: e.target.value.split(",").map((s) => s.trim()) })
                }
                placeholder="17 05 04, 17 09 03*, …"
              />,
            )}
            {field(
              "Capacità annua (t)",
              <input
                type="number"
                className={inputCls}
                value={editing.annual_capacity_t || ""}
                onChange={(e) => setEditing({ ...editing, annual_capacity_t: Number(e.target.value) })}
              />,
            )}
          </div>
          <div className="mt-4">
            {field(
              "Descrizione",
              <input
                className={inputCls}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />,
            )}
          </div>
          <div className="mt-4">
            <span className="mb-1.5 block text-[11.5px] font-semibold text-slate-600">
              Tabelle limiti applicate
            </span>
            <div className="space-y-1.5">
              {tables.map((t) => {
                const binding = editing.limit_bindings.find((b) => b.limit_table_id === t.id);
                return (
                  <label key={t.id} className="flex items-center gap-2.5 text-[12.5px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(binding)}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          limit_bindings: e.target.checked
                            ? [
                                ...editing.limit_bindings,
                                {
                                  limit_table_id: t.id,
                                  purpose: t.name.split("(")[0].trim(),
                                  ...(t.blocking ? { blocking: true } : {}),
                                },
                              ]
                            : editing.limit_bindings.filter((b) => b.limit_table_id !== t.id),
                        })
                      }
                      className="h-4 w-4 accent-brand-dark"
                    />
                    {t.name.split("(")[0].trim()}
                    {t.blocking && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                        BLOCCANTE
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-brand-dark px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand disabled:opacity-50"
            >
              {busy ? "Salvo…" : "Salva linea"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-slate-500 hover:bg-slate-100"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {lines.map((l) => (
          <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[13.5px] font-bold text-slate-800">{l.name}</h3>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-brand-pale px-2 py-0.5 text-[11px] font-bold text-brand-dark">
                  {l.operation}
                </span>
                <button
                  onClick={() => {
                    setEditing(structuredClone(l));
                    setIsNew(false);
                    setError(null);
                  }}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-brand/50 hover:text-brand-dark"
                  title="Modifica linea"
                >
                  <IconPencil size={13} />
                </button>
                <button
                  onClick={() => void remove(l)}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-red-300 hover:text-red-600"
                  title="Elimina linea"
                >
                  <IconTrash size={13} />
                </button>
              </div>
            </div>
            {l.description && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">{l.description}</p>
            )}
            <div className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">EER ammessi</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {l.admissible_eer.map((c) => (
                  <span key={c} className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tabelle limiti</div>
              <ul className="mt-1.5 space-y-1 text-[12px] text-slate-600">
                {l.limit_bindings.map((b) => (
                  <li key={b.limit_table_id} className="flex items-start gap-1.5">
                    <span className={b.blocking ? "text-red-500" : "text-brand-dark"}>
                      {b.blocking ? "⛔" : "✓"}
                    </span>
                    {b.purpose}
                  </li>
                ))}
              </ul>
            </div>
            {l.annual_capacity_t > 0 && (
              <div className="mt-3 text-[12px] text-slate-400">
                Capacità: {l.annual_capacity_t.toLocaleString("it-IT")} t/anno
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

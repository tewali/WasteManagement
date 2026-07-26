"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconDownload, IconPlus, IconTrash, IconUploadFlask } from "./icons";
import type { RegistroEntry } from "@/lib/movements";
import type { MovementRecord } from "@/lib/types";

const STATUS_STYLE: Record<MovementRecord["status"], { cls: string; label: string }> = {
  in_arrivo: { cls: "bg-sky-100 text-sky-700", label: "In arrivo" },
  accettato: { cls: "bg-brand-pale text-brand-dark", label: "Accettato" },
  respinto: { cls: "bg-red-100 text-red-700", label: "Respinto" },
};

const fmtKg = (n: number) => n.toLocaleString("it-IT");
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("it-IT");

interface LineOpt {
  id: string;
  name: string;
  admissible_eer: string[];
}

export default function MovimentiClient({
  movements,
  registro,
  lines,
  producers,
}: {
  movements: MovementRecord[];
  registro: RegistroEntry[];
  lines: LineOpt[];
  producers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"movimenti" | "registro">("movimenti");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const empty = {
    date: new Date().toISOString().slice(0, 10),
    producer_name: "",
    transporter: { name: "", albo_number: "", plate: "" },
    eer: "",
    description: "",
    line_id: lines[0]?.id ?? "",
    quantity_declared_kg: "",
  };
  const [form, setForm] = useState(empty);

  async function api(path: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
    const res = await fetch(path, init).catch(() => null);
    const data = (await res?.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res?.ok) {
      setError((data?.error as string) ?? "Operazione non riuscita.");
      return null;
    }
    setError(null);
    return data;
  }

  async function create() {
    setBusy(true);
    setNotice(null);
    const data = await api("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        producer_id: producers.find((p) => p.name === form.producer_name)?.id ?? null,
        quantity_declared_kg: Number(String(form.quantity_declared_kg).replace(",", ".")),
      }),
    });
    setBusy(false);
    if (!data) return;
    if (data.eer_admissible === false) {
      setNotice(
        "Movimento registrato. Attenzione: il codice EER non è tra quelli ammessi sulla linea selezionata — verificare prima dell'accettazione.",
      );
    }
    setCreating(false);
    setForm(empty);
    router.refresh();
  }

  async function action(id: string, body: Record<string, unknown>) {
    if (await api(`/api/movements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }))
      router.refresh();
  }

  async function weigh(m: MovementRecord) {
    const gross = window.prompt(`Peso LORDO in kg per ${m.fir_number}:`);
    if (gross === null) return;
    const tare = window.prompt("TARA automezzo in kg:");
    if (tare === null) return;
    await action(m.id, {
      action: "pesa",
      gross_kg: Number(gross.replace(",", ".")),
      tare_kg: Number(tare.replace(",", ".")),
    });
  }

  async function reject(m: MovementRecord) {
    const reason = window.prompt(`Motivo del respingimento di ${m.fir_number}:`);
    if (!reason) return;
    await action(m.id, { action: "respingi", reason });
  }

  async function transmit(m: MovementRecord) {
    if (await api(`/api/movements/${m.id}/rentri`, { method: "POST" })) {
      setNotice(`${m.fir_number} trasmesso a RENTRI (simulazione).`);
      router.refresh();
    }
  }

  async function remove(m: MovementRecord) {
    if (!window.confirm(`Eliminare il movimento ${m.fir_number}?`)) return;
    if (await api(`/api/movements/${m.id}`, { method: "DELETE" })) router.refresh();
  }

  async function importCsv(file: File) {
    setBusy(true);
    setNotice(null);
    const fd = new FormData();
    fd.append("file", file);
    const data = await api("/api/movements/import", { method: "POST", body: fd });
    setBusy(false);
    if (!data) return;
    const updated = (data.updated as unknown[])?.length ?? 0;
    const unmatched = (data.unmatched as string[]) ?? [];
    const errors = (data.errors as string[]) ?? [];
    setNotice(
      `Pesa importata: ${updated} movimenti aggiornati.` +
        (unmatched.length ? ` FIR non trovati: ${unmatched.join(", ")}.` : "") +
        (errors.length ? ` Righe scartate: ${errors.join("; ")}.` : ""),
    );
    router.refresh();
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-brand";
  const line = lines.find((l) => l.id === form.line_id);
  const years = [...new Set(registro.map((e) => e.year))].sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[520px] text-[12.5px] text-slate-500">
          Conferimenti in ingresso con FIR e registro cronologico di carico. La trasmissione a
          RENTRI è <span className="font-semibold">simulata</span>: il payload FIR digitale (DM
          59/2023) viene generato e archiviato ma nulla lascia l&apos;applicazione.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/movements/import"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 hover:border-brand/50"
            title="Scarica il template CSV della pesa"
          >
            <IconDownload size={13} /> Template pesa
          </a>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 hover:border-brand/50 disabled:opacity-50"
          >
            <IconUploadFlask size={13} /> Importa pesa CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => setCreating((c) => !c)}
            className="flex items-center gap-2 rounded-lg bg-brand-dark px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-brand"
          >
            <IconPlus size={14} /> Nuovo movimento
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
      )}
      {notice && (
        <p className="rounded-md bg-brand-mist px-3 py-2 text-[12px] font-medium text-brand-dark">{notice}</p>
      )}

      {creating && (
        <div className="rounded-xl border-2 border-brand/40 bg-white p-5 shadow-panel">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Data arrivo</span>
              <input
                type="date"
                className={inputCls}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Produttore</span>
              <input
                className={inputCls}
                list="producer-options"
                value={form.producer_name}
                onChange={(e) => setForm({ ...form, producer_name: e.target.value })}
                placeholder="Azienda Esempio S.r.l."
              />
              <datalist id="producer-options">
                {producers.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Trasportatore</span>
              <input
                className={inputCls}
                value={form.transporter.name}
                onChange={(e) => setForm({ ...form, transporter: { ...form.transporter, name: e.target.value } })}
                placeholder="EcoTrasporti S.r.l."
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Iscrizione Albo</span>
              <input
                className={inputCls}
                value={form.transporter.albo_number}
                onChange={(e) =>
                  setForm({ ...form, transporter: { ...form.transporter, albo_number: e.target.value } })
                }
                placeholder="MI04512"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Targa</span>
              <input
                className={inputCls}
                value={form.transporter.plate}
                onChange={(e) => setForm({ ...form, transporter: { ...form.transporter, plate: e.target.value } })}
                placeholder="FX 482 KL"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Codice EER</span>
              <input
                className={inputCls}
                list="eer-options"
                value={form.eer}
                onChange={(e) => setForm({ ...form, eer: e.target.value })}
                placeholder="17 05 04"
              />
              <datalist id="eer-options">
                {(line?.admissible_eer ?? []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Quantità dichiarata (kg)</span>
              <input
                className={inputCls}
                inputMode="numeric"
                value={form.quantity_declared_kg}
                onChange={(e) => setForm({ ...form, quantity_declared_kg: e.target.value })}
                placeholder="28400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Linea di destinazione</span>
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
            <label className="block md:col-span-3">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Descrizione rifiuto</span>
              <input
                className={inputCls}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Terre e rocce da scavo — cantiere…"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void create()}
              disabled={busy}
              className="rounded-lg bg-brand-dark px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand disabled:opacity-50"
            >
              {busy ? "Registro…" : "Registra movimento"}
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

      <div className="flex items-center gap-2">
        {(["movimenti", "registro"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold ${
              tab === t ? "bg-brand-dark text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            {t === "movimenti" ? `Movimenti (${movements.length})` : `Registro cronologico (${registro.length})`}
          </button>
        ))}
        {tab === "registro" && (
          <span className="ml-auto flex gap-2">
            {years.map((y) => (
              <a
                key={y}
                href={`/api/movements/registro?year=${y}`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:border-brand/50"
              >
                <IconDownload size={13} /> CSV {y}
              </a>
            ))}
          </span>
        )}
      </div>

      {tab === "movimenti" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[880px] text-[12.5px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">FIR / Data</th>
                <th className="px-3 py-2.5">Produttore</th>
                <th className="px-3 py-2.5">EER</th>
                <th className="px-3 py-2.5">Trasporto</th>
                <th className="px-3 py-2.5 text-right">Dichiarato</th>
                <th className="px-3 py-2.5 text-right">Pesato</th>
                <th className="px-3 py-2.5">Stato</th>
                <th className="px-3 py-2.5">RENTRI</th>
                <th className="px-3 py-2.5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const st = STATUS_STYLE[m.status];
                return (
                  <tr key={m.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[11.5px] font-semibold text-slate-800">{m.fir_number}</span>
                      <span className="block text-[11.5px] text-slate-400">{fmtDate(m.date)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-slate-800">{m.producer_name}</span>
                      {m.description && (
                        <span className="block max-w-[220px] truncate text-[11.5px] text-slate-400" title={m.description}>
                          {m.description}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px]">{m.eer}</td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {m.transporter.name}
                      <span className="block text-[11px] text-slate-400">
                        {m.transporter.plate}
                        {m.transporter.albo_number ? ` · Albo ${m.transporter.albo_number}` : ""}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {fmtKg(m.quantity_declared_kg)} kg
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {m.quantity_weighed_kg === null ? (
                        <button
                          onClick={() => void weigh(m)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11.5px] font-semibold text-brand-dark hover:border-brand/50"
                        >
                          Pesa
                        </button>
                      ) : (
                        <>
                          {fmtKg(m.quantity_weighed_kg)} kg
                          {m.weigh_discrepancy && (
                            <span
                              className="block text-[10.5px] font-bold text-amber-600"
                              title="Scostamento oltre il 5% rispetto al dichiarato"
                            >
                              ⚠ scostamento &gt;5%
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                      {m.status === "respinto" && m.rejection_reason && (
                        <span className="mt-0.5 block max-w-[160px] text-[10.5px] text-red-500" title={m.rejection_reason}>
                          {m.rejection_reason.slice(0, 60)}
                          {m.rejection_reason.length > 60 ? "…" : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {m.rentri ? (
                        <a
                          href={`/api/movements/${m.id}/rentri`}
                          target="_blank"
                          className="font-mono text-[10.5px] font-semibold text-brand-dark underline decoration-dotted"
                          title="Apri il payload FIR digitale trasmesso (simulazione)"
                        >
                          {m.rentri.transaction_id}
                        </a>
                      ) : m.status === "in_arrivo" ? (
                        <span className="text-[11px] text-slate-400">—</span>
                      ) : (
                        <button
                          onClick={() => void transmit(m)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11.5px] font-semibold text-brand-dark hover:border-brand/50"
                          title="Trasmetti il FIR a RENTRI (simulazione)"
                        >
                          Trasmetti
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center justify-end gap-1.5">
                        {m.status === "in_arrivo" && (
                          <>
                            <button
                              onClick={() => void action(m.id, { action: "accetta" })}
                              className="rounded-md border border-slate-200 px-2 py-1 text-[11.5px] font-semibold text-brand-dark hover:border-brand/50"
                            >
                              Accetta
                            </button>
                            <button
                              onClick={() => void reject(m)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-[11.5px] font-semibold text-red-600 hover:border-red-300"
                            >
                              Respingi
                            </button>
                            {!m.rentri && (
                              <button
                                onClick={() => void remove(m)}
                                className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-red-300 hover:text-red-600"
                                title="Elimina movimento"
                              >
                                <IconTrash size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Prog.</th>
                <th className="px-3 py-2.5">Data</th>
                <th className="px-3 py-2.5">FIR</th>
                <th className="px-3 py-2.5">EER</th>
                <th className="px-3 py-2.5">Produttore</th>
                <th className="px-3 py-2.5 text-right">Quantità</th>
                <th className="px-3 py-2.5">RENTRI</th>
              </tr>
            </thead>
            <tbody>
              {registro
                .slice()
                .reverse()
                .map((e) => (
                  <tr key={`${e.year}-${e.progressivo}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-[11.5px] font-semibold">
                      {e.progressivo}/{e.year}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{fmtDate(e.date)}</td>
                    <td className="px-3 py-2 font-mono text-[11.5px]">{e.fir_number}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11.5px]">{e.eer}</td>
                    <td className="px-3 py-2">{e.producer_name}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtKg(e.quantity_kg)} kg</td>
                    <td className="px-3 py-2 font-mono text-[10.5px] text-slate-500">
                      {e.rentri_transaction_id ?? "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
            Registro cronologico derivato dai movimenti accettati (operazioni di carico) — numerazione
            progressiva per anno solare.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

interface Section {
  title: string;
  items: string[];
}
interface LimitRow {
  label: string;
  limit: string;
  unit: string;
  notes: string | null;
  kind: string | null;
}
interface TableInfo {
  id: string;
  name: string;
  normativa: string;
  version: number;
  validated: boolean;
  basis: "total" | "eluate";
  unit: string;
  valid_from: string;
  valid_to: string | null;
  blocking: boolean;
  blocking_consequence: string | null;
  source_ref: string | null;
  entries: LimitRow[];
}

const itDate = (iso: string) => iso.split("-").reverse().join("/");

/** One limit table: header row always visible, full contents on demand. */
function LimitTableRow({ table: t, defaultOpen }: { table: TableInfo; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const panelId = `tabella-${t.id}`;
  return (
    <li className="rounded-lg border border-slate-200">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-brand-mist"
      >
        <span
          aria-hidden
          className={`shrink-0 text-[11px] text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span
          className={`rounded px-2 py-0.5 text-[10.5px] font-bold ${
            t.validated ? "bg-brand-pale text-brand-dark" : "bg-amber-100 text-amber-700"
          }`}
        >
          {t.validated ? "VALIDATA" : "DA VALIDARE"}
        </span>
        <span className="font-semibold text-slate-800">{t.name.split("(")[0].trim()}</span>
        <span className="text-slate-400">
          v{t.version} · {t.normativa.split("(")[0].trim()}
        </span>
        <span className="ml-auto whitespace-nowrap text-[11.5px] text-slate-400">
          {t.entries.length} parametri
        </span>
      </button>

      {open && (
        <div id={panelId} className="border-t border-slate-100 px-3 py-3">
          <dl className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-slate-500">Riferimento:</dt>
              <dd className="text-slate-700">{t.normativa}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-slate-500">Base di misura:</dt>
              <dd className="text-slate-700">
                {t.basis === "eluate" ? "eluato (test di cessione)" : "tal quale (sul secco)"} · {t.unit}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-slate-500">Validità:</dt>
              <dd className="text-slate-700">
                dal {itDate(t.valid_from)}
                {t.valid_to ? ` al ${itDate(t.valid_to)}` : " — in vigore"}
              </dd>
            </div>
            {t.source_ref && (
              <div className="flex gap-2">
                <dt className="shrink-0 font-semibold text-slate-500">Fonte:</dt>
                <dd className="text-slate-700">{t.source_ref}</dd>
              </div>
            )}
          </dl>

          {t.blocking && t.blocking_consequence && (
            <p className="mb-3 rounded-md bg-red-50 px-2.5 py-1.5 text-[11.5px] text-red-700">
              <span className="font-semibold">Tabella bloccante.</span> {t.blocking_consequence}
            </p>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Parametro</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right">Limite</th>
                  <th className="whitespace-nowrap px-2 py-2">U.M.</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {t.entries.map((e, i) => (
                  <tr key={i} className="border-t border-slate-100 text-slate-700">
                    <td className="px-3 py-1.5 font-medium">
                      {e.label}
                      {e.kind === "sum" && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">
                          somma
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{e.limit}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{e.unit}</td>
                    <td className="px-3 py-1.5 text-[11.5px] text-slate-500">{e.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!t.validated && (
            <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
              ⚠ Valori simulati per lo sviluppo — da validare sulla fonte ufficiale prima dell&apos;uso operativo.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Searchable normative library (keyword filter; RAG lands with Postgres/pgvector). */
export default function NormativaBrowser({
  sections,
  tables,
}: {
  sections: Section[];
  tables: TableInfo[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        title: s.title,
        items: s.items.filter(
          (it) => it.toLowerCase().includes(q) || s.title.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [query, sections]);

  const q = query.trim().toLowerCase();
  // Search reaches the parameters too, so "mercurio" finds the tables that
  // regulate it — not just the tables whose title happens to contain the word.
  const filteredTables = q
    ? tables.filter((t) =>
        `${t.name} ${t.normativa} ${t.entries.map((e) => e.label).join(" ")}`
          .toLowerCase()
          .includes(q),
      )
    : tables;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca nella normativa (es. POP, discarica, EER, 1357/2014)…"
        className="mb-5 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13.5px] shadow-card outline-none focus:border-brand"
      />

      {filteredTables.length > 0 && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-700">
            Tabelle limiti attive nell&apos;impianto
          </h2>
          <ul className="mt-3 space-y-1">
            {filteredTables.map((t) => (
              <LimitTableRow key={t.id} table={t} defaultOpen={filteredTables.length === 1 && Boolean(q)} />
            ))}
          </ul>
        </div>
      )}

      {filtered.length === 0 && filteredTables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[13.5px] text-slate-500">
          Nessun riferimento normativo corrisponde alla ricerca.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((s) => (
            <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <h3 className="text-[13px] font-bold text-slate-800">{s.title}</h3>
              <ul className="mt-2 space-y-1.5">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-slate-600">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-dark" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

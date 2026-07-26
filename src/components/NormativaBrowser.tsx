"use client";

import { useMemo, useState } from "react";

interface Section {
  title: string;
  items: string[];
}
interface TableInfo {
  id: string;
  name: string;
  normativa: string;
  version: number;
  validated: boolean;
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
  const filteredTables = q
    ? tables.filter((t) => `${t.name} ${t.normativa}`.toLowerCase().includes(q))
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
          <ul className="mt-3 space-y-2">
            {filteredTables.map((t) => (
              <li key={t.id} className="flex items-center gap-3 text-[13px]">
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
              </li>
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EsitoBlock } from "@/components/chat/EsitoCard";
import { IconDownload, IconPdf } from "@/components/icons";
import type { VerificationRecord } from "@/lib/types";

interface Item {
  verification: VerificationRecord;
  document: string | null;
  eer: string | null;
}

const PAGE_SIZE = 10;

/** Searchable, lazily-loaded verification browser for "Analisi e confronti". */
export default function AnalysisList() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const sentinel = useRef<HTMLDivElement>(null);
  const fetchSeq = useRef(0);

  const fetchPage = useCallback(async (q: string, offset: number, replace: boolean) => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analyses?q=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE_SIZE}`,
      );
      const data = (await res.json()) as { verifications: Item[]; total: number; has_more: boolean };
      if (seq !== fetchSeq.current) return; // stale response
      setItems((prev) => (replace ? data.verifications : [...prev, ...data.verifications]));
      setTotal(data.total);
      setHasMore(data.has_more);
    } catch {
      /* keep current list */
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, []);

  // Debounced search (and initial load).
  useEffect(() => {
    const t = setTimeout(() => void fetchPage(query, 0, true), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, fetchPage]);

  // Lazy loading: fetch the next page when the sentinel becomes visible.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void fetchPage(query, items.length, false);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, items.length, query, fetchPage]);

  return (
    <div>
      {/* search */}
      <div className="mb-4 flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per documento, CER, tabella, normativa o parametro…"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13.5px] shadow-card outline-none focus:border-brand"
        />
        {query && (
          <span className="shrink-0 text-[12px] text-slate-400">
            {total} risultat{total === 1 ? "o" : "i"}
          </span>
        )}
      </div>

      {items.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[13.5px] text-slate-500">
          {query
            ? "Nessuna verifica corrisponde alla ricerca."
            : "Nessuna verifica eseguita. Avvii un confronto dalla Chat con Anna."}
        </div>
      ) : (
        <div className="space-y-5">
          {items.map(({ verification: v, document, eer }) => {
            const nc = v.verdicts.filter((x) => x.esito === "non_conforme");
            return (
              <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
                {/* header: documento + inquadramento */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <IconPdf size={22} />
                  <span className="text-[14px] font-bold text-slate-800">{document ?? "—"}</span>
                  {eer && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                      CER {eer}
                    </span>
                  )}
                  <span
                    className={`ml-auto rounded px-2 py-0.5 text-[11px] font-semibold ${
                      v.overall === "conforme" ? "bg-brand-pale text-brand-dark" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {v.overall === "conforme" ? "Conforme" : "Non conforme"}
                  </span>
                  {v.blocking && (
                    <span className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      Vincolo POP
                    </span>
                  )}
                  <a
                    href={`/api/verifications/${v.id}/pdf`}
                    className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 hover:border-brand/50 hover:text-brand-dark"
                    title="Scarica l'esito come PDF"
                  >
                    <IconDownload size={13} />
                    Esporta PDF
                  </a>
                </div>
                <div className="mt-1.5 text-[12px] text-slate-500">
                  {v.limit_table_name.split("(")[0].trim()} · {v.normativa.split("(")[0].trim()} ·{" "}
                  {new Date(v.created_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                  {v.requested_by}
                </div>

                {/* esito conformità — same component as the chat card */}
                <div className="mt-4">
                  <EsitoBlock verification={v} />
                </div>

                {/* conclusione */}
                <div
                  className={`mt-4 rounded-lg border px-4 py-3 ${
                    v.overall === "conforme"
                      ? "border-brand/40 bg-brand-mist"
                      : "border-brand/40 bg-brand-mist"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-[13px] font-bold text-slate-800">
                    <span aria-hidden>{v.overall === "conforme" ? "✅" : "⚠️"}</span> Conclusione
                  </div>
                  {v.overall === "conforme" ? (
                    <p className="text-[13px] text-slate-700">
                      Il rifiuto è conforme ai limiti della{" "}
                      <span className="font-bold">{v.limit_table_name.split("(")[0].trim()}</span>
                      {v.counts.non_determinato > 0 &&
                        ` — attenzione: ${v.counts.non_determinato} parametri non determinati.`}
                    </p>
                  ) : (
                    <div className="text-[13px] text-slate-700">
                      <p>
                        Il rifiuto NON è conforme ai limiti della{" "}
                        <span className="font-bold">{v.limit_table_name.split("(")[0].trim()}</span> per i seguenti
                        parametri:
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {nc.map((x) => (
                          <li key={x.analyte_key} className="flex gap-2">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                            <span>
                              {x.label.replace(/\s*\(.*\)$/, "")} ({x.result_raw} &gt; {x.limit_display} {x.unit})
                            </span>
                          </li>
                        ))}
                      </ul>
                      {v.blocking && v.blocking_consequence && <p className="mt-2">{v.blocking_consequence}</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* lazy-load sentinel + status */}
      <div ref={sentinel} className="h-8" />
      {loading && <p className="pb-4 text-center text-[12px] text-slate-400">Carico le verifiche…</p>}
      {!hasMore && !loading && items.length > 0 && (
        <p className="pb-4 text-center text-[11.5px] text-slate-300">
          {total} verific{total === 1 ? "a" : "he"} in totale
        </p>
      )}
    </div>
  );
}

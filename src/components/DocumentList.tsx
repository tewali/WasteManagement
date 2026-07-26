"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconChat, IconDownload, IconPdf } from "@/components/icons";

interface Item {
  id: string;
  filename: string;
  pdf_url: string | null;
  uploaded_at: string;
  eer: string | null;
  laboratory: string | null;
  extraction_source: "claude" | "fixture" | null;
  conversation: { id: string; title: string } | null;
}

const PAGE_SIZE = 15;

/** Searchable, lazily-loaded document browser for "I miei documenti". */
export default function DocumentList() {
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
        `/api/documents?q=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE_SIZE}`,
      );
      const data = (await res.json()) as { documents: Item[]; total: number; has_more: boolean };
      if (seq !== fetchSeq.current) return; // stale response
      setItems((prev) => (replace ? data.documents : [...prev, ...data.documents]));
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
          placeholder="Cerca per nome file, CER o laboratorio…"
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
            ? "Nessun documento corrisponde alla ricerca."
            : "Nessun documento caricato. Carichi un rapporto di prova dalla Chat con Anna."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Documento</th>
                <th className="px-4 py-2.5">CER</th>
                <th className="px-4 py-2.5">Laboratorio</th>
                <th className="px-4 py-2.5">Caricato il</th>
                <th className="px-4 py-2.5">Estrazione</th>
                <th className="px-4 py-2.5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">
                    {d.pdf_url ? (
                      <a
                        href={d.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 hover:text-brand-dark hover:underline"
                        title="Apri il PDF"
                      >
                        <IconPdf size={22} />
                        {d.filename}
                      </a>
                    ) : (
                      <span className="flex items-center gap-2.5">
                        <IconPdf size={22} />
                        {d.filename}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{d.eer ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{d.laboratory ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(d.uploaded_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                        d.extraction_source === "claude"
                          ? "bg-brand-pale text-brand-dark"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {d.extraction_source === "claude" ? "AI" : "Demo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center justify-end gap-1.5">
                      {d.pdf_url && (
                        <a
                          href={d.pdf_url}
                          download={d.filename}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-brand/50 hover:text-brand-dark"
                          title="Scarica il PDF"
                        >
                          <IconDownload size={14} />
                        </a>
                      )}
                      {d.conversation && (
                        <Link
                          href={`/?c=${d.conversation.id}`}
                          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-[11.5px] font-semibold text-slate-600 hover:border-brand/50 hover:text-brand-dark"
                          title={`Apri la chat: ${d.conversation.title}`}
                        >
                          <IconChat size={13} />
                          Vai alla chat
                        </Link>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* lazy-load sentinel + status */}
      <div ref={sentinel} className="h-8" />
      {loading && <p className="pb-4 text-center text-[12px] text-slate-400">Carico i documenti…</p>}
      {!hasMore && !loading && items.length > 0 && (
        <p className="pb-4 text-center text-[11.5px] text-slate-300">
          {total} document{total === 1 ? "o" : "i"} in totale
        </p>
      )}
    </div>
  );
}

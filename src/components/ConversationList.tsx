"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconChat, IconPdf, IconPencil, IconTrash } from "./icons";

interface Item {
  id: string;
  title: string;
  created_at: string;
  messages: number;
  document: string | null;
}

const PAGE_SIZE = 15;

/** Searchable, lazily-loaded conversation browser for "Le mie chat". */
export default function ConversationList() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const fetchSeq = useRef(0);

  const fetchPage = useCallback(async (q: string, offset: number, replace: boolean) => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/conversations?q=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE_SIZE}`,
      );
      const data = (await res.json()) as { conversations: Item[]; total: number; has_more: boolean };
      if (seq !== fetchSeq.current) return; // stale response
      setItems((prev) => (replace ? data.conversations : [...prev, ...data.conversations]));
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

  async function rename(id: string) {
    const title = draft.trim();
    setEditing(null);
    if (!title) return;
    setBusy(id);
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => {});
    setBusy(null);
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Eliminare la chat "${title}"? L'operazione non è reversibile.`)) return;
    setBusy(id);
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setItems((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    }
  }

  return (
    <div>
      {/* search */}
      <div className="mb-4 flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per titolo, documento o contenuto…"
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
            ? "Nessuna conversazione corrisponde alla ricerca."
            : "Nessuna conversazione salvata. Le chat con Anna vengono archiviate qui automaticamente."}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li
              key={c.id}
              className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-brand/50 ${
                busy === c.id ? "opacity-50" : ""
              }`}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-pale">
                <IconChat size={16} className="text-brand-dark" />
              </span>
              <div className="min-w-0 flex-1">
                {editing === c.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void rename(c.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                      maxLength={90}
                      className="h-8 w-full rounded-md border border-brand px-2.5 text-[13px] font-semibold outline-none"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-md bg-brand-dark px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-brand"
                    >
                      Salva
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="shrink-0 rounded-md px-2 py-1.5 text-[11.5px] font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      Annulla
                    </button>
                  </form>
                ) : (
                  <Link href={`/?c=${c.id}`} className="block hover:text-brand-dark">
                    <span className="block truncate text-[13.5px] font-bold text-slate-800">
                      {c.title}
                    </span>
                  </Link>
                )}
                <span className="mt-0.5 block text-[12px] text-slate-400">
                  {new Date(c.created_at).toLocaleString("it-IT", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · {c.messages} messaggi
                </span>
                {c.document && (
                  <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1">
                    <IconPdf size={16} />
                    <span className="truncate text-[11.5px] font-medium text-slate-600">
                      {c.document}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => {
                    setEditing(c.id);
                    setDraft(c.title);
                  }}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-brand/50 hover:text-brand-dark"
                  title="Rinomina chat"
                >
                  <IconPencil size={14} />
                </button>
                <button
                  onClick={() => void remove(c.id, c.title)}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-red-300 hover:text-red-600"
                  title="Elimina chat"
                >
                  <IconTrash size={14} />
                </button>
                <Link
                  href={`/?c=${c.id}`}
                  className="ml-1 rounded-md px-2 py-1.5 text-[12px] font-semibold text-brand-dark hover:underline"
                >
                  Apri →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* lazy-load sentinel + status */}
      <div ref={sentinel} className="h-8" />
      {loading && (
        <p className="pb-4 text-center text-[12px] text-slate-400">Carico le conversazioni…</p>
      )}
      {!hasMore && !loading && items.length > 0 && (
        <p className="pb-4 text-center text-[11.5px] text-slate-300">
          {total} conversazion{total === 1 ? "e" : "i"} in totale
        </p>
      )}
    </div>
  );
}

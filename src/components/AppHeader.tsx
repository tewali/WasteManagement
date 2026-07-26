"use client";

import { useEffect, useRef, useState } from "react";
import { IconBell, IconChat, IconHistory, IconNewChat } from "./icons";

interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  messages: number;
}

export default function AppHeader({
  title,
  badge,
  onNewChat,
  onOpenConversation,
  activeConversationId,
}: {
  title: string;
  badge?: string;
  onNewChat?: () => void;
  onOpenConversation?: (id: string) => void;
  activeConversationId?: string | null;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!historyOpen) return;
    void fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setHistory(d.conversations ?? []))
      .catch(() => setHistory([]));
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setHistoryOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [historyOpen]);

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6">
      <h1 className="text-[17px] font-bold text-slate-900">{title}</h1>
      {badge && (
        <span className="rounded-md bg-brand-pale px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
          {badge}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        {onNewChat && (
          <button
            onClick={onNewChat}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <IconNewChat size={15} />
            Nuova chat
          </button>
        )}
        <div className="relative" ref={wrapRef}>
          <button
            onClick={() => onOpenConversation && setHistoryOpen((o) => !o)}
            className={`rounded-full border p-2 ${
              historyOpen
                ? "border-brand bg-brand-mist text-brand-dark"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            } ${onOpenConversation ? "" : "cursor-default opacity-50"}`}
            title="Storico conversazioni"
          >
            <IconHistory size={16} />
          </button>
          {historyOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel">
              <div className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Storico conversazioni
              </div>
              {history === null ? (
                <div className="px-4 py-6 text-center text-[12.5px] text-slate-400">Carico…</div>
              ) : history.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12.5px] text-slate-400">
                  Nessuna conversazione salvata.
                </div>
              ) : (
                <ul className="max-h-[320px] overflow-y-auto py-1">
                  {history.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => {
                          setHistoryOpen(false);
                          onOpenConversation?.(c.id);
                        }}
                        className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-brand-mist ${
                          c.id === activeConversationId ? "bg-brand-mist/60" : ""
                        }`}
                      >
                        <IconChat size={14} className="mt-0.5 shrink-0 text-brand-dark" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-slate-800">
                            {c.title}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            {new Date(c.created_at).toLocaleString("it-IT", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}{" "}
                            · {c.messages} messaggi
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button
          className="relative rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          title="Notifiche"
        >
          <IconBell size={16} />
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[8px] font-bold text-white">
            1
          </span>
        </button>
      </div>
    </header>
  );
}

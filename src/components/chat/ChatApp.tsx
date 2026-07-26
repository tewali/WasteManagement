"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnalysisRecord,
  ChatMessage,
  DocumentRecord,
  MessageBlock,
  VerificationResult,
} from "@/lib/types";
import AppHeader from "../AppHeader";
import DocPanel from "../panel/DocPanel";
import MessageBlocks from "./EsitoCard";
import {
  IconCheckSquare,
  IconDoc,
  IconPdf,
  IconRefresh,
  IconSend,
  IconUploadFlask,
} from "../icons";

interface TableOpt {
  id: string;
  name: string;
  normativa: string;
}
interface LineOpt {
  id: string;
  name: string;
}

const SUGGESTIONS = [
  "Verifica la conformità con la Tabella 5 colonna A",
  "Verifica contro Tabella 5 colonna B (uso commerciale/industriale)",
  "Il rifiuto è ammissibile in discarica per inerti?",
  "Verifica i limiti per discarica non pericolosi",
  "Verifica il vincolo POP / PFAS (Reg. 2019/1021)",
  "Può essere accettato sulla linea Soil Washing?",
  "Quali parametri sono non determinati e perché?",
  "Quali codici EER sono ammessi sulla linea di inertizzazione?",
];

const DEMO_PROMPT =
  "Buongiorno Anna, puoi analizzare questa analisi (allegato) e verificare se il rifiuto 170903* può essere accettato sulla linea Soil Washing secondo i limiti Tabella 5 del D.Lgs. 121/2020?";

const now = () =>
  new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
let seq = 0;
const mid = () => `m${Date.now()}_${seq++}`;

export default function ChatApp({
  tables,
  lines,
}: {
  tables: TableOpt[];
  lines: LineOpt[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [attachments, setAttachments] = useState<DocumentRecord[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [tableId, setTableId] = useState("tab5-121-2020-colA");
  const [lineId, setLineId] = useState("L1-soil-washing");
  const [panelOpen, setPanelOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(0);

  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const filteredSuggestions = input.trim()
    ? SUGGESTIONS.filter((s) => s.toLowerCase().includes(input.trim().toLowerCase()))
    : SUGGESTIONS.slice(0, 5);

  const pushMessage = (m: ChatMessage) => setMessages((prev) => [...prev, m]);

  const askAnna = useCallback(
    async (text: string, activeDoc: DocumentRecord | null, opts?: { silentUser?: boolean }) => {
      if (!opts?.silentUser) {
        pushMessage({ id: mid(), role: "user", time: now(), text });
      }
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            document_id: activeDoc?.id ?? null,
            table_id: tableId,
            line_id: lineId,
          }),
        });
        const data = (await res.json()) as {
          blocks: MessageBlock[];
          verification: VerificationResult | null;
          table_id: string | null;
          line_id: string | null;
        };
        if (data.table_id) setTableId(data.table_id);
        if (data.line_id) setLineId(data.line_id);
        if (data.verification) setVerification(data.verification);
        pushMessage({ id: mid(), role: "assistant", time: now(), blocks: data.blocks });
      } catch {
        pushMessage({
          id: mid(),
          role: "assistant",
          time: now(),
          blocks: [{ type: "text", text: "Si è verificato un errore, riprovi tra qualche istante." }],
        });
      } finally {
        setBusy(false);
      }
    },
    [tableId, lineId],
  );

  async function handleFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { document: DocumentRecord; analysis: AnalysisRecord };
      setDoc(data.document);
      setAnalysis(data.analysis);
      setAttachments((prev) => [data.document, ...prev]);
      setPanelOpen(true);
      pushMessage({
        id: mid(),
        role: "user",
        time: now(),
        text: `Ho caricato il rapporto di prova "${file.name}": puoi analizzarlo e verificarne la conformità?`,
        attachment: { document_id: data.document.id, filename: file.name },
      });
      await askAnna(
        `Analizza il rapporto e verifica la conformità per la linea selezionata`,
        data.document,
        { silentUser: true },
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadDemo() {
    setBusy(true);
    try {
      const res = await fetch("/api/demo/R1", { method: "POST" });
      const data = (await res.json()) as { document: DocumentRecord; analysis: AnalysisRecord };
      setDoc(data.document);
      setAnalysis(data.analysis);
      setAttachments((prev) => [data.document, ...prev]);
      setPanelOpen(true);
      pushMessage({
        id: mid(),
        role: "user",
        time: now(),
        text: DEMO_PROMPT,
        attachment: { document_id: data.document.id, filename: data.document.filename },
      });
      await askAnna(DEMO_PROMPT, data.document, { silentUser: true });
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    setMessages([]);
    setDoc(null);
    setAnalysis(null);
    setAttachments([]);
    setVerification(null);
    setInput("");
    setTableId("tab5-121-2020-colA");
    setLineId("L1-soil-washing");
  }

  function submit(text?: string) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setInput("");
    setSuggestOpen(false);
    void askAnna(t, doc);
  }

  function changeTable(id: string) {
    setTableId(id);
    const t = tables.find((x) => x.id === id);
    if (doc && t) void askAnna(`Verifica contro ${t.name.split("(")[0].trim()}`, doc);
  }

  async function saveAnalysis(patch: Record<string, string>) {
    if (!analysis) return;
    const res = await fetch(`/api/analysis/${analysis.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ header: patch }),
    });
    const data = (await res.json()) as { analysis: AnalysisRecord };
    if (data.analysis) {
      setAnalysis(data.analysis);
      if (doc) {
        await askAnna("Ho corretto i dati estratti: riverifica la conformità con la tabella selezionata", doc);
      }
    }
  }

  // Drag & drop over the whole chat column
  const dragProps = {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current++;
      setDragOver(true);
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
    },
  };

  return (
    <>
      <AppHeader title="Chat con Anna" badge="AI Assistant" onNewChat={newChat} />
      <div className="flex min-h-0 flex-1">
        {/* Chat column */}
        <div className="relative flex min-w-0 flex-1 flex-col bg-[#f2f5f2]" {...dragProps}>
          {dragOver && (
            <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand bg-brand-mist/90">
              <div className="text-center">
                <div className="text-3xl">📄</div>
                <div className="mt-1 text-[15px] font-bold text-brand-dark">
                  Rilascia qui il rapporto di prova
                </div>
                <div className="text-[12.5px] text-slate-500">PDF, Excel o immagine</div>
              </div>
            </div>
          )}

          <div ref={scroller} data-chat-scroll className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mx-auto max-w-[760px] space-y-5">
              {messages.length === 0 && <EmptyState onDemo={loadDemo} onSuggestion={(s) => submit(s)} />}
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} m={m} />
                ) : (
                  <AssistantBubble key={m.id} m={m} />
                ),
              )}
              {busy && <TypingBubble />}
            </div>
          </div>

          {/* Input + quick actions */}
          <div className="shrink-0 px-8 pb-5 pt-2">
            <div className="mx-auto max-w-[760px]">
              <div className="relative">
                {suggestOpen && filteredSuggestions.length > 0 && (
                  <ul className="absolute bottom-full z-10 mb-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-panel">
                    {filteredSuggestions.map((s, i) => (
                      <li key={s}>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            submit(s);
                          }}
                          onMouseEnter={() => setSuggestIndex(i)}
                          className={`block w-full px-4 py-2 text-left text-[13px] ${
                            i === suggestIndex ? "bg-brand-mist text-brand-dark" : "text-slate-600"
                          }`}
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-1.5 shadow-card focus-within:border-brand">
                  <input
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setSuggestOpen(true);
                      setSuggestIndex(0);
                    }}
                    onFocus={() => setSuggestOpen(true)}
                    onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSuggestIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSuggestIndex((i) => Math.max(i - 1, 0));
                      } else if (e.key === "Enter") {
                        if (suggestOpen && filteredSuggestions[suggestIndex] && input.trim().length > 0 && filteredSuggestions.length < SUGGESTIONS.length) {
                          submit(filteredSuggestions[suggestIndex]);
                        } else {
                          submit();
                        }
                      } else if (e.key === "Escape") {
                        setSuggestOpen(false);
                      }
                    }}
                    placeholder="Fai una domanda tecnica..."
                    className="h-10 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => submit()}
                    disabled={busy || !input.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40"
                    title="Invia"
                  >
                    <IconSend size={15} />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-3">
                <QuickAction
                  icon={<IconUploadFlask size={17} className="text-brand-dark" />}
                  title="Carica analisi"
                  subtitle="(PDF, Excel, Immagine)"
                  onClick={() => fileInput.current?.click()}
                />
                <QuickAction
                  icon={<IconDoc size={17} className="text-brand-dark" />}
                  title="Carica documento"
                  subtitle="(PDF, Word, Excel)"
                  onClick={() => fileInput.current?.click()}
                />
                <QuickAction
                  icon={<IconCheckSquare size={17} className="text-brand-dark" />}
                  title="Verifica conformità"
                  subtitle="Confronta con limiti"
                  onClick={() =>
                    doc ? submit("Verifica la conformità con la tabella selezionata") : loadDemo()
                  }
                />
                <QuickAction
                  icon={<IconRefresh size={17} className="text-brand-dark" />}
                  title="Nuova chat"
                  subtitle="Azzera conversazione"
                  onClick={newChat}
                />
              </div>
              <input
                ref={fileInput}
                type="file"
                hidden
                accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </div>

        {/* Right doc panel */}
        {doc && analysis && panelOpen && (
          <DocPanel
            document={doc}
            analysis={analysis}
            verification={verification}
            tables={tables}
            lines={lines}
            tableId={tableId}
            lineId={lineId}
            attachments={attachments}
            onClose={() => setPanelOpen(false)}
            onChangeTable={changeTable}
            onChangeLine={setLineId}
            onSaveAnalysis={saveAnalysis}
          />
        )}
      </div>
    </>
  );
}

function UserBubble({ m }: { m: ChatMessage }) {
  return (
    <div className="fade-up flex justify-end">
      <div className="flex max-w-[85%] items-start gap-2.5">
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-700 text-[11px] font-bold text-white">
          FP
        </span>
        <div className="rounded-2xl rounded-tl-sm bg-[#d8efdc] px-4 py-3">
          {m.attachment && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5">
              <IconPdf size={20} />
              <span className="truncate text-[12px] font-semibold text-slate-700">
                {m.attachment.filename}
              </span>
            </div>
          )}
          <p className="text-[13.5px] leading-relaxed text-slate-800">{m.text}</p>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-slate-500">
            {m.time}
            <span className="text-brand-dark">✓✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ m }: { m: ChatMessage }) {
  return (
    <div className="fade-up flex items-start gap-2.5">
      <AnnaAvatar />
      <div className="max-w-[92%] flex-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-5 py-4 shadow-card">
        {m.blocks && <MessageBlocks blocks={m.blocks} />}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-2.5">
      <AnnaAvatar />
      <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-card">
        <div className="flex gap-1.5">
          <span className="typing-dot h-2 w-2 rounded-full bg-brand-dark" />
          <span className="typing-dot h-2 w-2 rounded-full bg-brand-dark" />
          <span className="typing-dot h-2 w-2 rounded-full bg-brand-dark" />
        </div>
      </div>
    </div>
  );
}

function AnnaAvatar() {
  const [hasImage, setHasImage] = useState(true);
  if (hasImage) {
    return (
      <span className="mt-1 block h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-brand/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/anna.jpg"
          alt="Anna"
          className="h-full w-full object-cover object-top"
          onError={() => setHasImage(false)}
        />
      </span>
    );
  }
  return (
    <span className="mt-1 block h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-brand/40">
      <svg viewBox="0 0 32 32" className="h-full w-full">
        <defs>
          <linearGradient id="avb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1a4d30" />
            <stop offset="1" stopColor="#0d281a" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" fill="url(#avb)" />
        <path d="M16 6c-5 0-7 3.6-7 8 0 3.8 1 6 1 9h12c0-3 1-5.2 1-9 0-4.4-2-8-7-8z" fill="#5b3f2e" />
        <ellipse cx="16" cy="14.5" rx="4.2" ry="5.2" fill="#eccaa7" />
        <path d="M11.5 13.5c-.3-4.5 2-6.5 4.5-6.5s4.8 2 4.5 6.5c-.5-2.8-1.5-4-2.2-4.2.2.8.1 1.4.1 1.4-1-1.3-3-1.5-4.5-.9-.9.4-1.6 1.7-2.4 3.7z" fill="#5b3f2e" />
        <path d="M8 32c.8-6.5 4.2-9.5 8-9.5s7.2 3 8 9.5z" fill="#20603c" />
        <path d="M14.2 23l1.8 2 1.8-2c-.5-.6-1.2-.8-1.8-.8s-1.3.2-1.8.8z" fill="#f1f5f2" />
      </svg>
    </span>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-left shadow-card transition hover:-translate-y-px hover:border-brand/50 hover:shadow-panel"
    >
      <div className="flex items-center justify-center gap-1.5">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="truncate text-center text-[12px] font-bold text-slate-800">{title}</div>
          <div className="truncate text-center text-[10.5px] text-slate-400">{subtitle}</div>
        </div>
      </div>
    </button>
  );
}

function EmptyState({
  onDemo,
  onSuggestion,
}: {
  onDemo: () => void;
  onSuggestion: (s: string) => void;
}) {
  return (
    <div className="fade-up mx-auto max-w-[560px] pt-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-pale text-2xl">
        💬
      </div>
      <h2 className="text-[19px] font-bold text-slate-800">Buongiorno, sono Anna.</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
        Carichi un rapporto di prova (o lo trascini qui) e verifico la conformità ai limiti
        normativi per le linee dell&apos;impianto: Tabella 5, criteri di ammissibilità in discarica,
        vincolo POP.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          onClick={onDemo}
          className="rounded-full bg-brand-dark px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:bg-brand"
        >
          ▶ Prova con il campione demo (17 09 03*)
        </button>
        {["Quali codici EER sono ammessi sulla linea di inertizzazione?"].map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[12.5px] font-medium text-slate-600 hover:border-brand/50 hover:text-brand-dark"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

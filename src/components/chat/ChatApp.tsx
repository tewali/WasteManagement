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
import { useImageAvailable } from "../Sidebar";
import DocPanel from "../panel/DocPanel";
import MessageBlocks from "./EsitoCard";
import {
  IconCheckSquare,
  IconChevronL,
  IconDoc,
  IconPdf,
  IconRefresh,
  IconSend,
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

const DEMO_PROMPT =
  "Buongiorno Anna, puoi analizzare questa analisi (allegato) e verificare se il rifiuto 170903* può essere accettato sulla linea Soil Washing secondo i limiti Tabella 5 del D.Lgs. 121/2020?";

const now = () =>
  new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
let seq = 0;
const mid = () => `m${Date.now()}_${seq++}`;

export default function ChatApp({
  tables,
  lines,
  defaultTableId,
  defaultLineId,
  initialConversationId,
}: {
  tables: TableOpt[];
  lines: LineOpt[];
  /** Standard limit table of the default line — the esito shown unless the user switches. */
  defaultTableId: string;
  defaultLineId: string;
  initialConversationId?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [attachments, setAttachments] = useState<DocumentRecord[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [tableId, setTableId] = useState(defaultTableId);
  const [lineId, setLineId] = useState(defaultLineId);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  const persistState = useRef({ conversationId, doc, tableId, lineId });
  persistState.current = { conversationId, doc, tableId, lineId };
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Deep link from the sidebar conversation list (/?c=<id>).
  useEffect(() => {
    if (initialConversationId) void openConversation(initialConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId]);

  // Persist the conversation (and its auto-title) after every exchange.
  useEffect(() => {
    if (messages.length === 0) return;
    const s = persistState.current;
    // Connection failures are transient UI: a stored retry button would come
    // back dead on reload, so they never enter the conversation record.
    const persisted = messages
      .map((m) => ({ ...m, blocks: m.blocks?.filter((b) => b.type !== "errore") }))
      .filter((m) => m.text || (m.blocks?.length ?? 0) > 0 || m.attachment);
    if (persisted.length === 0) return;
    void fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: s.conversationId,
        messages: persisted,
        active_document_id: s.doc?.id ?? null,
        active_table_id: s.tableId,
        active_line_id: s.lineId,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.conversation?.id) setConversationId(d.conversation.id);
      })
      .catch(() => {});
  }, [messages]);

  async function openConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      conversation: {
        id: string;
        messages: ChatMessage[];
        active_table_id: string | null;
        active_line_id: string | null;
      };
      document: DocumentRecord | null;
      analysis: AnalysisRecord | null;
    };
    setConversationId(data.conversation.id);
    setMessages(data.conversation.messages);
    setDoc(data.document);
    setAnalysis(data.analysis);
    setAttachments(data.document ? [data.document] : []);
    setVerification(null);
    if (data.conversation.active_table_id) setTableId(data.conversation.active_table_id);
    if (data.conversation.active_line_id) setLineId(data.conversation.active_line_id);
    setPanelOpen(Boolean(data.document));
  }

  const pushMessage = (m: ChatMessage) => setMessages((prev) => [...prev, m]);

  // Failed requests, keyed by the retry_id carried in the `errore` block that
  // reports them. The action replays the exact call that could not reach the API.
  const [retryActions, setRetryActions] = useState<Record<string, () => Promise<void>>>({});

  /** Plain-language reason, without leaking technical detail into the chat. */
  function failureText(status?: number): { text: string; hint?: string } {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return {
        text: "Il dispositivo sembra offline: non ho potuto inviare la richiesta.",
        hint: "Controlli la connessione e riprovi — il documento caricato resta disponibile.",
      };
    }
    if (status && status >= 500) {
      return {
        text: `Il server ha risposto con un errore (${status}) e la richiesta non è stata completata.`,
        hint: "Può riprovare subito: se l'errore persiste, avvisi un amministratore.",
      };
    }
    if (status) {
      return {
        text: `La richiesta non è andata a buon fine (errore ${status}).`,
        hint: "Può riprovare subito.",
      };
    }
    return {
      text: "Non riesco a raggiungere il server: la richiesta non è stata completata.",
      hint: "Può riprovare subito: nessun dato è andato perso.",
    };
  }

  /** Reports a failed call and registers the action that replays it. */
  function pushFailure(status: number | undefined, action: () => Promise<void>) {
    const retryId = mid();
    setRetryActions((prev) => ({ ...prev, [retryId]: action }));
    const { text, hint } = failureText(status);
    pushMessage({
      id: mid(),
      role: "assistant",
      time: now(),
      blocks: [{ type: "errore", text, hint, retry_id: retryId }],
    });
  }

  /** Drops the error message and replays the request behind it. */
  function runRetry(retryId: string) {
    const action = retryActions[retryId];
    if (!action) return;
    setRetryActions((prev) => {
      const next = { ...prev };
      delete next[retryId];
      return next;
    });
    setMessages((prev) =>
      prev.filter(
        (m) => !(m.blocks ?? []).some((b) => b.type === "errore" && b.retry_id === retryId),
      ),
    );
    void action();
  }

  const askAnna = useCallback(
    async (
      text: string,
      activeDoc: DocumentRecord | null,
      opts?: { silentUser?: boolean; fullCheck?: boolean },
    ) => {
      if (!opts?.silentUser) {
        pushMessage({ id: mid(), role: "user", time: now(), text });
      }
      // Text-only history so the AI assistant has the conversation context.
      const history = messagesRef.current.map((m) => ({
        role: m.role,
        text:
          m.text ??
          (m.blocks ?? [])
            .map((b) =>
              b.type === "text"
                ? b.text
                : b.type === "quadro"
                  ? `[Quadro conformità: ${b.quadro.headline}]`
                  : b.type === "esito"
                  ? `[Esito ${b.verification.limit_table_name.split("(")[0].trim()}: ${b.verification.counts.conforme} conformi, ${b.verification.counts.non_conforme} non conformi, ${b.verification.counts.non_determinato} non determinati]`
                  : "",
            )
            .filter(Boolean)
            .join("\n"),
      }));
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history,
            document_id: activeDoc?.id ?? null,
            table_id: tableId,
            line_id: lineId,
            full_check: opts?.fullCheck ?? false,
          }),
        });
        // A failed request must offer a way back, not a dead end: the retry
        // replays this same call with the user message already on screen.
        if (!res.ok) {
          pushFailure(res.status, () => askAnna(text, activeDoc, { ...opts, silentUser: true }));
          return;
        }
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
        pushFailure(undefined, () => askAnna(text, activeDoc, { ...opts, silentUser: true }));
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableId, lineId],
  );

  async function handleFiles(files: FileList | File[], opts?: { silentUser?: boolean }) {
    const file = Array.from(files)[0];
    if (!file) return;
    // PDF only: reject anything else before uploading.
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      pushMessage({
        id: mid(),
        role: "assistant",
        time: now(),
        blocks: [
          {
            type: "text",
            text: `⚠️ Il file **"${file.name}"** non è un PDF. Sono accettati solo rapporti di prova in formato **PDF**.`,
          },
        ],
      });
      return;
    }
    // Show the uploaded PDF in the chat immediately — the dropzone/empty state
    // disappears now, and the typing indicator covers the extraction time.
    if (!opts?.silentUser) {
      pushMessage({
        id: mid(),
        role: "user",
        time: now(),
        text: `Ho caricato il rapporto di prova "${file.name}": puoi analizzarlo e verificarne la conformità?`,
        attachment: { document_id: "", filename: file.name },
      });
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        // 4xx is a rejected file (wrong type, too large): a retry would fail the
        // same way, so explain it. 5xx and network faults are worth retrying.
        if (res.status < 500) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          pushMessage({
            id: mid(),
            role: "assistant",
            time: now(),
            blocks: [{ type: "text", text: `⚠️ Caricamento rifiutato: ${err?.error ?? "errore sconosciuto"}` }],
          });
          return;
        }
        pushFailure(res.status, () => handleFiles([file], { silentUser: true }));
        return;
      }
      const data = (await res.json()) as {
        document: DocumentRecord;
        analysis: AnalysisRecord;
        extraction_source: "claude" | "fixture";
        ai_enabled: boolean;
        ai_failed: boolean;
      };
      setDoc(data.document);
      setAnalysis(data.analysis);
      setAttachments((prev) => [data.document, ...prev]);
      setPanelOpen(true);
      // Be explicit when the panel shows demo data instead of a real extraction —
      // in plain language, without technical error details (those go to the server log).
      if (data.extraction_source === "fixture") {
        pushMessage({
          id: mid(),
          role: "assistant",
          time: now(),
          blocks: [
            {
              type: "text",
              text: data.ai_failed
                ? `⚠️ Non sono riuscita a leggere il documento in questo momento: nel pannello a destra sono mostrati **dati dimostrativi**. Riprovi il caricamento tra qualche istante.`
                : `⚠️ L'estrazione automatica non è configurata su questo ambiente: nel pannello a destra sono mostrati **dati dimostrativi**. Un amministratore può attivarla dalle impostazioni del server.`,
            },
          ],
        });
      }
      await askAnna(
        `Analizza il rapporto e verifica la conformità rispetto a tutte le tabelle limiti attive nell'impianto`,
        data.document,
        { silentUser: true, fullCheck: true },
      );
    } catch {
      pushFailure(undefined, () => handleFiles([file], { silentUser: true }));
    } finally {
      setBusy(false);
    }
  }

  async function loadDemo() {
    setBusy(true);
    try {
      const res = await fetch("/api/demo/R1", { method: "POST" });
      if (!res.ok) {
        pushFailure(res.status, loadDemo);
        return;
      }
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
    } catch {
      pushFailure(undefined, loadDemo);
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setDoc(null);
    setAnalysis(null);
    setAttachments([]);
    setVerification(null);
    setInput("");
    setTableId(defaultTableId);
    setLineId(defaultLineId);
  }

  function submit(text?: string) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setInput("");
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
      <AppHeader
        title="Chat con Anna"
        badge="AI Assistant"
        onNewChat={newChat}
        onOpenConversation={openConversation}
        activeConversationId={conversationId}
      />
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
                <div className="text-[12.5px] text-slate-500">Solo file PDF</div>
              </div>
            </div>
          )}

          {doc && !panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-2 pr-3.5 text-[12px] font-semibold text-slate-700 shadow-panel transition hover:border-brand/50 hover:text-brand-dark"
              title="Riapri il pannello documento"
            >
              <IconPdf size={18} />
              <span className="max-w-[180px] truncate">{doc.filename}</span>
              <IconChevronL size={13} className="text-brand-dark" />
            </button>
          )}
          <div ref={scroller} data-chat-scroll className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mx-auto max-w-[760px] space-y-5">
              {messages.length === 0 && (
                <EmptyState onDemo={loadDemo} onUpload={() => fileInput.current?.click()} />
              )}
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} m={m} />
                ) : (
                  <AssistantBubble
                    key={m.id}
                    m={m}
                    onRetry={runRetry}
                    canRetry={(id) => Boolean(retryActions[id])}
                  />
                ),
              )}
              {busy && <TypingBubble />}
            </div>
          </div>

          {/* Input + quick actions */}
          <div className="shrink-0 px-8 pb-5 pt-2">
            <div className="mx-auto max-w-[760px]">
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-1.5 shadow-card focus-within:border-brand">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
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

              <div className="mt-3 grid grid-cols-3 gap-3">
                <QuickAction
                  icon={<IconDoc size={17} className="text-brand-dark" />}
                  title="Carica documento"
                  subtitle="(solo PDF)"
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
                accept=".pdf,application/pdf"
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
          AP
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

function AssistantBubble({
  m,
  onRetry,
  canRetry,
}: {
  m: ChatMessage;
  onRetry?: (retryId: string) => void;
  canRetry?: (retryId: string) => boolean;
}) {
  return (
    <div className="fade-up flex items-start gap-2.5">
      <AnnaAvatar />
      <div className="max-w-[92%] flex-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-5 py-4 shadow-card">
        {m.blocks && <MessageBlocks blocks={m.blocks} onRetry={onRetry} canRetry={canRetry} />}
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
  const hasImage = useImageAvailable("/anna.png");
  if (hasImage) {
    return (
      <span className="mt-1 block h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-brand/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/anna.png" alt="Anna" className="h-full w-full object-cover object-top" />
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

function EmptyState({ onDemo, onUpload }: { onDemo: () => void; onUpload: () => void }) {
  return (
    <div className="fade-up mx-auto max-w-[620px] pt-8 text-center">
      <h2 className="text-[19px] font-bold text-slate-800">Buongiorno, sono Anna.</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">
        Carichi un rapporto di prova: estraggo i dati e verifico la conformità ai limiti
        normativi per le linee dell&apos;impianto.
      </p>
      <button
        onClick={onUpload}
        className="group mt-6 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 px-8 py-14 transition hover:border-brand hover:bg-brand-mist/60"
        title="Seleziona un rapporto di prova"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-pale text-2xl transition group-hover:scale-105">
          📄
        </span>
        <span className="text-[15px] font-bold text-slate-700 group-hover:text-brand-dark">
          Trascina qui il rapporto di prova
        </span>
        <span className="text-[12.5px] text-slate-400">
          oppure fai clic per selezionare il file · solo PDF
        </span>
      </button>
      <button
        onClick={onDemo}
        className="mt-4 text-[12.5px] font-semibold text-brand-dark hover:underline"
      >
        oppure prova con il campione demo (17 09 03*)
      </button>
    </div>
  );
}

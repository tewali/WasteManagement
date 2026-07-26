// Minimal JSON-file persistence for the MVP demo (swapped for Postgres in
// production per docs/PROPOSAL.md). Single-process only.
import fs from "fs";
import path from "path";
import type { AnalysisRecord, Conversation, DocumentRecord, VerificationRecord } from "./types";

interface Db {
  documents: DocumentRecord[];
  analyses: AnalysisRecord[];
  verifications: VerificationRecord[];
  conversations: Conversation[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

let db: Db | null = null;

function load(): Db {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) as Db;
  } catch {
    db = { documents: [], analyses: [], verifications: [], conversations: [] };
  }
  return db;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const store = {
  get: load,
  addDocument(doc: DocumentRecord, analysis: AnalysisRecord) {
    const d = load();
    d.documents.unshift(doc);
    d.analyses.unshift(analysis);
    save();
  },
  updateAnalysis(id: string, patch: Partial<AnalysisRecord>) {
    const d = load();
    const a = d.analyses.find((x) => x.id === id);
    if (!a) return null;
    Object.assign(a, patch, { edited: true });
    save();
    return a;
  },
  addVerification(v: VerificationRecord) {
    const d = load();
    d.verifications.unshift(v);
    save();
  },
  upsertConversation(c: Conversation) {
    const d = load();
    const i = d.conversations.findIndex((x) => x.id === c.id);
    if (i >= 0) d.conversations[i] = c;
    else d.conversations.unshift(c);
    save();
  },
  analysisForDocument(documentId: string) {
    return load().analyses.find((a) => a.document_id === documentId) ?? null;
  },
  document(id: string) {
    return load().documents.find((x) => x.id === id) ?? null;
  },
};

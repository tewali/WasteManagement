import fs from "fs";
import path from "path";
import PageShell from "@/components/PageShell";
import NormativaBrowser from "@/components/NormativaBrowser";
import { limitDisplay } from "@/lib/rules-engine";
import { analyteLabel, getSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

// Phase 1: static normative library from docs/context with keyword search
// (Phase 2 target on Postgres: RAG over the full norm texts).
function catalogSections(): { title: string; items: string[] }[] {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "docs", "context", "gemini-1-normativa.md"),
      "utf-8",
    );
    const sections: { title: string; items: string[] }[] = [];
    let current: { title: string; items: string[] } | null = null;
    for (const line of raw.split("\n")) {
      const h = line.match(/^###?\s+(.*)/);
      if (h) {
        if (current?.items.length) sections.push(current);
        current = { title: h[1].replace(/^\d+\.\s*/, ""), items: [] };
      } else if (/^- /.test(line) && current) {
        current.items.push(
          line
            .replace(/^- /, "")
            .replace(/\*\*/g, "")
            .replace(/\[|\]\(.*?\)/g, ""),
        );
      }
    }
    if (current?.items.length) sections.push(current);
    return sections;
  } catch {
    return [];
  }
}

export default function NormativaPage() {
  const seed = getSeed();
  // Full contents, so a table can be opened and read parameter by parameter —
  // the limits are formatted by the same helper the rules engine uses for its
  // verdicts, so the library and the esiti can never disagree.
  const tables = seed.tables.map((t) => ({
    id: t.id,
    name: t.name,
    normativa: t.normativa,
    version: t.version,
    validated: t.status !== "SIMULATED_DA_VALIDARE",
    basis: t.basis,
    unit: t.unit,
    valid_from: t.valid_from,
    valid_to: t.valid_to,
    blocking: Boolean(t.blocking),
    blocking_consequence: t.blocking_consequence ?? null,
    source_ref: (t as { source_ref?: string }).source_ref ?? null,
    entries: t.entries.map((e) => ({
      label: analyteLabel(e.analyte_key),
      limit: limitDisplay(e, t.unit),
      unit: e.unit ?? t.unit,
      notes: e.notes ?? null,
      kind: e.kind ?? null,
    })),
  }));
  return (
    <PageShell title="Normativa e procedure">
      <NormativaBrowser sections={catalogSections()} tables={tables} />
    </PageShell>
  );
}

import PageShell from "@/components/PageShell";
import { getSeed } from "@/lib/seed";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Phase 1: static normative library from docs/context (Phase 2: RAG + search).
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
  const sections = catalogSections();
  return (
    <PageShell title="Normativa e procedure">
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-700">
          Tabelle limiti attive nell&apos;impianto
        </h2>
        <ul className="mt-3 space-y-2">
          {seed.tables.map((t) => (
            <li key={t.id} className="flex items-center gap-3 text-[13px]">
              <span
                className={`rounded px-2 py-0.5 text-[10.5px] font-bold ${
                  t.status === "SIMULATED_DA_VALIDARE"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-brand-pale text-brand-dark"
                }`}
              >
                {t.status === "SIMULATED_DA_VALIDARE" ? "DA VALIDARE" : "VALIDATA"}
              </span>
              <span className="font-semibold text-slate-800">{t.name.split("(")[0].trim()}</span>
              <span className="text-slate-400">v{t.version} · {t.normativa.split("(")[0].trim()}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((s) => (
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
    </PageShell>
  );
}

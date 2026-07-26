import PageShell from "@/components/PageShell";
import {
  dashboardKpis,
  esitoStats,
  lineUtilization,
  monthlyTonnage,
  topEer,
} from "@/lib/analytics";
import { effectiveStatus } from "@/lib/omologhe";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

// Brand hexes (tailwind.config.ts) for the SVG marks; text stays in slate ink.
const GREEN = "#16a34a";
const RED = "#dc2626";
const GRID = "#e2e8f0";

const fmtT = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 });

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "ko" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-card">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div
        className={`mt-1 text-[24px] font-bold leading-tight tabular-nums ${
          tone === "ko" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11.5px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-[13.5px] font-bold text-slate-800">{title}</h2>
      {sub && <p className="mt-0.5 text-[11.5px] text-slate-400">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const movements = store.movements();
  const lines = store.lines();
  const verifications = store.get().verifications;
  const omologhe = store.omologhe().map((o) => ({ ...o, effective_status: effectiveStatus(o) }));

  const kpis = dashboardKpis(movements, omologhe, year);
  const months = monthlyTonnage(movements, now, 12);
  const eer = topEer(movements, 5);
  const util = lineUtilization(movements, lines, year);
  const esiti = esitoStats(verifications);
  const pendingSubmissions = store.submissions().filter((s) => s.status === "inviato").length;

  // Monthly bar chart geometry (SVG; native <title> = hover tooltip).
  const W = 440;
  const H = 150;
  const PAD_B = 18;
  const maxT = Math.max(...months.map((m) => m.tonnes), 1);
  const barW = Math.floor(W / months.length) - 2; // 2px surface gap between bars
  const maxIdx = months.reduce((best, m, i) => (m.tonnes > months[best].tonnes ? i : best), 0);

  return (
    <PageShell title="Dashboard" badge={`Anno ${year}`}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Conferimenti" value={String(kpis.movements_ytd)} sub={`accettati nel ${year}`} />
          <Kpi label="Tonnellate" value={fmtT(kpis.tonnes_ytd)} sub={`accettate nel ${year}`} />
          <Kpi label="In arrivo" value={String(kpis.in_arrivo)} sub="movimenti da chiudere" />
          <Kpi
            label="Respinti"
            value={String(kpis.respinti_ytd)}
            sub={`nel ${year}`}
            tone={kpis.respinti_ytd > 0 ? "ko" : undefined}
          />
          <Kpi label="Omologhe attive" value={String(kpis.omologhe_attive)} sub={`${kpis.omologhe_in_scadenza} in scadenza`} />
          <Kpi
            label="Portale clienti"
            value={String(pendingSubmissions)}
            sub="invii da verificare"
            tone={pendingSubmissions > 0 ? "warn" : undefined}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card
            title="Tonnellate accettate per mese"
            sub="Ultimi 12 mesi — quantità a destino (pesa) o dichiarata"
          >
            <svg viewBox={`0 0 ${W} ${H + PAD_B}`} className="w-full" role="img" aria-label="Tonnellate accettate per mese, ultimi 12 mesi">
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <line key={f} x1={0} x2={W} y1={H - f * (H - 14)} y2={H - f * (H - 14)} stroke={GRID} strokeWidth={1} />
              ))}
              {months.map((m, i) => {
                const h = Math.round(((H - 14) * m.tonnes) / maxT);
                const x = i * (barW + 2);
                return (
                  <g key={m.month}>
                    <rect
                      x={x}
                      y={H - h}
                      width={barW}
                      height={Math.max(h, m.tonnes > 0 ? 2 : 0)}
                      rx={3}
                      fill={GREEN}
                    >
                      <title>{`${m.label} ${m.month.slice(0, 4)}: ${fmtT(m.tonnes)} t · ${m.movements} conferimenti`}</title>
                    </rect>
                    {/* baseline-anchored: square off the rounded bottom corners */}
                    {h > 3 && <rect x={x} y={H - 3} width={barW} height={3} fill={GREEN} />}
                    {i === maxIdx && m.tonnes > 0 && (
                      <text x={x + barW / 2} y={H - h - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#475569">
                        {fmtT(m.tonnes)}
                      </text>
                    )}
                    <text x={x + barW / 2} y={H + 13} textAnchor="middle" fontSize={9.5} fill="#94a3b8">
                      {m.label}
                    </text>
                  </g>
                );
              })}
              <line x1={0} x2={W} y1={H} y2={H} stroke="#cbd5e1" strokeWidth={1} />
            </svg>
          </Card>

          <Card title="Esiti delle verifiche di conformità" sub="Tutte le verifiche registrate nell'audit trail">
            {esiti.total === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-slate-400">Nessuna verifica registrata.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex h-7 w-full overflow-hidden rounded-lg" role="img" aria-label={`${esiti.conformi} verifiche conformi e ${esiti.non_conformi} non conformi su ${esiti.total}`}>
                  {esiti.conformi > 0 && (
                    <div
                      className="flex items-center justify-center text-[11px] font-bold text-white"
                      style={{ width: `${(esiti.conformi / esiti.total) * 100}%`, backgroundColor: GREEN, marginRight: esiti.non_conformi > 0 ? 2 : 0 }}
                      title={`Conformi: ${esiti.conformi}`}
                    >
                      {esiti.conformi}
                    </div>
                  )}
                  {esiti.non_conformi > 0 && (
                    <div
                      className="flex items-center justify-center text-[11px] font-bold text-white"
                      style={{ width: `${(esiti.non_conformi / esiti.total) * 100}%`, backgroundColor: RED }}
                      title={`Non conformi: ${esiti.non_conformi}`}
                    >
                      {esiti.non_conformi}
                    </div>
                  )}
                </div>
                <ul className="space-y-1.5 text-[12.5px] text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: GREEN }} />
                    Conformi: <span className="font-semibold">{esiti.conformi}</span> su {esiti.total}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: RED }} />
                    Non conformi: <span className="font-semibold">{esiti.non_conformi}</span>
                    {esiti.di_cui_bloccanti > 0 && (
                      <span className="text-[11.5px] text-slate-400">
                        (di cui {esiti.di_cui_bloccanti} per vincolo POP bloccante)
                      </span>
                    )}
                  </li>
                </ul>
              </div>
            )}
          </Card>

          <Card title="Codici EER conferiti" sub={`Tonnellate accettate per codice — top ${eer.length}`}>
            {eer.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-slate-400">Nessun conferimento accettato.</p>
            ) : (
              <div className="space-y-2.5">
                {eer.map((e) => {
                  const max = eer[0].tonnes || 1;
                  return (
                    <div key={e.eer} className="flex items-center gap-3">
                      <span className="w-[86px] shrink-0 font-mono text-[11.5px] font-semibold text-slate-700">
                        {e.eer}
                      </span>
                      <div className="h-4 min-w-0 flex-1 rounded-[3px] bg-slate-100">
                        <div
                          className="h-4 rounded-[3px]"
                          style={{ width: `${(e.tonnes / max) * 100}%`, backgroundColor: GREEN }}
                          title={`${e.eer}: ${fmtT(e.tonnes)} t in ${e.movements} conferimenti`}
                        />
                      </div>
                      <span className="w-[64px] shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-slate-600">
                        {fmtT(e.tonnes)} t
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Utilizzo capacità autorizzata" sub={`Tonnellate accettate ${year} vs capacità annua per linea`}>
            <div className="space-y-4">
              {util.map((u) => (
                <div key={u.line_id}>
                  <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                    <span className="font-semibold text-slate-700">{u.line_name}</span>
                    <span className="tabular-nums text-slate-500">
                      {fmtT(u.tonnes_ytd)} / {u.capacity_t.toLocaleString("it-IT")} t
                      <span className="ml-1.5 font-semibold text-slate-700">
                        {u.ratio > 0 && u.ratio < 0.01 ? "<1" : Math.round(u.ratio * 100)}%
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-3 w-full rounded-[3px] bg-slate-100"
                    role="img"
                    aria-label={`${u.line_name}: ${Math.round(u.ratio * 100)}% della capacità autorizzata`}
                    title={`${fmtT(u.tonnes_ytd)} t accettate su ${u.capacity_t.toLocaleString("it-IT")} t autorizzate`}
                  >
                    <div
                      className="h-3 rounded-[3px]"
                      style={{
                        width: `${u.pct * 100}%`,
                        backgroundColor: u.ratio > 0.9 ? RED : u.ratio > 0.75 ? "#d97706" : GREEN,
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-400">
                Sopra il 75% della capacità la barra diventa ambra, sopra il 90% rossa (soglie
                operative, non autorizzative).
              </p>
            </div>
          </Card>
        </div>

        <p className="text-[11.5px] text-slate-400">
          Dati derivati da movimenti, verifiche e omologhe di questo impianto. La reportistica
          multi-impianto arriverà con la migrazione a Postgres (tenancy per organizzazione).
        </p>
        <span className="sr-only" aria-hidden={false}>
          {/* Table view of the monthly chart for screen readers */}
          {months.map((m) => `${m.label} ${m.month.slice(0, 4)}: ${fmtT(m.tonnes)} tonnellate. `)}
        </span>
      </div>
    </PageShell>
  );
}

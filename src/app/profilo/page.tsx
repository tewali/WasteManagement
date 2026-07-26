import PageShell from "@/components/PageShell";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function seedUsers() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "seed", "organization.json"), "utf-8"),
  ) as {
    organization: { name: string; vat_number: string; address: string };
    users: { id: string; name: string; email: string; role: string; title: string }[];
  };
  return raw;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Amministratore",
  operator: "Operatore",
  acceptance: "Accettazione",
};

export default function ProfiloPage() {
  const { organization, users } = seedUsers();
  const me = users[0];
  const initials = me.name
    .split(" ")
    .map((p) => p[0])
    .join("");
  return (
    <PageShell title="Profilo utente">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest-700 text-[20px] font-bold text-white">
            {initials}
          </span>
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">{me.name}</h2>
            <p className="text-[13px] text-slate-500">{me.title}</p>
          </div>
          <span className="ml-auto rounded-md bg-brand-pale px-2.5 py-1 text-[11.5px] font-semibold text-brand-dark">
            {ROLE_LABEL[me.role] ?? me.role}
          </span>
        </div>
        <dl className="mt-6 divide-y divide-slate-100">
          {[
            ["Email", me.email],
            ["Organizzazione", organization.name],
            ["P. IVA", organization.vat_number],
            ["Sede", organization.address],
            ["Ruolo applicativo", ROLE_LABEL[me.role] ?? me.role],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 py-2.5">
              <dt className="w-[160px] shrink-0 text-[12.5px] text-slate-500">{k}</dt>
              <dd className="flex-1 text-[13px] font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-[11.5px] font-medium text-amber-700">
          Utente dimostrativo: autenticazione, gestione utenti e ruoli arrivano con la Fase 2
          (Auth.js — OIDC/SSO, vedi docs/PROPOSAL.md §4).
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-slate-700">
          Altri utenti dell&apos;organizzazione
        </h3>
        <ul className="mt-3 space-y-2">
          {users.slice(1).map((u) => (
            <li key={u.id} className="flex items-center gap-3 text-[13px]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
                {u.name.split(" ").map((p) => p[0]).join("")}
              </span>
              <span className="font-semibold text-slate-800">{u.name}</span>
              <span className="text-slate-400">{u.title}</span>
              <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {ROLE_LABEL[u.role] ?? u.role}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}

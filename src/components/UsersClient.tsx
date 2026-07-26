"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconTrash, IconX } from "./icons";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/user-admin";
import type { InviteRecord, InviteState, UserAccount } from "@/lib/users";

type UserRow = Omit<UserAccount, "password_hash">;
type InviteRow = InviteRecord & { state: InviteState };

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-forest-700 text-white",
  operator: "bg-brand-pale text-brand-dark",
  acceptance: "bg-sky-100 text-sky-700",
  producer: "bg-amber-100 text-amber-700",
};

const INVITE_STATE: Record<InviteState, { cls: string; label: string }> = {
  valid: { cls: "bg-brand-pale text-brand-dark", label: "In attesa" },
  used: { cls: "bg-slate-200 text-slate-600", label: "Utilizzato" },
  expired: { cls: "bg-amber-100 text-amber-700", label: "Scaduto" },
  not_found: { cls: "bg-slate-200 text-slate-600", label: "—" },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("it-IT");

export default function UsersClient({
  currentUserId,
  users,
  invites,
}: {
  currentUserId: string;
  users: UserRow[];
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "operator", company: "" });
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "operator",
    title: "",
    company: "",
  });

  async function api(path: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
    setBusy(true);
    const res = await fetch(path, init).catch(() => null);
    const data = (await res?.json().catch(() => null)) as Record<string, unknown> | null;
    setBusy(false);
    if (!res?.ok) {
      setError((data?.error as string) ?? "Operazione non riuscita.");
      return null;
    }
    setError(null);
    return data;
  }

  async function createInvite() {
    setNotice(null);
    const data = await api("/api/users/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    if (!data) return;
    const link = `${window.location.origin}${data.register_path as string}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
    } catch {
      // clipboard unavailable (permissions/insecure context): the link stays in the notice
    }
    setNotice(`Invito creato${copied ? " — link copiato negli appunti" : ""}: ${link}`);
    setInviting(false);
    setInviteForm({ email: "", role: "operator", company: "" });
    router.refresh();
  }

  async function copyInvite(i: InviteRow) {
    const link = `${window.location.origin}/register?invite=${i.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Link d'invito copiato negli appunti.");
    } catch {
      setNotice(`Link d'invito: ${link}`);
    }
  }

  async function addUser() {
    setNotice(null);
    const data = await api("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    if (!data) return;
    setNotice(
      `Account creato per ${addForm.email}. Comunicare la password temporanea in modo sicuro.`,
    );
    setAdding(false);
    setAddForm({ name: "", email: "", password: "", role: "operator", title: "", company: "" });
    router.refresh();
  }

  async function changeRole(u: UserRow, role: string) {
    if (role === u.role) return;
    if (await api("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, role }),
    })) {
      setNotice(`${u.name} ora è ${roleLabel(role)}.`);
      router.refresh();
    }
  }

  async function removeUser(u: UserRow) {
    if (!window.confirm(`Rimuovere l'account di ${u.name} (${u.email})?`)) return;
    if (await api(`/api/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" })) {
      setNotice(`Account di ${u.name} rimosso.`);
      router.refresh();
    }
  }

  async function revokeInvite(i: InviteRow) {
    if (await api(`/api/users/invites?token=${encodeURIComponent(i.token)}`, { method: "DELETE" })) {
      router.refresh();
    }
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-brand";
  const pendingInvites = invites.filter((i) => i.state === "valid");
  const pastInvites = invites.filter((i) => i.state !== "valid");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[520px] text-[12.5px] text-slate-500">
          Solo gli amministratori possono invitare, aggiungere o rimuovere persone. Un invito è un
          link di registrazione monouso (validità 14 giorni) con ruolo già assegnato: l&apos;app non
          invia email, il link va condiviso direttamente.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAdding((a) => !a);
              setInviting(false);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 hover:border-brand/50"
          >
            <IconPlus size={13} /> Aggiungi direttamente
          </button>
          <button
            onClick={() => {
              setInviting((i) => !i);
              setAdding(false);
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-dark px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-brand"
          >
            <IconPlus size={14} /> Invita
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
      )}
      {notice && (
        <p className="break-all rounded-md bg-brand-mist px-3 py-2 text-[12px] font-medium text-brand-dark">
          {notice}
        </p>
      )}

      {inviting && (
        <div className="rounded-xl border-2 border-brand/40 bg-white p-5 shadow-panel">
          <h3 className="text-[13.5px] font-bold text-slate-800">Nuovo invito</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">
                Email (facoltativa — se indicata, il link vale solo per quell&apos;indirizzo)
              </span>
              <input
                className={inputCls}
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="nome@azienda.it"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Ruolo</span>
              <select
                className={inputCls}
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            {inviteForm.role === "producer" && (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">
                  Azienda produttrice
                </span>
                <input
                  className={inputCls}
                  value={inviteForm.company}
                  onChange={(e) => setInviteForm({ ...inviteForm, company: e.target.value })}
                  placeholder="Costruzioni Bianchi S.r.l."
                />
              </label>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void createInvite()}
              disabled={busy}
              className="rounded-lg bg-brand-dark px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand disabled:opacity-50"
            >
              {busy ? "Creo…" : "Genera link d'invito"}
            </button>
            <button
              onClick={() => setInviting(false)}
              className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-slate-500 hover:bg-slate-100"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {adding && (
        <div className="rounded-xl border-2 border-brand/40 bg-white p-5 shadow-panel">
          <h3 className="text-[13.5px] font-bold text-slate-800">Aggiungi un account direttamente</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Nome e cognome</span>
              <input
                className={inputCls}
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Mario Rossi"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Email</span>
              <input
                className={inputCls}
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="nome@azienda.it"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">
                Password temporanea (min. 8)
              </span>
              <input
                className={inputCls}
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                placeholder="da comunicare a voce"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">Ruolo</span>
              <select
                className={inputCls}
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            {addForm.role === "producer" ? (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">
                  Azienda produttrice
                </span>
                <input
                  className={inputCls}
                  value={addForm.company}
                  onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                  placeholder="Costruzioni Bianchi S.r.l."
                />
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-slate-600">
                  Mansione (facoltativa)
                </span>
                <input
                  className={inputCls}
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  placeholder="Tecnico Ambientale"
                />
              </label>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void addUser()}
              disabled={busy}
              className="rounded-lg bg-brand-dark px-4 py-2 text-[12.5px] font-bold text-white hover:bg-brand disabled:opacity-50"
            >
              {busy ? "Creo…" : "Crea account"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-slate-500 hover:bg-slate-100"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Utente</th>
              <th className="px-4 py-2.5">Ruolo</th>
              <th className="px-4 py-2.5">Mansione / Azienda</th>
              <th className="px-4 py-2.5">Creato</th>
              <th className="px-4 py-2.5 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-slate-800">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-1.5 text-[10.5px] font-bold text-brand-dark">(tu)</span>
                    )}
                  </span>
                  <span className="block text-[11.5px] text-slate-400">{u.email}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE[u.role] ?? "bg-slate-200 text-slate-600"}`}
                  >
                    {roleLabel(u.role)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{u.company ?? u.title}</td>
                <td className="px-4 py-2.5 text-slate-500">{fmtDate(u.created_at)}</td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center justify-end gap-1.5">
                    <select
                      value={u.role}
                      disabled={busy || u.id === currentUserId}
                      onChange={(e) => void changeRole(u, e.target.value)}
                      className="h-8 rounded-md border border-slate-200 px-1.5 text-[11.5px] text-slate-600 outline-none focus:border-brand disabled:opacity-40"
                      title={u.id === currentUserId ? "Non puoi cambiare il tuo ruolo" : "Cambia ruolo"}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void removeUser(u)}
                      disabled={busy || u.id === currentUserId}
                      className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                      title={u.id === currentUserId ? "Non puoi rimuovere il tuo account" : "Rimuovi account"}
                    >
                      <IconTrash size={13} />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="mb-2 text-[13.5px] font-bold text-slate-700">
          Inviti in attesa ({pendingInvites.length})
        </h2>
        {pendingInvites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-6 text-center text-[12.5px] text-slate-400">
            Nessun invito in attesa.
          </div>
        ) : (
          <div className="space-y-2">
            {pendingInvites.map((i) => (
              <div
                key={i.token}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-card"
              >
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE[i.role] ?? ""}`}
                >
                  {roleLabel(i.role)}
                </span>
                <div className="min-w-0 flex-1 text-[12.5px] text-slate-600">
                  {i.email ?? "chiunque abbia il link"}
                  {i.company ? ` · ${i.company}` : ""}
                  <span className="block text-[11px] text-slate-400">
                    Creato da {i.created_by} il {fmtDate(i.created_at)} — scade il {fmtDate(i.expires_at)}
                  </span>
                </div>
                <button
                  onClick={() => void copyInvite(i)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-brand-dark hover:border-brand/50"
                >
                  Copia link
                </button>
                <button
                  onClick={() => void revokeInvite(i)}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-red-300 hover:text-red-600"
                  title="Revoca invito"
                >
                  <IconX size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {pastInvites.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12px] font-semibold text-slate-500">
              Inviti utilizzati o scaduti ({pastInvites.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {pastInvites.map((i) => (
                <div
                  key={i.token}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-4 py-2 text-[12px] text-slate-500"
                >
                  <span className={`rounded px-2 py-0.5 text-[10.5px] font-semibold ${INVITE_STATE[i.state].cls}`}>
                    {INVITE_STATE[i.state].label}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {roleLabel(i.role)} · {i.used_by_email ?? i.email ?? "link aperto"}
                  </span>
                  <span className="text-[11px] text-slate-400">{fmtDate(i.created_at)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

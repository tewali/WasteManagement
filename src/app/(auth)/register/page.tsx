"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface InviteInfo {
  email: string | null;
  role: string;
  role_label: string;
  company: string | null;
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const inviteToken = useSearchParams().get("invite");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", title: "", company: "" });
  const [accountType, setAccountType] = useState<"staff" | "producer">("staff");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    void fetch(`/api/users/invites/${inviteToken}`)
      .then(async (res) => {
        const data = (await res.json()) as InviteInfo & { state: string };
        if (!res.ok || data.state !== "valid") {
          setInviteError(
            data.state === "used"
              ? "Questo invito è già stato utilizzato."
              : data.state === "expired"
                ? "Questo invito è scaduto: richiederne uno nuovo all'amministratore."
                : "Invito non valido.",
          );
          return;
        }
        setInvite(data);
        setForm((f) => ({ ...f, email: data.email ?? f.email }));
      })
      .catch(() => setInviteError("Verifica dell'invito non riuscita."));
  }, [inviteToken]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        account_type: accountType,
        ...(invite && inviteToken ? { invite_token: inviteToken } : {}),
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Registrazione non riuscita.");
      setBusy(false);
      return;
    }
    // Auto-login with the new credentials.
    const login = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setBusy(false);
    if (login?.error) {
      router.push("/login");
    } else {
      const producer = invite ? invite.role === "producer" : accountType === "producer";
      router.push(producer ? "/portale" : "/");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-panel">
        <h1 className="text-[20px] font-bold text-slate-900">Crea un account</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Registrati al portale tecnico di Valli S.p.A.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {inviteError && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-[12.5px] font-medium text-amber-700">
              {inviteError}
            </p>
          )}
          {invite ? (
            <p className="rounded-md bg-brand-mist px-3 py-2 text-[12.5px] font-medium text-brand-dark">
              Invito valido — il tuo account sarà <b>{invite.role_label}</b>
              {invite.company ? ` per ${invite.company}` : ""}.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ["staff", "Operatore Valli"],
                  ["producer", "Cliente produttore"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAccountType(value)}
                  className={`h-9 rounded-md text-[12.5px] font-semibold transition ${
                    accountType === value ? "bg-white text-brand-dark shadow-sm" : "text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">
              Nome e cognome
            </span>
            <input
              required
              autoFocus
              value={form.name}
              onChange={set("name")}
              placeholder="Mario Rossi"
              className="h-11 w-full rounded-lg border border-slate-200 px-3.5 text-[14px] outline-none focus:border-brand"
            />
          </label>
          {invite ? null : accountType === "staff" ? (
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-600">
                Ruolo (facoltativo)
              </span>
              <input
                value={form.title}
                onChange={set("title")}
                placeholder="Tecnico Ambientale"
                className="h-11 w-full rounded-lg border border-slate-200 px-3.5 text-[14px] outline-none focus:border-brand"
              />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-600">
                Azienda produttrice
              </span>
              <input
                required
                value={form.company}
                onChange={set("company")}
                placeholder="Costruzioni Bianchi S.r.l."
                className="h-11 w-full rounded-lg border border-slate-200 px-3.5 text-[14px] outline-none focus:border-brand"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Email</span>
            <input
              type="email"
              required
              readOnly={Boolean(invite?.email)}
              value={form.email}
              onChange={set("email")}
              placeholder="nome@azienda.it"
              className={`h-11 w-full rounded-lg border border-slate-200 px-3.5 text-[14px] outline-none focus:border-brand ${
                invite?.email ? "bg-slate-50 text-slate-500" : ""
              }`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">
              Password (min. 8 caratteri)
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={set("password")}
              placeholder="••••••••"
              className="h-11 w-full rounded-lg border border-slate-200 px-3.5 text-[14px] outline-none focus:border-brand"
            />
          </label>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-lg bg-brand-dark text-[14px] font-bold text-white transition hover:bg-brand disabled:opacity-50"
          >
            {busy ? "Creazione account…" : "Registrati"}
          </button>
        </form>
        <p className="mt-5 text-center text-[13px] text-slate-500">
          Hai già un account?{" "}
          <Link href="/login" className="font-semibold text-brand-dark hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}

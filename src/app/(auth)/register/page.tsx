"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", title: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
      router.push("/");
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
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={set("email")}
              placeholder="nome@azienda.it"
              className="h-11 w-full rounded-lg border border-slate-200 px-3.5 text-[14px] outline-none focus:border-brand"
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

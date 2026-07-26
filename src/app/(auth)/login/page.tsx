"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError("Email o password non corretti.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-panel">
        <h1 className="text-[20px] font-bold text-slate-900">Accedi</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Entra nel portale tecnico di Valli S.p.A.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Email</span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@azienda.it"
              className="h-11 w-full rounded-lg border border-slate-200 px-3.5 text-[14px] outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {busy ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>
        <p className="mt-5 text-center text-[13px] text-slate-500">
          Non hai un account?{" "}
          <Link href="/register" className="font-semibold text-brand-dark hover:underline">
            Registrati
          </Link>
        </p>
      </div>
      <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 py-2.5 text-center text-[11.5px] text-slate-500">
        Account demo: <span className="font-mono">a.parolini@vallispa.example</span> ·{" "}
        <span className="font-mono">valli-demo</span>
      </p>
    </div>
  );
}

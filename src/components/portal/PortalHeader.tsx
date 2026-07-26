"use client";

import { signOut } from "next-auth/react";
import { IconLeaf } from "../icons";
import { useImageAvailable } from "../Sidebar";

export default function PortalHeader({ name, company }: { name: string; company: string }) {
  const hasLogo = useImageAvailable("/valli-logo.png");
  return (
    <header className="flex items-center justify-between bg-forest-900 px-6 py-3.5 text-white">
      <div className="flex items-center gap-3">
        {hasLogo ? (
          <span className="rounded-md bg-white/95 px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/valli-logo.png" alt="Valli S.p.A." className="h-6 w-auto" />
          </span>
        ) : (
          <IconLeaf size={26} />
        )}
        <div>
          <div className="text-[15px] font-extrabold leading-tight">
            Portale clienti <span className="text-brand-bright">Valli S.p.A.</span>
          </div>
          <div className="text-[11px] text-emerald-100/70">
            Invio rapporti di prova e verifica di accettabilità
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-[13px] font-semibold leading-tight">{name}</div>
          <div className="text-[11px] text-emerald-100/70">{company}</div>
        </div>
        <button
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-emerald-100/90 hover:bg-forest-800"
        >
          Esci
        </button>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

/** True once the image at `src` has actually loaded (avoids broken-image flashes pre-hydration). */
export function useImageAvailable(src: string): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setOk(true);
    img.src = src;
  }, [src]);
  return ok;
}
import {
  IconBook,
  IconChart,
  IconChat,
  IconCheckSquare,
  IconChevronD,
  IconClock,
  IconDoc,
  IconHistory,
  IconLeaf,
  IconPlant,
} from "./icons";

const NAV = [
  { href: "/", label: "Chat con Anna", icon: IconChat },
  { href: "/conversazioni", label: "Le mie chat", icon: IconHistory },
  { href: "/documenti", label: "I miei documenti", icon: IconDoc },
  { href: "/analisi", label: "Analisi e confronti", icon: IconChart },
  { href: "/omologhe", label: "Omologhe", icon: IconCheckSquare },
  { href: "/impianti", label: "Impianti e linee", icon: IconPlant },
  { href: "/normativa", label: "Normativa e procedure", icon: IconBook },
  { href: "/storico", label: "Storico richieste", icon: IconClock },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-[335px] shrink-0 flex-col bg-forest-900 text-white">
      {/* Logo */}
      <BrandLogo />

      {/* Anna hero: real photo if public/anna.png exists, SVG placeholder otherwise.
          Height scales with the viewport; on desktop (lg+) it stays at least 300px. */}
      <div className="relative mx-0 h-[22vh] max-h-[300px] min-h-[130px] shrink-0 overflow-hidden lg:h-[36vh] lg:max-h-[560px] lg:min-h-[300px]">
        <AnnaHero />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-forest-900 to-transparent" />
      </div>

      <div className="shrink-0 px-6 pb-2 pt-3">
        <div className="text-[19px] font-bold text-brand-bright">Ciao, sono Anna.</div>
        <div className="mt-0.5 text-[17px] font-semibold leading-snug text-white">
          Il tuo assistente tecnico per l&apos;ambiente e i rifiuti.
        </div>
        <p className="mt-2 hidden text-[12.5px] leading-relaxed text-emerald-100/60 [@media(min-height:860px)]:block">
          Puoi chiedermi informazioni tecniche, caricare documenti o analisi e verificare la
          conformità ai limiti normativi e autorizzativi.
        </p>
      </div>

      {/* Nav — takes the remaining height (~50% of the viewport on desktop) */}
      <nav className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-3 text-[13.5px] font-medium transition-colors ${
                active
                  ? "bg-forest-700 text-white shadow-inner"
                  : "text-emerald-100/70 hover:bg-forest-800 hover:text-white"
              }`}
            >
              <Icon size={17} className={active ? "text-brand-bright" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer with profile/logout menu */}
      <UserFooter />
    </aside>
  );
}

function UserFooter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const name = session?.user?.name ?? "Utente";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative border-t border-white/10" ref={ref}>
      {open && (
        <div className="absolute bottom-full left-3 right-3 z-30 mb-2 overflow-hidden rounded-xl border border-white/10 bg-forest-800 shadow-panel">
          <Link
            href="/profilo"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-[13px] font-medium text-emerald-100/90 hover:bg-forest-700 hover:text-white"
          >
            Profilo utente
          </Link>
          <button
            // redirect: false + relative navigation: Auth.js would otherwise
            // redirect to the server-inferred origin, which is localhost
            // behind Render's proxy.
            onClick={() => void signOut({ redirect: false }).then(() => window.location.assign("/login"))}
            className="block w-full border-t border-white/10 px-4 py-3 text-left text-[13px] font-medium text-red-300 hover:bg-forest-700 hover:text-red-200"
          >
            Esci
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 px-6 py-4 text-left hover:bg-forest-800 ${open ? "bg-forest-800" : ""}`}
        title="Profilo e opzioni account"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-600 text-[12px] font-bold text-white ring-1 ring-white/20">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{name}</span>
          <span className="block text-[12px] text-emerald-100/60">Valli S.p.A.</span>
        </span>
        <IconChevronD
          size={16}
          className={`text-emerald-100/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}

/** Company logo: uses public/valli-logo.png when present, falls back to the SVG wordmark. Links home. */
function BrandLogo() {
  const hasImage = useImageAvailable("/valli-logo.png");
  return (
    <Link href="/" className="block px-6 pb-4 pt-5 transition hover:opacity-90" title="Torna alla chat">
      <div>
      {hasImage ? (
        <div className="flex items-end gap-2">
          <span className="rounded-md bg-white/95 px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/valli-logo.png" alt="Valli S.p.A." className="h-7 w-auto" />
          </span>
          <span className="pb-0.5 text-[19px] font-extrabold leading-none text-brand-bright">AI</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <IconLeaf size={30} />
          <div className="text-[21px] font-extrabold tracking-wide">
            VALLI SPA <span className="text-brand-bright">AI</span>
          </div>
        </div>
      )}
        <div className="mt-1.5 text-[8.5px] font-medium uppercase tracking-[0.14em] text-emerald-200/70">
          L&apos;intelligenza al servizio dell&apos;ambiente
        </div>
      </div>
    </Link>
  );
}

/** Anna hero: uses public/anna.png when present, falls back to the stylized SVG. */
function AnnaHero() {
  const hasImage = useImageAvailable("/anna.png");
  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/anna.png" alt="Anna — AI Assistant" className="h-full w-full object-cover object-top" />
    );
  }
  return <AnnaPortrait />;
}

/** Stylized portrait placeholder (no real photo in the MVP build). */
function AnnaPortrait() {
  return (
    <svg viewBox="0 0 335 350" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1a4d30" />
          <stop offset="0.55" stopColor="#103522" />
          <stop offset="1" stopColor="#0d281a" />
        </linearGradient>
        <linearGradient id="jacket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#20603c" />
          <stop offset="1" stopColor="#123723" />
        </linearGradient>
        <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4a35" />
          <stop offset="1" stopColor="#4a3225" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#4ade80" stopOpacity="0.22" />
          <stop offset="1" stopColor="#4ade80" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="335" height="350" fill="url(#bgg)" />
      <circle cx="60" cy="70" r="95" fill="url(#glow)" />
      <circle cx="295" cy="190" r="120" fill="url(#glow)" />
      {/* soft foliage bokeh */}
      <circle cx="286" cy="60" r="26" fill="#2f7a4c" opacity="0.35" />
      <circle cx="308" cy="96" r="16" fill="#3e9c62" opacity="0.28" />
      <circle cx="42" cy="210" r="22" fill="#2f7a4c" opacity="0.3" />
      {/* hair behind */}
      <path
        d="M167 66c-44 0-64 32-64 70 0 34 6 52 4 84-1 18-5 28-5 28h130s-4-10-5-28c-2-32 4-50 4-84 0-38-20-70-64-70z"
        fill="url(#hair)"
      />
      {/* neck + face */}
      <rect x="152" y="196" width="30" height="44" rx="12" fill="#dfb896" />
      <ellipse cx="167" cy="150" rx="36" ry="44" fill="#eccaa7" />
      {/* fringe */}
      <path d="M129 142c-2-42 16-62 38-62s40 20 38 62c-4-26-12-38-18-40 2 8 1 14 1 14-8-12-26-14-40-8-8 4-13 16-19 34z" fill="url(#hair)" />
      {/* shoulders / jacket */}
      <path d="M62 350c8-72 48-104 105-104s97 32 105 104z" fill="url(#jacket)" />
      {/* collar */}
      <path d="M150 250l17 20 17-20c-5-5-11-7-17-7s-12 2-17 7z" fill="#f1f5f2" />
      <path d="M167 272v78" stroke="#0d281a" strokeOpacity="0.35" strokeWidth="3" />
      {/* chest badges, like the uniform in the reference */}
      <g transform="translate(97 288)">
        <rect width="46" height="14" rx="3" fill="#f8fafc" opacity="0.95" />
        <text x="23" y="10" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#123723">
          Anna
        </text>
        <text x="23" y="24" textAnchor="middle" fontSize="6" fill="#86efac" opacity="0.9">
          AI Assistant
        </text>
      </g>
      <g transform="translate(196 284)">
        <rect width="46" height="22" rx="3" fill="#0d281a" stroke="#4ade80" strokeOpacity="0.45" />
        <text x="23" y="9.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#ffffff">
          VALLI
        </text>
        <text x="23" y="18" textAnchor="middle" fontSize="5.5" fontWeight="600" fill="#4ade80">
          SPA AI
        </text>
      </g>
    </svg>
  );
}

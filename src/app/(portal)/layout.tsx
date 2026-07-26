import { redirect } from "next/navigation";
import { auth } from "@/auth";
import PortalHeader from "@/components/portal/PortalHeader";

// Customer portal shell (Phase 3): producer accounts only. Internal staff
// review submissions from "Portale clienti" inside the app instead.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "producer") redirect("/portale-clienti");
  return (
    <div className="flex min-h-screen flex-col bg-[#f2f5f2]">
      <PortalHeader name={session.user.name ?? ""} company={session.user.company ?? ""} />
      <main className="mx-auto w-full max-w-[860px] flex-1 px-6 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white px-6 py-3 text-center text-[11.5px] text-slate-400">
        Valli S.p.A. — Portale clienti per il conferimento rifiuti · Gli esiti sono verificati dal
        personale tecnico dell&apos;impianto.
      </footer>
    </div>
  );
}

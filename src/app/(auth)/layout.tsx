import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { IconLeaf } from "@/components/icons";

// Public shell for login/register: brand panel left, form right.
// Already-authenticated users go straight to the app.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user) redirect("/");
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[42%] flex-col justify-between bg-forest-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <IconLeaf size={30} />
          <div className="text-[21px] font-extrabold tracking-wide">
            VALLI SPA <span className="text-brand-bright">AI</span>
          </div>
        </div>
        <div>
          <div className="text-[26px] font-bold text-brand-bright">Ciao, sono Anna.</div>
          <div className="mt-1 max-w-[380px] text-[22px] font-semibold leading-snug">
            Il tuo assistente tecnico per l&apos;ambiente e i rifiuti.
          </div>
          <p className="mt-4 max-w-[400px] text-[13.5px] leading-relaxed text-emerald-100/70">
            Carica i rapporti di prova, verifica la conformità ai limiti normativi e gestisci
            l&apos;accettazione dei rifiuti sulle linee dell&apos;impianto.
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/50">
          L&apos;intelligenza al servizio dell&apos;ambiente
        </p>
      </aside>
      <main className="flex flex-1 items-center justify-center bg-[#eef2ee] p-6">
        {children}
      </main>
    </div>
  );
}

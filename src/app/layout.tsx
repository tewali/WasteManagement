import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Valli SPA AI — Chat con Anna",
  description:
    "Assistente tecnico per l'ambiente e i rifiuti: verifica di conformità delle analisi ai limiti normativi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col bg-white">{children}</div>
        </div>
      </body>
    </html>
  );
}

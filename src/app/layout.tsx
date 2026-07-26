import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valli SPA AI — Chat con Anna",
  description:
    "Assistente tecnico per l'ambiente e i rifiuti: verifica di conformità delle analisi ai limiti normativi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

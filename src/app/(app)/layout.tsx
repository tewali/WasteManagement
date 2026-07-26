import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "@/components/Sidebar";

// Authenticated shell: every page in this group requires a session.
// Producer (portale clienti) accounts never see the internal app.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "producer") redirect("/portale");
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-white">{children}</div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import PageShell from "@/components/PageShell";
import UsersClient from "@/components/UsersClient";
import { invites, inviteState, users } from "@/lib/users";

export const dynamic = "force-dynamic";

// Company user management — admins only (API routes enforce it too).
export default async function UtentiPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
  return (
    <PageShell title="Utenti e accessi" badge="Solo amministratori">
      <UsersClient
        currentUserId={session.user.id}
        users={users.list()}
        invites={invites.list().map((i) => ({ ...i, state: inviteState(i) }))}
      />
    </PageShell>
  );
}

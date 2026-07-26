import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ASSIGNABLE_ROLES } from "@/lib/user-admin";
import { invites, inviteState, users, type UserAccount } from "@/lib/users";

// Invite links (Phase 3) — admins only. The app sends no email: the admin
// copies the generated link and shares it; registering through it consumes
// the token and assigns the role fixed here.
// GET            -> all invites with their state
// POST           -> create an invite, returns the registration path
// DELETE ?token= -> revoke a pending invite

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json({
    invites: invites.list().map((i) => ({ ...i, state: inviteState(i) })),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const body = (await req.json()) as { email?: string; role?: string; company?: string };
  if (!ASSIGNABLE_ROLES.includes(body.role as UserAccount["role"])) {
    return NextResponse.json({ error: "Ruolo non valido." }, { status: 400 });
  }
  if (body.email?.trim() && users.byEmail(body.email.trim())) {
    return NextResponse.json({ error: "Esiste già un account con questa email." }, { status: 409 });
  }
  if (body.role === "producer" && !body.company?.trim()) {
    return NextResponse.json(
      { error: "Per un cliente produttore indicare la ragione sociale." },
      { status: 400 },
    );
  }
  const invite = invites.create({
    email: body.email,
    role: body.role as UserAccount["role"],
    company: body.company,
    created_by: session!.user.name ?? "Amministratore",
  });
  return NextResponse.json({
    ok: true,
    invite: { ...invite, state: "valid" },
    register_path: `/register?invite=${invite.token}`,
  });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!invites.revoke(token)) {
    return NextResponse.json({ error: "invito non trovato" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

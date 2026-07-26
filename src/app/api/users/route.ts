import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ASSIGNABLE_ROLES, canChangeRole, canRemoveUser } from "@/lib/user-admin";
import { users, type UserAccount } from "@/lib/users";

// Company user management (Phase 3) — admins only.
// GET             -> all accounts (no password hashes)
// POST            -> add a user directly with a temporary password
// PATCH {id,role} -> change a user's role
// DELETE ?id=     -> remove a user (never yourself, never the last admin)

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json({ users: users.list() });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    title?: string;
    company?: string;
  };
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  if (name.length < 2) return NextResponse.json({ error: "Inserire nome e cognome." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Indirizzo email non valido." }, { status: 400 });
  }
  if ((body.password ?? "").length < 8) {
    return NextResponse.json(
      { error: "La password temporanea deve avere almeno 8 caratteri." },
      { status: 400 },
    );
  }
  if (!ASSIGNABLE_ROLES.includes(body.role as UserAccount["role"])) {
    return NextResponse.json({ error: "Ruolo non valido." }, { status: 400 });
  }
  if (users.byEmail(email)) {
    return NextResponse.json({ error: "Esiste già un account con questa email." }, { status: 409 });
  }
  const user = users.create({
    name,
    email,
    password: body.password!,
    role: body.role as UserAccount["role"],
    title: body.title,
    company: body.company,
  });
  const { password_hash: _ph, ...safe } = user;
  return NextResponse.json({ ok: true, user: safe });
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = (await req.json()) as { id?: string; role?: string };
  if (!body.id || !body.role) {
    return NextResponse.json({ error: "id e ruolo sono obbligatori" }, { status: 400 });
  }
  const check = canChangeRole(users.list(), body.id, body.role);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });
  users.updateRole(body.id, body.role as UserAccount["role"]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const check = canRemoveUser(users.list(), session!.user.id, id);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });
  users.remove(id);
  return NextResponse.json({ ok: true });
}

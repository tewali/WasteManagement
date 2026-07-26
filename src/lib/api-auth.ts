import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Role guards for API routes (Phase 3 adds the "producer" portal role, which
// must not reach internal plant endpoints).

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "non autenticato" }, { status: 401 }) };
  }
  return { session, error: null };
}

/** Admins only — user management (inviting/adding/removing people). */
export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session!.user.role !== "admin") {
    return {
      session: null,
      error: NextResponse.json(
        { error: "operazione riservata agli amministratori" },
        { status: 403 },
      ),
    };
  }
  return { session, error: null };
}

/** Internal staff only — producer (portal) accounts get 403. */
export async function requireStaff() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session!.user.role === "producer") {
    return {
      session: null,
      error: NextResponse.json({ error: "operazione riservata al personale interno" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

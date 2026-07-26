import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/users";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    password?: string;
    title?: string;
  };
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (name.length < 2) {
    return NextResponse.json({ error: "Inserire nome e cognome." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Indirizzo email non valido." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "La password deve avere almeno 8 caratteri." },
      { status: 400 },
    );
  }
  if (users.byEmail(email)) {
    return NextResponse.json(
      { error: "Esiste già un account con questa email." },
      { status: 409 },
    );
  }
  const user = users.create({ name, email, password, title: body.title });
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
}

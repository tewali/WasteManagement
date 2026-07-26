import { NextRequest, NextResponse } from "next/server";
import { invites, inviteState, users } from "@/lib/users";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    password?: string;
    title?: string;
    account_type?: "staff" | "producer";
    company?: string;
    invite_token?: string;
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
  // Registration through an admin invite: the invite fixes role and company —
  // the form can never self-assign an elevated role.
  if (body.invite_token) {
    const invite = invites.byToken(body.invite_token);
    const state = inviteState(invite);
    if (state !== "valid") {
      const msg =
        state === "used"
          ? "Questo invito è già stato utilizzato."
          : state === "expired"
            ? "Questo invito è scaduto: richiederne uno nuovo all'amministratore."
            : "Invito non valido.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (invite!.email && invite!.email !== email.toLowerCase()) {
      return NextResponse.json(
        { error: `Questo invito è riservato all'indirizzo ${invite!.email}.` },
        { status: 400 },
      );
    }
    const user = users.create({
      name,
      email,
      password,
      title: body.title,
      role: invite!.role,
      company: invite!.company ?? undefined,
    });
    invites.markUsed(invite!.token, user.email);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }

  const producer = body.account_type === "producer";
  if (producer && !body.company?.trim()) {
    return NextResponse.json(
      { error: "Indicare la ragione sociale dell'azienda produttrice." },
      { status: 400 },
    );
  }
  const user = users.create({
    name,
    email,
    password,
    title: body.title,
    role: producer ? "producer" : undefined,
    company: body.company,
  });
  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

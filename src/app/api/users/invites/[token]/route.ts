import { NextRequest, NextResponse } from "next/server";
import { roleLabel } from "@/lib/user-admin";
import { invites, inviteState } from "@/lib/users";

// Public: the register page reads an invite's state to prefill and lock the
// form. Only non-sensitive fields are exposed.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const invite = invites.byToken(token);
  const state = inviteState(invite);
  if (state !== "valid") return NextResponse.json({ state }, { status: 404 });
  return NextResponse.json({
    state,
    email: invite!.email,
    role: invite!.role,
    role_label: roleLabel(invite!.role),
    company: invite!.company,
  });
}

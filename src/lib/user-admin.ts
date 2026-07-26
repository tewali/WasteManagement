// Rules for admin user management (Phase 3). Pure functions so the
// last-admin protections are unit-tested independently of the API layer.

import type { UserAccount } from "./users";

type UserLike = Pick<UserAccount, "id" | "role">;

export const ASSIGNABLE_ROLES: UserAccount["role"][] = [
  "admin",
  "operator",
  "acceptance",
  "producer",
];

const ROLE_LABELS: Record<UserAccount["role"], string> = {
  admin: "Amministratore",
  operator: "Operatore",
  acceptance: "Accettazione",
  producer: "Cliente produttore",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserAccount["role"]] ?? role;
}

function admins(users: UserLike[]): UserLike[] {
  return users.filter((u) => u.role === "admin");
}

/** Whether `actorId` may remove `targetId`. */
export function canRemoveUser(
  users: UserLike[],
  actorId: string,
  targetId: string,
): { ok: boolean; reason?: string } {
  const target = users.find((u) => u.id === targetId);
  if (!target) return { ok: false, reason: "utente non trovato" };
  if (targetId === actorId) {
    return { ok: false, reason: "non è possibile rimuovere il proprio account" };
  }
  if (target.role === "admin" && admins(users).length <= 1) {
    return { ok: false, reason: "l'azienda deve avere almeno un amministratore" };
  }
  return { ok: true };
}

/** Whether `targetId` may be moved to `newRole`. */
export function canChangeRole(
  users: UserLike[],
  targetId: string,
  newRole: string,
): { ok: boolean; reason?: string } {
  const target = users.find((u) => u.id === targetId);
  if (!target) return { ok: false, reason: "utente non trovato" };
  if (!ASSIGNABLE_ROLES.includes(newRole as UserAccount["role"])) {
    return { ok: false, reason: "ruolo non valido" };
  }
  if (target.role === newRole) return { ok: true };
  if (target.role === "admin" && admins(users).length <= 1) {
    return { ok: false, reason: "l'azienda deve avere almeno un amministratore" };
  }
  return { ok: true };
}

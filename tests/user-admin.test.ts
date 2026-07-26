// Admin user management rules (Phase 3): self-removal and last-admin
// protections, invite lifecycle states.
import { describe, expect, it } from "vitest";
import { canChangeRole, canRemoveUser } from "@/lib/user-admin";
import { inviteState, type InviteRecord } from "@/lib/users";

const USERS = [
  { id: "a1", role: "admin" as const },
  { id: "o1", role: "operator" as const },
  { id: "p1", role: "producer" as const },
];

describe("canRemoveUser", () => {
  it("allows removing a non-admin", () => {
    expect(canRemoveUser(USERS, "a1", "o1").ok).toBe(true);
    expect(canRemoveUser(USERS, "a1", "p1").ok).toBe(true);
  });
  it("never allows removing yourself", () => {
    const res = canRemoveUser(USERS, "a1", "a1");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("proprio account");
  });
  it("never allows removing the last admin", () => {
    const res = canRemoveUser(USERS, "o1", "a1");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("almeno un amministratore");
  });
  it("allows removing an admin when another remains", () => {
    const users = [...USERS, { id: "a2", role: "admin" as const }];
    expect(canRemoveUser(users, "a2", "a1").ok).toBe(true);
  });
});

describe("canChangeRole", () => {
  it("allows promoting an operator to admin", () => {
    expect(canChangeRole(USERS, "o1", "admin").ok).toBe(true);
  });
  it("never allows demoting the last admin", () => {
    const res = canChangeRole(USERS, "a1", "operator");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("almeno un amministratore");
  });
  it("allows demoting an admin when another remains", () => {
    const users = [...USERS, { id: "a2", role: "admin" as const }];
    expect(canChangeRole(users, "a1", "operator").ok).toBe(true);
  });
  it("rejects unknown roles and unknown users", () => {
    expect(canChangeRole(USERS, "o1", "superuser").ok).toBe(false);
    expect(canChangeRole(USERS, "ghost", "admin").ok).toBe(false);
  });
});

describe("inviteState", () => {
  const base: InviteRecord = {
    token: "t",
    email: null,
    role: "operator",
    company: null,
    created_by: "Admin",
    created_at: "2026-07-01T00:00:00.000Z",
    expires_at: "2026-07-15T00:00:00.000Z",
    used_at: null,
    used_by_email: null,
  };
  const NOW = new Date("2026-07-10T00:00:00Z");
  it("is valid before expiry and unused", () => {
    expect(inviteState(base, NOW)).toBe("valid");
  });
  it("is used once consumed, even if not expired", () => {
    expect(inviteState({ ...base, used_at: "2026-07-05T00:00:00.000Z" }, NOW)).toBe("used");
  });
  it("expires after expires_at", () => {
    expect(inviteState(base, new Date("2026-07-16T00:00:00Z"))).toBe("expired");
  });
  it("handles missing invites", () => {
    expect(inviteState(null, NOW)).toBe("not_found");
  });
});

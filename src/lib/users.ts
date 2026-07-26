// User accounts for the MVP: stored in the JSON file store with
// scrypt-hashed passwords (moves to Postgres + Auth.js adapter in Phase 2).
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password_hash: string; // "<salt-hex>:<hash-hex>"
  role: "admin" | "operator" | "acceptance" | "producer";
  title: string;
  /** Producer accounts (portale clienti): the company they submit for. */
  company?: string;
  created_at: string;
}

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Demo accounts created on first run so the app is usable out of the box.
export const DEMO_EMAIL = "a.parolini@vallispa.example";
export const DEMO_PASSWORD = "valli-demo";
// Demo customer for the portale clienti (Phase 3).
export const DEMO_PRODUCER_EMAIL = "m.rossi@bianchicostruzioni.example";
export const DEMO_PRODUCER_PASSWORD = "cliente-demo";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const candidate = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(candidate, Buffer.from(hashHex, "hex"));
}

let cache: UserAccount[] | null = null;

function load(): UserAccount[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")) as UserAccount[];
  } catch {
    cache = [];
  }
  if (cache.length === 0) {
    cache = [
      {
        id: "usr_demo_aurora",
        name: "Aurora Parolini",
        email: DEMO_EMAIL,
        password_hash: hashPassword(DEMO_PASSWORD),
        role: "admin",
        title: "Responsabile Tecnico Impianto",
        created_at: new Date().toISOString(),
      },
    ];
    save();
  }
  // The demo producer is added even to an existing store (deploys created
  // before Phase 3 already have a users.json without it).
  if (!cache.some((u) => u.email === DEMO_PRODUCER_EMAIL)) {
    cache.push({
      id: "usr_demo_producer",
      name: "Marco Rossi",
      email: DEMO_PRODUCER_EMAIL,
      password_hash: hashPassword(DEMO_PRODUCER_PASSWORD),
      role: "producer",
      title: "Cliente produttore",
      company: "Costruzioni Bianchi S.r.l.",
      created_at: new Date().toISOString(),
    });
    save();
  }
  return cache;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(cache, null, 2));
}

export const users = {
  byEmail(email: string): UserAccount | null {
    return load().find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  },
  byId(id: string): UserAccount | null {
    return load().find((u) => u.id === id) ?? null;
  },
  create(input: {
    name: string;
    email: string;
    password: string;
    title?: string;
    role?: UserAccount["role"];
    company?: string;
  }): UserAccount {
    const list = load();
    // Callers gate which roles are allowed: the public register API only ever
    // passes "producer" or nothing; the admin API may pass any role.
    const role = input.role ?? "operator";
    const user: UserAccount = {
      id: `usr_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password_hash: hashPassword(input.password),
      role,
      title: input.title?.trim() || (role === "producer" ? "Cliente produttore" : "Operatore"),
      ...(role === "producer" ? { company: input.company?.trim() || input.name.trim() } : {}),
      created_at: new Date().toISOString(),
    };
    list.push(user);
    save();
    return user;
  },
  list(): Omit<UserAccount, "password_hash">[] {
    return load().map(({ password_hash: _ph, ...u }) => u);
  },
  remove(id: string): boolean {
    const list = load();
    const i = list.findIndex((u) => u.id === id);
    if (i < 0) return false;
    list.splice(i, 1);
    save();
    return true;
  },
  updateRole(id: string, role: UserAccount["role"]): boolean {
    const u = load().find((x) => x.id === id);
    if (!u) return false;
    u.role = role;
    save();
    return true;
  },
};

// ---- invites (Phase 3: admin-managed onboarding) --------------------------
//
// An invite is a one-time registration link. No email is sent from the app:
// the admin copies the link and shares it; registering through it consumes
// the token and assigns the role (and company, for producers) fixed by the
// admin — the public form can never self-assign elevated roles.

export interface InviteRecord {
  token: string;
  /** If set, registration through this invite must use this email. */
  email: string | null;
  role: UserAccount["role"];
  company: string | null;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by_email: string | null;
}

export const INVITE_VALIDITY_DAYS = 14;

const INVITES_FILE = path.join(DATA_DIR, "invites.json");

let invitesCache: InviteRecord[] | null = null;

function loadInvites(): InviteRecord[] {
  if (invitesCache) return invitesCache;
  try {
    invitesCache = JSON.parse(fs.readFileSync(INVITES_FILE, "utf-8")) as InviteRecord[];
  } catch {
    invitesCache = [];
  }
  return invitesCache;
}

function saveInvites() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INVITES_FILE, JSON.stringify(invitesCache, null, 2));
}

export type InviteState = "valid" | "used" | "expired" | "not_found";

export function inviteState(invite: InviteRecord | null | undefined, now = new Date()): InviteState {
  if (!invite) return "not_found";
  if (invite.used_at) return "used";
  if (now.toISOString() > invite.expires_at) return "expired";
  return "valid";
}

export const invites = {
  list(): InviteRecord[] {
    return loadInvites();
  },
  byToken(token: string): InviteRecord | null {
    return loadInvites().find((i) => i.token === token) ?? null;
  },
  create(input: {
    email?: string | null;
    role: UserAccount["role"];
    company?: string | null;
    created_by: string;
  }): InviteRecord {
    const now = new Date();
    const invite: InviteRecord = {
      token: randomBytes(16).toString("hex"),
      email: input.email?.trim().toLowerCase() || null,
      role: input.role,
      company: input.company?.trim() || null,
      created_by: input.created_by,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + INVITE_VALIDITY_DAYS * 86400_000).toISOString(),
      used_at: null,
      used_by_email: null,
    };
    loadInvites().unshift(invite);
    saveInvites();
    return invite;
  },
  markUsed(token: string, email: string) {
    const invite = loadInvites().find((i) => i.token === token);
    if (!invite) return;
    invite.used_at = new Date().toISOString();
    invite.used_by_email = email.toLowerCase();
    saveInvites();
  },
  revoke(token: string): boolean {
    const list = loadInvites();
    const i = list.findIndex((x) => x.token === token);
    if (i < 0) return false;
    list.splice(i, 1);
    saveInvites();
    return true;
  },
};

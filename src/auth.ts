import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { users, verifyPassword } from "@/lib/users";

// Auth.js v5 with a credentials provider (email + password against the local
// user store). JWT sessions — no database adapter needed for the MVP.
// Phase 2 adds OIDC/SSO providers here (see docs/PROPOSAL.md §4).
export const { handlers, auth, signIn, signOut } = NextAuth({
  // AUTH_SECRET must be set in production (render.yaml generates one);
  // the fallback keeps local dev friction-free.
  secret: process.env.AUTH_SECRET ?? "valli-dev-secret-not-for-production",
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credenziali",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        const user = users.byEmail(email);
        if (!user || !verifyPassword(password, user.password_hash)) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role, title: user.title };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.title = (user as { title?: string }).title;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as string) ?? "operator";
        session.user.title = (token.title as string) ?? "";
      }
      return session;
    },
  },
});

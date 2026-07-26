import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      title: string;
    };
  }
  interface User {
    role?: string;
    title?: string;
  }
}

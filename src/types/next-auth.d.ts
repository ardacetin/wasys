import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      organizationId: string;
      plan: string;
      organizationName: string;
    };
  }

  interface User {
    role?: string;
    organizationId?: string;
    plan?: string;
    organizationName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    organizationId?: string;
    plan?: string;
    organizationName?: string;
  }
}

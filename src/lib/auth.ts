import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * Hostinger runs `next start -H 0.0.0.0`. Without AUTH_URL, Auth.js redirects to
 * http://0.0.0.0:3000/... — force the public site URL in production.
 */
function resolveAuthUrl() {
  const fromEnv = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").trim();
  if (fromEnv && !fromEnv.includes("0.0.0.0") && !fromEnv.includes("127.0.0.1")) {
    return fromEnv.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    return "https://wasys.pro";
  }
  return "http://localhost:3000";
}

const authUrl = resolveAuthUrl();
process.env.AUTH_URL = authUrl;
process.env.NEXTAUTH_URL = authUrl;
process.env.AUTH_TRUST_HOST = "true";

// Hostinger: prefer process env; Next also auto-loads `.env` / `.env.production` from app root
const authSecret =
  process.env.AUTH_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  undefined;

if (!authSecret) {
  console.error(
    "[WASYS Auth] MissingSecret — create `.env` in Hostinger nodejs/ folder. See HOSTINGER.md",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/giris",
    error: "/giris",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        if (!authSecret) {
          console.error("[WASYS Auth] authorize blocked: AUTH_SECRET missing");
          return null;
        }

        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        try {
          const user = await prisma.user.findUnique({
            where: { email: parsed.data.email.toLowerCase() },
            include: { organization: true },
          });
          if (!user) return null;

          const valid = await compare(parsed.data.password, user.passwordHash);
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            plan: user.organization.plan,
            organizationName: user.organization.name,
          };
        } catch (err) {
          console.error("[WASYS Auth] authorize DB error", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role?: string }).role;
        token.organizationId = (user as { organizationId?: string }).organizationId;
        token.plan = (user as { plan?: string }).plan;
        token.organizationName = (user as { organizationName?: string }).organizationName;
      } else if (token.organizationId) {
        try {
          const org = await prisma.organization.findUnique({
            where: { id: token.organizationId as string },
            select: { plan: true, name: true },
          });
          if (org) {
            token.plan = org.plan;
            token.organizationName = org.name;
          }
        } catch (err) {
          console.error("[WASYS Auth] jwt org lookup failed", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as string;
        session.user.plan = token.plan as string;
        session.user.organizationName = token.organizationName as string;
      }
      return session;
    },
  },
});

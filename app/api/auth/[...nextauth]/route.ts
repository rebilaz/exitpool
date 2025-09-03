/**
 * NextAuth + Google OAuth
 * - Prisma génère User.id (cuid)
 * - On expose dans la session :
 *    - user.id  = id Prisma (clé pour tes relations : transactions, etc.)
 *    - user.sub = Google sub (id externe stable si besoin, ex. BigQuery)
 */

import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Laisse l'adapter créer l'utilisateur (User.id = cuid())
      // On n’impose PAS profile.id ici.
    }),
  ],

  callbacks: {
    /**
     * Au 1er login, NextAuth fournit `user` et `account`.
     * - `user.id`  = id Prisma (cuid) -> on le met dans token.pid
     * - `account.providerAccountId` = Google sub -> dans token.sub
     */
    async jwt({ token, user, account }) {
      if (user) {
        token.pid = (user as any).id; // id Prisma
        if (account?.provider === "google" && account.providerAccountId) {
          token.sub = account.providerAccountId; // Google sub
        } else if (!token.sub) {
          // fallback: récupérer le sub depuis Account si besoin
          const acc = await prisma.account.findFirst({
            where: { userId: (user as any).id, provider: "google" },
            select: { providerAccountId: true },
          });
          token.sub = acc?.providerAccountId ?? token.sub;
        }
      }
      return token;
    },

    /**
     * On expose dans la session :
     *  - session.user.id  = id Prisma (pour toutes tes relations)
     *  - session.user.sub = Google sub (interop externe)
     */
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.pid as string | undefined;
        (session.user as any).sub = token.sub as string | undefined;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

/**
 * NextAuth + Google OAuth + Credentials "wallet" (EVM & Solana)
 * - Conserve tes callbacks existants (user.id exposé dans la session)
 */

import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

// Vérification de signatures
import { verifyMessage } from "viem";
import nacl from "tweetnacl";
import bs58 from "bs58";
import jwt from "jsonwebtoken";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // Google (existant)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // Wallet (EVM + Solana) via Credentials
    CredentialsProvider({
      id: "wallet",
      name: "Wallet",
      credentials: {
        chainType: { label: "chainType", type: "text" }, // 'evm' | 'solana'
        address:   { label: "address",   type: "text" },
        chainId:   { label: "chainId",   type: "number" },
        message:   { label: "message",   type: "text" },
        signature: { label: "signature", type: "text" },
        nonce:     { label: "nonce",     type: "text" },
        nonceToken:{ label: "nonceToken",type: "text" },
      },
      async authorize(creds) {
        if (!creds) return null;

        // 1) Vérifier le nonce signé (anti-replay)
        try {
          const dec = jwt.verify(String(creds.nonceToken), process.env.NEXTAUTH_SECRET!) as any;
          if (dec?.n !== String(creds.nonce)) return null;
        } catch {
          return null;
        }

        // 2) Vérifier la signature du message
        const chainType = String(creds.chainType || "").toLowerCase();
        const address = String(creds.address || "");
        const message = String(creds.message || "");
        const signature = String(creds.signature || "");

        let verified = false;
        if (chainType === "evm") {
          try {
            verified = await verifyMessage({
              address: address as `0x${string}`,
              message,
              signature: signature as `0x${string}`,
            });
          } catch {
            verified = false;
          }
        } else if (chainType === "solana") {
          try {
            const pubkey = bs58.decode(address);
            const sig = bs58.decode(signature);
            const msg = new TextEncoder().encode(message);
            verified = nacl.sign.detached.verify(msg, sig, pubkey);
          } catch {
            verified = false;
          }
        }
        if (!verified) return null;

        // 3) Upsert Wallet → User (création User minimal si nécessaire)
        const chainIdNum =
          chainType === "evm" && creds.chainId != null
            ? Number(creds.chainId) || null
            : null;

        const wallet = await prisma.wallet.upsert({
          where: { address },
          update: { chainId: chainIdNum },
          create: {
            address,
            type: chainType === "evm" ? "EVM" : "SOLANA",
            chainId: chainIdNum,
            user: { create: {} },
          },
          include: { user: true },
        });

        // NextAuth attend un "user-like"
        return {
          id: wallet.user.id,                    // <- ID Prisma (clé primaire)
          name: wallet.user.name ?? null,
          email: wallet.user.email ?? null,
          image: wallet.user.image ?? null,
        };
      },
    }),
  ],

  callbacks: {
    // Conserve ta logique existante: exposer user.id (pid) et google sub si dispo
    async jwt({ token, user, account }) {
      if (user) {
        token.pid = (user as any).id;
        if (account?.provider === "google" && account.providerAccountId) {
          token.sub = account.providerAccountId;
        } else if (!token.sub) {
          const acc = await prisma.account.findFirst({
            where: { userId: (user as any).id, provider: "google" },
            select: { providerAccountId: true },
          });
          token.sub = acc?.providerAccountId ?? token.sub;
        }
      }
      return token;
    },
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

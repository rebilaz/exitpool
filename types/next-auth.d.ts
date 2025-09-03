import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;        // <- id Prisma (cuid)
      sub?: string;      // <- Google sub (facultatif)
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

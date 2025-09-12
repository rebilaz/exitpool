// app/api/health/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const ok = (v: any) => typeof v === "string" && v.length > 0;

  return NextResponse.json({
    ok: true,
    env: {
      OPENAI_API_KEY: ok(process.env.OPENAI_API_KEY),
      // --- Twitter avec tes noms d'env ---
      X_API_KEY: ok(process.env.X_API_KEY),
      X_API_KEY_SECRET: ok(process.env.X_API_KEY_SECRET),
      ACCESS_TOKEN: ok(process.env.ACCESS_TOKEN),
      ACCESS_TOKEN_SECRET: ok(process.env.ACCESS_TOKEN_SECRET),
      // optionnel : BEARER_TOKEN (pas nécessaire pour publier)
      BEARER_TOKEN: ok(process.env.BEARER_TOKEN),
      CRON_SECRET: ok(process.env.CRON_SECRET),
    },
  });
}

// app/api/health/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const present = (v: any) => typeof v === "string" && v.length > 0;

  return NextResponse.json({
    ok: true,
    env: {
      OPENAI_API_KEY: present(process.env.OPENAI_API_KEY),
      TWITTER_APP_KEY: present(process.env.TWITTER_APP_KEY),
      TWITTER_APP_SECRET: present(process.env.TWITTER_APP_SECRET),
      TWITTER_ACCESS_TOKEN: present(process.env.TWITTER_ACCESS_TOKEN),
      TWITTER_ACCESS_SECRET: present(process.env.TWITTER_ACCESS_SECRET),
      CRON_SECRET: present(process.env.CRON_SECRET),
    }
  });
}

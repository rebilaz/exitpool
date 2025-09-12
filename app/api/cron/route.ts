// app/api/cron/route.ts
import { NextRequest } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // 1) Vérif du secret
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2) Construire le message (MVP)
  const slot = url.searchParams.get("slot") ?? "any";
  const text = `CryptoPilot: auto-post (${slot}) ✈️`;

  // 3) Poster sur X
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_KEY_SECRET!,
    accessToken: process.env.ACCESS_TOKEN!,
    accessSecret: process.env.ACCESS_TOKEN_SECRET!,
  });

  try {
    const tw = await client.v2.tweet(text);
    return Response.json({
      ok: true,
      text,
      tweet: `https://x.com/i/web/status/${tw.data.id}`,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

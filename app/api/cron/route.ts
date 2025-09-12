// app/api/cron/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  buildTweetPlan,
  buildThreadPlan,
  buildImagePlan,
  realizeSingleTweet,
  realizeThread,
  generateImageBuffer,
} from "@/lib/utils/ai";
import { postTweet, postThread, postImageTweet } from "@/lib/utils/twitter";
import { ensureUnique } from "@/lib/utils/unique";

const TZ_OFFSET = 0;
const SIMPLE_SLOTS = [10, 13, 16, 19];
const THREAD_SLOT = 21;
const IMAGE_SLOT = 14;

function nowWithOffset(offset: number) {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + offset);
  return d;
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isAuthorized(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("health") === "1") return true;

  const fromVercelCron = !!req.headers.get("x-vercel-cron");
  if (fromVercelCron) return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const dry = url.searchParams.get("dry") === "1";
    const health = url.searchParams.get("health") === "1";

    // --- /api/cron?health=1 : check des env avec TES noms ---
    if (health) {
      const ok = (v: any) => typeof v === "string" && v.length > 0;
      return NextResponse.json({
        ok: true,
        env: {
          OPENAI_API_KEY: ok(process.env.OPENAI_API_KEY),
          X_API_KEY: ok(process.env.X_API_KEY),
          X_API_KEY_SECRET: ok(process.env.X_API_KEY_SECRET),
          ACCESS_TOKEN: ok(process.env.ACCESS_TOKEN),
          ACCESS_TOKEN_SECRET: ok(process.env.ACCESS_TOKEN_SECRET),
          BEARER_TOKEN: ok(process.env.BEARER_TOKEN),
          CRON_SECRET: ok(process.env.CRON_SECRET),
        },
      });
    }

    // (optionnel) fail-fast si credentials manquants (sauf en dry-run)
    const missingTwitter =
      !process.env.X_API_KEY ||
      !process.env.X_API_KEY_SECRET ||
      !process.env.ACCESS_TOKEN ||
      !process.env.ACCESS_TOKEN_SECRET;

    if (missingTwitter && !dry) {
      return NextResponse.json(
        { ok: false, error: "Twitter credentials missing (X_API_KEY/SECRET, ACCESS_TOKEN/SECRET)" },
        { status: 503 }
      );
    }

    const now = nowWithOffset(TZ_OFFSET);
    const hour = now.getUTCHours();
    const dateKey = ymd(now);

    // ----- Tweet simple -----
    if (SIMPLE_SLOTS.includes(hour)) {
      const slotKey = `${dateKey}::tweet-${hour}`;
      const plan = await buildTweetPlan(slotKey);
      const text = await realizeSingleTweet(plan);

      if (!text) return NextResponse.json({ ok: true, type: "tweet", hour, skipped: true, reason: "no text", plan });
      if (!ensureUnique(text)) return NextResponse.json({ ok: true, type: "tweet", hour, skipped: true, reason: "duplicate" });
      if (dry) return NextResponse.json({ ok: true, type: "tweet", hour, dry: true, preview: text, plan });

      const id = await postTweet(text);
      return NextResponse.json({ ok: true, type: "tweet", hour, id, text });
    }

    // ----- Thread -----
    if (hour === THREAD_SLOT) {
      const slotKey = `${dateKey}::thread-${hour}`;
      const plan = await buildThreadPlan(slotKey);
      const tweets = await realizeThread(plan);
      const filtered = tweets.filter((t) => t && ensureUnique(t));

      if (filtered.length < 4) {
        return NextResponse.json({ ok: true, type: "thread", hour, skipped: true, reason: "too few tweets", preview: filtered, plan });
      }
      if (dry) return NextResponse.json({ ok: true, type: "thread", hour, dry: true, preview: filtered, plan });

      const id = await postThread(filtered);
      return NextResponse.json({ ok: true, type: "thread", hour, id, count: filtered.length });
    }

    // ----- Image -----
    if (hour === IMAGE_SLOT) {
      const slotKey = `${dateKey}::image-${hour}`;
      const plan = await buildImagePlan(slotKey);
      const caption = plan.caption as string | undefined;
      const imagePrompt = plan.image_prompt as string | undefined;

      if (!caption || !imagePrompt) {
        return NextResponse.json({ ok: true, type: "image", hour, skipped: true, reason: "plan incomplete", plan });
      }
      if (!ensureUnique(caption)) {
        return NextResponse.json({ ok: true, type: "image", hour, skipped: true, reason: "duplicate caption" });
      }
      if (dry) {
        return NextResponse.json({ ok: true, type: "image", hour, dry: true, preview: { caption, imagePrompt }, plan });
      }

      const buf = await generateImageBuffer(imagePrompt);
      const id = await postImageTweet(caption, buf);
      return NextResponse.json({ ok: true, type: "image", hour, id, caption });
    }

    return NextResponse.json({ ok: true, hour, message: "Aucune action prévue cette heure." });
  } catch (err: any) {
    console.error("Cron error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

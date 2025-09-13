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
import {
  postTweet,
  postThread,
  postImageTweet,
  checkXWrite,
} from "@/lib/utils/twitter";
import { sanitizeTweet } from "@/lib/utils/sanitize";
import { ensureUnique } from "@/lib/utils/unique";
import { log, maskEnvSummary } from "@/lib/utils/logger";

const TZ_OFFSET = 0; // UTC offset (e.g. -3 for Buenos Aires if you prefer local reasoning)
const SIMPLE_SLOTS = [10, 13, 16, 19]; // UTC simple tweets
const THREAD_SLOT = 21; // UTC
const IMAGE_SLOT = 14; // UTC

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

  // bypass for diagnostics
  if (url.searchParams.get("health") === "1") return true;
  if (url.searchParams.get("check") === "x") return true;
  if (url.searchParams.get("diag") === "x") return true;

  // vercel cron header
  const fromVercelCron = !!req.headers.get("x-vercel-cron");
  if (fromVercelCron) return true;

  // optional bearer
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

    // /api/cron?health=1
    if (health) {
      return NextResponse.json({ ok: true, env: maskEnvSummary() });
    }

    // /api/cron?check=x
    if (url.searchParams.get("check") === "x") {
      try {
        const me = await checkXWrite();
        return NextResponse.json({ ok: true, x: me });
      } catch (e: any) {
        log("X check failed", {
          status: e?.status,
          code: e?.code,
          data: e?.data,
          errors: e?.data?.errors,
          message: e?.message,
        });
        return NextResponse.json(
          { ok: false, x_error: e?.data || e?.message },
          { status: 500 }
        );
      }
    }

    // /api/cron?diag=x[&write=1]
    if (url.searchParams.get("diag") === "x") {
      const info: Record<string, any> = { env: maskEnvSummary() };

      try {
        const me = await checkXWrite();
        info.account = me;
      } catch (e: any) {
        info.account_error = {
          status: e?.status,
          code: e?.code,
          message: e?.message,
          data: e?.data,
        };
      }

      const attemptWrite = url.searchParams.get("write") === "1" && !dry;
      if (attemptWrite) {
        try {
          const id = await postTweet(`diag ${Date.now()} #cryptopilot`);
          info.write_ok = { id };
        } catch (e: any) {
          info.write_error = {
            status: e?.status,
            code: e?.code,
            message: e?.message,
            data: e?.data,
            errors: e?.data?.errors,
          };
        }
      }

      log("X DIAG", info);
      return NextResponse.json({
        ok: true,
        diag: info,
        wrote: attemptWrite || false,
      });
    }

    // clock
    const now = nowWithOffset(TZ_OFFSET);
    const hour = now.getUTCHours();
    const dateKey = ymd(now);

    // ========== FORCE MODE ==========
    // /api/cron?force=tweet|thread|image[&dry=1][&tweak=1][&text=...][&fallback=caption]
    const force = url.searchParams.get("force");

    if (force === "tweet") {
      const slotKey = `${dateKey}::tweet-forced`;
      const plan = await buildTweetPlan(slotKey);
      let text = url.searchParams.get("text") || (await realizeSingleTweet(plan));
      if (text) text = sanitizeTweet(text);

      if (!text) {
        return NextResponse.json({
          ok: true,
          type: "tweet",
          forced: true,
          skipped: true,
          reason: "no text",
          plan,
        });
      }
      if (!ensureUnique(text)) {
        return NextResponse.json({
          ok: true,
          type: "tweet",
          forced: true,
          skipped: true,
          reason: "duplicate (ensureUnique)",
          preview: text,
        });
      }

      const tweak = url.searchParams.get("tweak") === "1";
      if (tweak) {
        text = `${text} - ${Math.random().toString(36).slice(2, 6)}`;
      }

      if (dry) {
        return NextResponse.json({
          ok: true,
          type: "tweet",
          forced: true,
          dry: true,
          preview: text,
          plan,
        });
      }

      try {
        const id = await postTweet(text);
        return NextResponse.json({
          ok: true,
          type: "tweet",
          forced: true,
          id,
          text,
        });
      } catch (e: any) {
        return NextResponse.json(
          {
            ok: false,
            type: "tweet",
            forced: true,
            message: e?.message,
            status: e?.status,
            code: e?.code,
            data: e?.data,
            errors: e?.data?.errors,
          },
          { status: 500 }
        );
      }
    }

    if (force === "thread") {
      const slotKey = `${dateKey}::thread-forced`;
      const plan = await buildThreadPlan(slotKey);
      let tweets = await realizeThread(plan);

      // sanitize each tweet and drop empties
      tweets = tweets.map((t) => (t ? sanitizeTweet(t) : "")).filter(Boolean);

      const tweak = url.searchParams.get("tweak") === "1";
      if (tweak) {
        tweets = tweets.map((t) => `${t} - ${Math.random().toString(36).slice(2, 6)}`);
      }

      const filtered = tweets.filter((t) => t && ensureUnique(t));

      if (filtered.length < 4) {
        return NextResponse.json({
          ok: true,
          type: "thread",
          forced: true,
          skipped: true,
          reason: "too few tweets",
          preview: filtered,
          plan,
        });
      }
      if (dry) {
        return NextResponse.json({
          ok: true,
          type: "thread",
          forced: true,
          dry: true,
          preview: filtered,
          plan,
        });
      }

      try {
        const id = await postThread(filtered);
        return NextResponse.json({
          ok: true,
          type: "thread",
          forced: true,
          id,
          count: filtered.length,
        });
      } catch (e: any) {
        return NextResponse.json(
          {
            ok: false,
            type: "thread",
            forced: true,
            message: e?.message,
            status: e?.status,
            code: e?.code,
            data: e?.data,
            errors: e?.data?.errors,
            context: e?.context, // exposes failedIndex and posted if available
          },
          { status: 500 }
        );
      }
    }

    if (force === "image") {
      const slotKey = `${dateKey}::image-forced`;
      const plan = await buildImagePlan(slotKey);
      const caption = plan.caption as string | undefined;
      const imagePrompt = plan.image_prompt as string | undefined;

      if (!caption || !imagePrompt) {
        return NextResponse.json({
          ok: true,
          type: "image",
          forced: true,
          skipped: true,
          reason: "plan incomplete",
          plan,
        });
      }
      if (!ensureUnique(caption)) {
        return NextResponse.json({
          ok: true,
          type: "image",
          forced: true,
          skipped: true,
          reason: "duplicate caption",
        });
      }
      if (dry) {
        return NextResponse.json({
          ok: true,
          type: "image",
          forced: true,
          dry: true,
          preview: { caption, imagePrompt },
          plan,
        });
      }

      try {
        const buf = await generateImageBuffer(imagePrompt);
        const id = await postImageTweet(caption, buf);
        return NextResponse.json({ ok: true, type: "image", forced: true, id, caption });
      } catch (e: any) {
        if (e?.message === "IMAGE_MODEL_UNAVAILABLE") {
          const wantFallback =
            url.searchParams.get("fallback") === "caption" ||
            process.env.IMAGE_FALLBACK === "caption";
          if (wantFallback) {
            const id = await postTweet(caption);
            return NextResponse.json({
              ok: true,
              type: "image",
              forced: true,
              fallback: "caption->tweet",
              id,
              caption,
              detail: (e as any)?.reason,
            });
          }
          return NextResponse.json({
            ok: true,
            type: "image",
            forced: true,
            skipped: true,
            reason: "image model unavailable",
            detail: (e as any)?.reason,
          });
        }
        return NextResponse.json(
          {
            ok: false,
            type: "image",
            forced: true,
            message: e?.message,
            status: e?.status,
            code: e?.code,
            data: e?.data,
            errors: e?.data?.errors,
          },
          { status: 500 }
        );
      }
    }
    // ========== /FORCE MODE ==========

    // fail fast when missing Twitter credentials (except in dry run)
    const missingTwitter =
      !process.env.X_API_KEY ||
      !process.env.X_API_KEY_SECRET ||
      !process.env.ACCESS_TOKEN ||
      !process.env.ACCESS_TOKEN_SECRET;

    if (missingTwitter && !dry) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Twitter credentials missing (X_API_KEY/SECRET, ACCESS_TOKEN/SECRET)",
        },
        { status: 503 }
      );
    }

    // slots
    if (SIMPLE_SLOTS.includes(hour)) {
      const slotKey = `${dateKey}::tweet-${hour}`;
      const plan = await buildTweetPlan(slotKey);
      const textRaw = await realizeSingleTweet(plan);
      const text = textRaw ? sanitizeTweet(textRaw) : undefined;

      if (!text) {
        return NextResponse.json({
          ok: true,
          type: "tweet",
          hour,
          skipped: true,
          reason: "no text",
          plan,
        });
      }
      if (!ensureUnique(text)) {
        return NextResponse.json({
          ok: true,
          type: "tweet",
          hour,
          skipped: true,
          reason: "duplicate",
        });
      }
      if (dry) {
        return NextResponse.json({
          ok: true,
          type: "tweet",
          hour,
          dry: true,
          preview: text,
          plan,
        });
      }

      const id = await postTweet(text);
      return NextResponse.json({ ok: true, type: "tweet", hour, id, text });
    }

    if (hour === THREAD_SLOT) {
      const slotKey = `${dateKey}::thread-${hour}`;
      const plan = await buildThreadPlan(slotKey);
      let tweets = await realizeThread(plan);
      tweets = tweets.map((t) => (t ? sanitizeTweet(t) : "")).filter(Boolean);

      const filtered = tweets.filter((t) => t && ensureUnique(t));

      if (filtered.length < 4) {
        return NextResponse.json({
          ok: true,
          type: "thread",
          hour,
          skipped: true,
          reason: "too few tweets",
          preview: filtered,
          plan,
        });
      }
      if (dry) {
        return NextResponse.json({
          ok: true,
          type: "thread",
          hour,
          dry: true,
          preview: filtered,
          plan,
        });
      }

      const id = await postThread(filtered);
      return NextResponse.json({
        ok: true,
        type: "thread",
        hour,
        id,
        count: filtered.length,
      });
    }

    if (hour === IMAGE_SLOT) {
      const slotKey = `${dateKey}::image-${hour}`;
      const plan = await buildImagePlan(slotKey);
      const caption = plan.caption as string | undefined;
      const imagePrompt = plan.image_prompt as string | undefined;

      if (!caption || !imagePrompt) {
        return NextResponse.json({
          ok: true,
          type: "image",
          hour,
          skipped: true,
          reason: "plan incomplete",
          plan,
        });
      }
      if (!ensureUnique(caption)) {
        return NextResponse.json({
          ok: true,
          type: "image",
          hour,
          skipped: true,
          reason: "duplicate caption",
        });
      }
      if (dry) {
        return NextResponse.json({
          ok: true,
          type: "image",
          hour,
          dry: true,
          preview: { caption, imagePrompt },
          plan,
        });
      }

      try {
        const buf = await generateImageBuffer(imagePrompt);
        const id = await postImageTweet(caption, buf);
        return NextResponse.json({ ok: true, type: "image", hour, id, caption });
      } catch (e: any) {
        if (e?.message === "IMAGE_MODEL_UNAVAILABLE") {
          const wantFallback =
            url.searchParams.get("fallback") === "caption" ||
            process.env.IMAGE_FALLBACK === "caption";
          if (wantFallback) {
            const id = await postTweet(caption);
            return NextResponse.json({
              ok: true,
              type: "image",
              hour,
              fallback: "caption->tweet",
              id,
              caption,
              detail: (e as any)?.reason,
            });
          }
          return NextResponse.json({
            ok: true,
            type: "image",
            hour,
            skipped: true,
            reason: "image model unavailable",
            detail: (e as any)?.reason,
          });
        }
        return NextResponse.json(
          {
            ok: false,
            type: "image",
            hour,
            message: e?.message,
            status: e?.status,
            code: e?.code,
            data: e?.data,
            errors: e?.data?.errors,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      hour,
      message: "No scheduled action at this hour.",
    });
  } catch (err: any) {
    log("Cron error", { msg: err?.message, status: err?.status, data: err?.data });

    const hostHint =
      err?.host || (err?.message?.includes("twitter") ? "api.x.com" : undefined);

    if (err?.status === 401 || err?.status === 403 || hostHint === "api.x.com") {
      return NextResponse.json(
        {
          ok: false,
          hint:
            "Twitter/X: check Read+Write, regenerate Access Token/Secret, and ensure Vercel uses the new secrets. See [TWITTER] logs for details.",
          details: err?.data || err?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

// app/api/cron/route.ts
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

const TZ_OFFSET = 0; // UTC; pour Buenos Aires mets -3

// 4 tweets simples
const SIMPLE_SLOTS = [10, 13, 16, 19];
// 1 thread
const THREAD_SLOT = 21;
// 1 image
const IMAGE_SLOT = 14;

function nowWithOffset(offset: number) {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + offset);
  return d;
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const now = nowWithOffset(TZ_OFFSET);
  const hour = now.getUTCHours();
  const dateKey = ymd(now);

  // ----- Tweet simple -----
  if (SIMPLE_SLOTS.includes(hour)) {
    const idx = SIMPLE_SLOTS.indexOf(hour);
    const slotKey = `${dateKey}::tweet-${hour}`;
    const plan = await buildTweetPlan(slotKey);
    const text = await realizeSingleTweet(plan);
    if (text && ensureUnique(text)) {
      const id = await postTweet(text);
      return NextResponse.json({ ok: true, type: "tweet", hour, id, text });
    }
    return NextResponse.json({ ok: true, type: "tweet", hour, skipped: true });
  }

  // ----- Thread -----
  if (hour === THREAD_SLOT) {
    const slotKey = `${dateKey}::thread-${hour}`;
    const plan = await buildThreadPlan(slotKey);
    const tweets = await realizeThread(plan);
    const filtered = tweets.filter((t) => t && ensureUnique(t));
    if (filtered.length >= 4) {
      const id = await postThread(filtered);
      return NextResponse.json({ ok: true, type: "thread", hour, id, count: filtered.length });
    }
    return NextResponse.json({ ok: true, type: "thread", hour, skipped: true });
  }

  // ----- Image -----
  if (hour === IMAGE_SLOT) {
    const slotKey = `${dateKey}::image-${hour}`;
    const plan = await buildImagePlan(slotKey);
    const caption = plan.caption as string | undefined;
    const imagePrompt = plan.image_prompt as string | undefined;

    if (caption && imagePrompt && ensureUnique(caption)) {
      const buf = await generateImageBuffer(imagePrompt);
      const id = await postImageTweet(caption, buf);
      return NextResponse.json({ ok: true, type: "image", hour, id, caption });
    }
    return NextResponse.json({ ok: true, type: "image", hour, skipped: true });
  }

  return NextResponse.json({ ok: true, hour, message: "Aucune action prévue cette heure." });
}

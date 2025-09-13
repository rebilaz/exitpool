// lib/utils/twitter.ts
import { TwitterApi } from "twitter-api-v2";
import { log, tail } from "./logger";

async function safeCall<T>(p: Promise<T>, ctx: Record<string, any>) {
  try {
    return await p;
  } catch (e: any) {
    log("TWITTER", {
      ctx,
      status: e?.status,
      code: e?.code,
      message: e?.message,
      data: e?.data,
      errors: e?.data?.errors,
      rateLimit: e?.rateLimit,
    });
    throw e;
  }
}

function getClient() {
  const appKey = process.env.X_API_KEY!;
  const appSecret = process.env.X_API_KEY_SECRET!;
  const accessToken = process.env.ACCESS_TOKEN!;
  const accessSecret = process.env.ACCESS_TOKEN_SECRET!;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("Twitter credentials missing (X_API_KEY/SECRET, ACCESS_TOKEN/SECRET).");
  }

  // helpful to confirm Vercel uses updated tokens
  log("TWITTER:ENV", {
    appKey_tail: tail(appKey),
    appSecret_tail: tail(appSecret),
    accessToken_tail: tail(accessToken),
    accessSecret_tail: tail(accessSecret),
  });

  return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
}

export async function checkXWrite() {
  const client = getClient();
  const me = await safeCall(client.v2.me(), { op: "v2.me" });
  return { id: me.data.id, username: me.data.username };
}

export async function postTweet(text: string) {
  const client = getClient();
  try {
    const r = await safeCall(client.v2.tweet({ text }), { op: "tweet" });
    return r.data.id;
  } catch (e: any) {
    const first = e?.data?.errors?.[0];
    const msg = (first?.message || e?.message || "").toLowerCase();
    const isDuplicate = first?.code === 187 || msg.includes("duplicate");
    if (isDuplicate && process.env.TWEAK_ON_DUPLICATE === "1") {
      const tweaked = `${text} - ${Math.random().toString(36).slice(2, 6)}`;
      const r2 = await safeCall(client.v2.tweet({ text: tweaked }), { op: "tweet_tweaked" });
      return r2.data.id;
    }
    throw e;
  }
}

export async function postThread(tweets: string[]) {
  const client = getClient();

  let firstId: string | undefined;
  let replyTo: string | undefined;
  const posted: Array<{ i: number; id: string; tweaked?: boolean }> = [];

  for (let i = 0; i < tweets.length; i++) {
    const text = tweets[i];
    try {
      const r = await safeCall(
        client.v2.tweet({
          text,
          reply: replyTo ? { in_reply_to_tweet_id: replyTo } : undefined,
        }),
        { op: "thread_item", idx: i, len: text.length }
      );
      const id = r.data.id;
      if (!firstId) firstId = id;
      replyTo = id;
      posted.push({ i, id });
    } catch (e: any) {
      const first = e?.data?.errors?.[0];
      const msg = (first?.message || e?.message || "").toLowerCase();
      const isDuplicate = first?.code === 187 || msg.includes("duplicate");

      if (isDuplicate && process.env.TWEAK_ON_DUPLICATE === "1") {
        const tweaked = `${text} - ${Math.random().toString(36).slice(2, 6)}`;
        const r2 = await safeCall(
          client.v2.tweet({
            text: tweaked,
            reply: replyTo ? { in_reply_to_tweet_id: replyTo } : undefined,
          }),
          { op: "thread_item_tweaked", idx: i }
        );
        const id2 = r2.data.id;
        if (!firstId) firstId = id2;
        replyTo = id2;
        posted.push({ i, id: id2, tweaked: true });
        continue;
      }

      (e as any).context = { failedIndex: i, posted };
      throw e;
    }
  }
  return firstId!;
}

export async function postImageTweet(caption: string, imageBuffer: Buffer) {
  const client = getClient();
  const mediaId = await safeCall(
    client.v1.uploadMedia(imageBuffer, { type: "png" }),
    { op: "uploadMedia", type: "png" }
  );
  const r = await safeCall(
    client.v2.tweet({ text: caption, media: { media_ids: [mediaId] } }),
    { op: "tweetWithMedia" }
  );
  return r.data.id;
}

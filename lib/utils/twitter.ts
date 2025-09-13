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
      rateLimit: e?.rateLimit, // parfois présent
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

  // utile pour vérifier que Vercel charge bien les NOUVEAUX jetons
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
  const r = await safeCall(client.v2.tweet({ text }), { op: "tweet" });
  return r.data.id;
}

export async function postThread(tweets: string[]) {
  const client = getClient();
  const r = await safeCall(
    client.v2.tweetThread(tweets.map((t) => ({ text: t }))),
    { op: "thread", count: tweets.length }
  );
  return r[0].data?.id;
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

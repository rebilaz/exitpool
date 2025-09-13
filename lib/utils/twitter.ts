// lib/utils/twitter.ts
import { TwitterApi } from "twitter-api-v2";

/**
 * Wrapper générique pour mieux logger les erreurs Twitter (403, rate limits, duplicate, etc.)
 */
async function safeCall<T>(p: Promise<T>, ctx: Record<string, any>) {
  try {
    return await p;
  } catch (e: any) {
    // twitter-api-v2 expose souvent status/code + data.errors
    console.error("[TWITTER]", {
      ctx,
      status: e?.status,
      code: e?.code,
      message: e?.message,
      data: e?.data,
      errors: e?.data?.errors,
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
    throw new Error(
      "Twitter credentials missing (X_API_KEY/SECRET, ACCESS_TOKEN/SECRET)."
    );
  }

  // OAuth1a user-context (nécessaire pour publier)
  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });
}

/**
 * Sanity-check simple pour valider l'auth côté X.
 * Si ceci échoue (403), c'est quasi sûr que l’app n’a pas les droits Write
 * ou que le token n’a pas été régénéré après passage en Read+Write.
 */
export async function checkXWrite() {
  const client = getClient();
  const me = await safeCall(client.v2.me(), { op: "me" });
  return { id: me.data.id, username: me.data.username };
}

// --- publier un tweet texte ---
export async function postTweet(text: string) {
  const client = getClient();
  const r = await safeCall(client.v2.tweet({ text }), { op: "tweet" });
  return r.data.id;
}

// --- publier un thread (liste de tweets) ---
export async function postThread(tweets: string[]) {
  const client = getClient();
  const r = await safeCall(
    client.v2.tweetThread(tweets.map((t) => ({ text: t }))),
    { op: "thread", count: tweets.length }
  );
  // id du premier tweet
  return r[0].data?.id;
}

// --- publier une image (buffer) avec légende ---
export async function postImageTweet(caption: string, imageBuffer: Buffer) {
  const client = getClient();
  // upload media v1.1
  const mediaId = await safeCall(
    client.v1.uploadMedia(imageBuffer, { type: "png" }), // "image/png" marche aussi
    { op: "uploadMedia", type: "png" }
  );
  const r = await safeCall(
    client.v2.tweet({ text: caption, media: { media_ids: [mediaId] } }),
    { op: "tweetWithMedia" }
  );
  return r.data.id;
}

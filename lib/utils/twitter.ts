// lib/utils/twitter.ts
import { TwitterApi } from "twitter-api-v2";

function getClient() {
  const appKey = process.env.X_API_KEY!;
  const appSecret = process.env.X_API_KEY_SECRET!;
  const accessToken = process.env.ACCESS_TOKEN!;
  const accessSecret = process.env.ACCESS_TOKEN_SECRET!;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("Twitter credentials missing (X_API_KEY/SECRET, ACCESS_TOKEN/SECRET).");
  }

  // client user-context (nécessaire pour publier)
  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });
}

// --- publier un tweet texte ---
export async function postTweet(text: string) {
  const client = getClient();
  const r = await client.v2.tweet({ text });
  return r.data.id;
}

// --- publier un thread (liste de tweets) ---
export async function postThread(tweets: string[]) {
  const client = getClient();
  const r = await client.v2.tweetThread(tweets.map((t) => ({ text: t })));
  // retourne l'id du premier tweet du thread
  return r[0].data?.id;
}

// --- publier une image (buffer) avec légende ---
export async function postImageTweet(caption: string, imageBuffer: Buffer) {
  const client = getClient();
  // upload media en v1
  const mediaId = await client.v1.uploadMedia(imageBuffer, { type: "png" }); // ou "image/png"
  const r = await client.v2.tweet({
    text: caption,
    media: { media_ids: [mediaId] },
  });
  return r.data.id;
}

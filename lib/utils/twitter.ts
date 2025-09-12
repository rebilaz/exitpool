// lib/utils/twitter.ts
import { TwitterApi } from "twitter-api-v2";

export function twitterClient() {
  return new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY!,
    appSecret: process.env.TWITTER_APP_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });
}

export async function postTweet(text: string) {
  const client = twitterClient();
  const r = await client.v2.tweet({ text });
  return r.data.id;
}

export async function postThread(tweets: string[]) {
  const client = twitterClient();
  if (!tweets.length) throw new Error("Thread vide");
  const first = await client.v2.tweet({ text: tweets[0] });
  let lastId = first.data.id;
  for (let i = 1; i < tweets.length; i++) {
    const res = await client.v2.tweet({
      text: tweets[i],
      reply: { in_reply_to_tweet_id: lastId },
    });
    lastId = res.data.id;
  }
  return first.data.id;
}

export async function postImageTweet(text: string, pngBuffer: Buffer) {
  const client = twitterClient();
  const mediaId = await client.v1.uploadMedia(pngBuffer, { type: "png" });
  const r = await client.v2.tweet({ text, media: { media_ids: [mediaId] } });
  return r.data.id;
}

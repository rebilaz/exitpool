// lib/utils/ai.ts
import OpenAI from "openai";
import crypto from "crypto";
import {
  TWEET_PROMPT_SYSTEM,
  THREAD_PROMPT_SYSTEM,
  IMAGE_PROMPT_SYSTEM,
} from "./prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
// Allow override if a model isn't enabled
const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

export function makeSeed(slotKey: string) {
  const salt = process.env.RANDOM_SALT || "cryptopilot-salt";
  return parseInt(
    crypto.createHash("sha1").update(`${slotKey}:${salt}`).digest("hex").slice(0, 8),
    16
  );
}

// ---------- PASS 1: planners (return JSON plans) ----------
export async function buildTweetPlan(slotKey: string) {
  const seed = makeSeed(slotKey);
  const r = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.8,
    top_p: 0.9,
    messages: [
      { role: "system", content: TWEET_PROMPT_SYSTEM },
      { role: "user", content: `SEED=${seed}\nConstraint: 0–1 allowed hashtag.` },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(r.choices[0]?.message?.content ?? "{}");
}

export async function buildThreadPlan(slotKey: string) {
  const seed = makeSeed(slotKey);
  const r = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.8,
    top_p: 0.9,
    messages: [
      { role: "system", content: THREAD_PROMPT_SYSTEM },
      { role: "user", content: `SEED=${seed}\nConstraint: 4–5 concrete points.` },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(r.choices[0]?.message?.content ?? "{}");
}

export async function buildImagePlan(slotKey: string) {
  const seed = makeSeed(slotKey);
  const r = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.9,
    top_p: 0.9,
    messages: [
      { role: "system", content: IMAGE_PROMPT_SYSTEM },
      { role: "user", content: `SEED=${seed}\nConstraint: EN caption <=220c, 0 hashtag.` },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(r.choices[0]?.message?.content ?? "{}");
}

// ---------- PASS 2: realizations ----------
export async function realizeSingleTweet(plan: any) {
  const sys = `
You are "CryptoPilot Writer".
Write an EN tweet (<=280c), neutral, practical, educational.
No hype/promo/superlatives, no profit claims, no links, no emojis.
0–1 hashtag max, only if useful: #AI / #Crypto / #OnChain.
Assemble: <hook> <observation> <tip> <hashtag?>. Non-marketing tone.

Return JSON: { "tweet": string }`;
  const usr = `Plan JSON: ${JSON.stringify(plan)}`;
  const r = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.6,
    top_p: 0.9,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr },
    ],
    response_format: { type: "json_object" },
  });
  const out = JSON.parse(r.choices[0]?.message?.content ?? "{}");
  return out.tweet as string | undefined;
}

export async function realizeThread(plan: any) {
  const sys = `
You are "CryptoPilot Writer".
Write an EN thread of 4–5 tweets (<=280c each), numbered "1/5", "2/5"...
Tone: neutral and educational. 0–1 hashtag total (#AI/#Crypto/#OnChain).
No hype/promo/links.

Return JSON: { "tweets": string[] }`;
  const usr = `Plan JSON: ${JSON.stringify(plan)}`;
  const r = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.6,
    top_p: 0.9,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr },
    ],
    response_format: { type: "json_object" },
  });
  const out = JSON.parse(r.choices[0]?.message?.content ?? "{}");
  return (out.tweets as string[] | undefined) ?? [];
}

// ---------- Image buffer (gpt-image-1) ----------
export async function generateImageBuffer(imagePrompt: string) {
  const img = await openai.images.generate({
    model: "gpt-image-1",
    prompt: imagePrompt,
    size: "1024x1024",
    quality: "high",
  });
  const url = img.data?.[0]?.url;
  if (!img.data || !url) throw new Error("Image URL missing");
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

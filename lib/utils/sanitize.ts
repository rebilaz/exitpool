// lib/utils/sanitize.ts

/**
 * sanitizeTweet: normalize and de-risk an English tweet before posting.
 * - trims + collapses spaces
 * - strips common emoji (optional range)
 * - keeps at most one hashtag from the whitelist (#AI, #Crypto, #OnChain)
 * - removes hype/marketing phrases
 * - soft-caps length at ~275 chars
 */
const BANNED = [
  /revolutionizes?/i,
  /disrupts?/i,
  /game\s*changer/i,
  /advanced\s+algorithms?/i,
  /incredible/i,
  /opportunit(y|ies)/i,
  /to\s+the\s+moon/i,
  /\b100x\b/i,
  /get\s+rich\s+quick/i,
  /\bNFA\b/i,
  /\bDYOR\b/i,
];

const WHITELIST = new Set(["#AI", "#Crypto", "#OnChain"]);

export function sanitizeTweet(input: string): string {
  let t = (input || "").replace(/\s+/g, " ").trim();

  // remove emojis (can be relaxed if needed)
  t = t.replace(
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF])/g,
    ""
  );

  // keep at most one whitelisted hashtag, append at the end
  const all = Array.from(t.matchAll(/#\w+/g)).map((m) => m[0]);
  const keep = all.find((h) => WHITELIST.has(h)) || "";
  t = t.replace(/#\w+/g, "").trim();
  if (keep) t = `${t} ${keep}`.trim();

  // remove banned phrases
  for (const rx of BANNED) t = t.replace(rx, "").trim();

  if (t.length > 275) t = t.slice(0, 275).trim();
  return t.replace(/\s{2,}/g, " ");
}

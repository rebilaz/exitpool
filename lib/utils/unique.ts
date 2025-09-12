// lib/utils/unique.ts
import crypto from "crypto";

const seen = new Set<string>();

export function hashText(s: string) {
  return crypto.createHash("sha1").update(s.trim().toLowerCase()).digest("hex");
}

/** Retourne true si c'est nouveau; false si déjà vu (mémoire process). */
export function ensureUnique(s: string) {
  const h = hashText(s);
  if (seen.has(h)) return false;
  seen.add(h);
  return true;
}

// lib/utils/hash.ts
import { createHash } from "crypto";

/**
 * Stringify déterministe (tri des clés) pour un hash stable.
 */
function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Calcule un SHA-256 hex d'une valeur (objet/string) de façon déterministe.
 */
export function sha256Hex(value: unknown): string {
  const s = typeof value === "string" ? value : stableStringify(value);
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Construit un client_tx_id idempotent pour une transaction.
 * Concatène/normalise les champs principaux puis hash (SHA-256).
 */
export function buildClientTxId(input: {
  userId: string;
  symbol: string;
  quantity: number;
  price?: number | null;
  side: "BUY" | "SELL" | "TRANSFER";
  timestamp: string | Date;
  note?: string | null;
}): string {
  const payload = {
    u: String(input.userId).trim(),
    s: String(input.symbol).toUpperCase().trim(),
    q: Number(input.quantity),
    p: input.price != null ? Number(input.price) : null,
    sd: input.side,
    t: new Date(input.timestamp).toISOString(), // ISO stable
    n: input.note ? String(input.note).trim() : "",
  };
  return sha256Hex(payload);
}

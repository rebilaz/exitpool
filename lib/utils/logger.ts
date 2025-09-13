// lib/utils/logger.ts
export function tail(str?: string, n = 4) {
  if (!str) return "(nil)";
  return str.length <= n ? str : "…" + str.slice(-n);
}

export function maskEnvSummary() {
  const e = process.env;
  return {
    X_API_KEY_tail: tail(e.X_API_KEY),
    X_API_KEY_SECRET_tail: tail(e.X_API_KEY_SECRET),
    ACCESS_TOKEN_tail: tail(e.ACCESS_TOKEN),
    ACCESS_TOKEN_SECRET_tail: tail(e.ACCESS_TOKEN_SECRET),
    BEARER_TOKEN_present: !!e.BEARER_TOKEN,
  };
}

export function log(label: string, payload: any) {
  try {
    // Vercel agrège mieux les objets que les strings longues
    console.error(`[${label}]`, payload);
  } catch {
    console.error(`[${label}]`, String(payload));
  }
}

import getBigQuery from "../db/bqClient";
import config from "../config";

/**
 * Résolution automatique d'un symbole texte vers la "meilleure" entrée,
 * sans rien demander à l'utilisateur.
 *
 * Pour l'instant, on retourne le SYMBOL en UPPERCASE (clé canonique de ton système).
 * On exploite la table tokens pour vérifier/ordonner (rank).
 */
export type ResolveInput = {
  symbol: string;           // "btc", "BTC", etc.
  // infos optionnelles si tu les as dans l'import :
  pairQuoteSymbol?: string; // "USDT" p.ex.
  priceObserved?: number;   // prix dans le fichier (si dispo)
  date?: Date;              // date du trade (si dispo)
};

export type ResolveOutput = {
  symbol: string;           // canonique UPPER
  method: "exact" | "rank" | "fallback";
  confidence: "high" | "mid" | "low";
};

export async function resolveSymbol(input: ResolveInput): Promise<ResolveOutput> {
  const sym = String(input.symbol).trim().toUpperCase();
  if (!sym) {
    return { symbol: sym, method: "fallback", confidence: "low" };
  }

  // 1) candidats par symbol exact (case-insensitive)
  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT id, symbol, name, rank
      FROM \`${config.projectId}.Cryptopilot.tokens\`
      WHERE LOWER(symbol) = LOWER(@symbol)
      ORDER BY IFNULL(rank, 999999) ASC
      LIMIT 5
    `,
    params: { symbol: sym },
  });
  const typed = (rows as any[]).map(r => ({
    id: r.id,
    symbol: r.symbol,
    name: r.name,
    rank: r.rank
  }));

  // s'il n'y a rien en BQ, on retourne le symbol uppercase (ton système est symbol-centric)
  if (!typed?.length) {
    return { symbol: sym, method: "fallback", confidence: "mid" };
  }

  // 2) Pour l'instant, on choisit le meilleur rank.
  // (Si tu veux raffiner plus tard avec comparaison au prix de paire @ date, on pluggera pairs_daily ici.)
  const best = typed[0];
  const method: ResolveOutput["method"] = typed.length === 1 ? "exact" : "rank";
  const confidence: ResolveOutput["confidence"] = typed.length === 1 ? "high" : "mid";

  return { symbol: String(best.symbol).toUpperCase(), method, confidence };
}

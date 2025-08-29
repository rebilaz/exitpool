import getBigQuery from '../db/bqClient';
import config from '../config';
import { TokenRow } from '../types';
import logger from '../logger';

export interface TokenSuggestion {
  symbol: string;
  name?: string;
  defillama_id: string;
  rank?: number;
}

/** Batch fetch DeFiLlama ids for provided symbols (uppercase) */
export async function getDefiLlamaIdsBySymbols(symbols: string[]): Promise<Record<string, string>> {
  if (!symbols.length) return {};
  const norm = Array.from(new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean)));
  if (!norm.length) return {};

  const bq = getBigQuery();
  const query = `
WITH ranked_matches AS (
  SELECT 
    UPPER(symbol) AS symbol, 
    id AS defillama_id,
    -- Priorité: correspondance exacte > longueur courte > rank bas
    ROW_NUMBER() OVER (
      PARTITION BY UPPER(symbol) 
      ORDER BY 
        CASE WHEN UPPER(symbol) = UPPER(TRIM(symbol)) THEN 1 ELSE 2 END,
        LENGTH(symbol) ASC,
        rank ASC NULLS LAST,
        id ASC
    ) as rn
  FROM \`${config.projectId}.${config.bq.dataset}.${config.bq.table}\`
  WHERE UPPER(symbol) IN UNNEST(@symbols)
    AND symbol IS NOT NULL 
    AND TRIM(symbol) != ''
    AND id IS NOT NULL
    AND TRIM(id) != ''
)
SELECT symbol, defillama_id 
FROM ranked_matches 
WHERE rn = 1`;

  const params = { symbols: norm };
  logger.info('BQ token map query', { count: norm.length, query: 'ranked_exact_match' });
  const [job] = await bq.createQueryJob({ query, params });
  const [rows] = await job.getQueryResults();
  const map: Record<string, string> = {};
  for (const r of rows as TokenRow[]) {
    if (r.symbol && r.defillama_id) {
      map[r.symbol.toUpperCase()] = r.defillama_id;
    }
  }
  logger.info('BQ mapping result', { found: Object.keys(map).length, mappings: map });
  return map;
}

/** Search tokens for autocomplete suggestions */
export async function searchTokenSuggestions(query: string, limit: number = 10): Promise<TokenSuggestion[]> {
  if (!query || query.length < 2) return [];
  
  const bq = getBigQuery();
  const searchQuery = `
WITH ranked_suggestions AS (
  SELECT 
    UPPER(symbol) AS symbol,
    name,
    id AS defillama_id,
    rank,
    -- Scoring pour pertinence de la recherche
    CASE 
      WHEN UPPER(symbol) = UPPER(@query) THEN 1          -- Correspondance exacte symbole
      WHEN UPPER(symbol) LIKE UPPER(CONCAT(@query, '%')) THEN 2  -- Commence par
      WHEN UPPER(name) LIKE UPPER(CONCAT(@query, '%')) THEN 3    -- Nom commence par
      WHEN UPPER(symbol) LIKE UPPER(CONCAT('%', @query, '%')) THEN 4  -- Contient symbole
      WHEN UPPER(name) LIKE UPPER(CONCAT('%', @query, '%')) THEN 5    -- Contient nom
      ELSE 6
    END as relevance_score,
    -- Rang unique par symbole (meilleur rank)
    ROW_NUMBER() OVER (
      PARTITION BY UPPER(symbol) 
      ORDER BY 
        rank ASC NULLS LAST,
        LENGTH(symbol) ASC,
        id ASC
    ) as symbol_rank
  FROM \`${config.projectId}.${config.bq.dataset}.${config.bq.table}\`
  WHERE (
      UPPER(symbol) LIKE UPPER(CONCAT('%', @query, '%'))
      OR UPPER(COALESCE(name, '')) LIKE UPPER(CONCAT('%', @query, '%'))
    )
    AND symbol IS NOT NULL 
    AND TRIM(symbol) != ''
    AND id IS NOT NULL
    AND TRIM(id) != ''
)
SELECT symbol, name, defillama_id, rank
FROM ranked_suggestions 
WHERE symbol_rank = 1  -- Un seul résultat par symbole
ORDER BY 
  relevance_score ASC,  -- Meilleure pertinence d'abord
  rank ASC NULLS LAST,  -- Puis par popularité (rank)
  symbol ASC           -- Puis alphabétique
LIMIT @limit`;

  const params = { query: query.trim(), limit };
  logger.info('BQ token suggestions query', { query: query.trim(), limit });
  
  const [job] = await bq.createQueryJob({ query: searchQuery, params });
  const [rows] = await job.getQueryResults();
  
  const suggestions: TokenSuggestion[] = rows.map((row: any) => ({
    symbol: row.symbol,
    name: row.name || undefined,
    defillama_id: row.defillama_id,
    rank: row.rank || undefined
  }));
  
  logger.info('BQ suggestions result', { found: suggestions.length, query: query.trim() });
  return suggestions;
}

export default { 
  getDefiLlamaIdsBySymbols,
  searchTokenSuggestions 
};

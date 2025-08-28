import getBigQuery from '../db/bqClient';
import config from '../config';
import { TokenRow } from '../types';
import logger from '../logger';

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

export default { getDefiLlamaIdsBySymbols };

// scripts/fillChainsBatch.ts
import 'dotenv/config';
import getBigQuery from '../lib/db/bqClient';
import config from '../lib/config';
import logger from '../lib/logger';

type PlatformsMap = Record<string, string>;
type CgItem = { id: string; symbol: string; name: string; platforms?: PlatformsMap };

const PREFER = [
  'ethereum',
  'base',
  'binance-smart-chain',
  'polygon-pos',
  'arbitrum-one',
  'optimistic-ethereum',
  'solana',
  'avalanche',
];

function pickBest(platforms?: PlatformsMap): { chain: string | null; contract: string | null } {
  if (!platforms) return { chain: null, contract: null };
  for (const c of PREFER) {
    const a = platforms[c];
    if (a && a.trim()) return { chain: c, contract: a };
  }
  for (const [c, a] of Object.entries(platforms)) {
    if (a && a.trim()) return { chain: c, contract: a };
  }
  return { chain: null, contract: null };
}

async function fetchCgSnapshot(): Promise<Map<string, PlatformsMap>> {
  const url = 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko snapshot failed: ${res.status} ${res.statusText}`);
  }
  const all: CgItem[] = await res.json();

  const map = new Map<string, PlatformsMap>();
  for (const c of all) {
    const k = (c.id || '').trim().toLowerCase();
    if (!k) continue;
    if (c.platforms && Object.keys(c.platforms).length) {
      map.set(k, c.platforms);
    } else {
      // garder une entrée vide pour signaler "natif" plus tard
      map.set(k, {});
    }
  }
  logger.info('CG snapshot loaded', { total: all.length, indexed: map.size });
  return map;
}

async function selectTodo(limit = 200000) {
  const bq = getBigQuery();
  const table = `\`${config.projectId}.${config.bq.dataset}.${config.bq.table}\``;
  const q = `
    SELECT id, symbol, name
    FROM ${table}
    WHERE
      (chain IS NULL OR TRIM(chain) = '')
      OR (contract_address IS NULL OR TRIM(contract_address) = '' OR LOWER(TRIM(contract_address)) IN ('natif','native','n/a','na'))
    LIMIT @limit
  `;
  const [job] = await bq.createQueryJob({
    query: q,
    params: { limit },
    location: config.bq.location,
  });
  const [rows] = await job.getQueryResults();
  return rows as { id: string; symbol: string | null; name: string | null }[];
}

async function mergeUpdates(
  updates: { id: string; chain: string | null; contract_address: string }[]
) {
  if (!updates.length) return;
  const bq = getBigQuery();
  const table = `\`${config.projectId}.${config.bq.dataset}.${config.bq.table}\``;

  const query = `
    MERGE ${table} T
    USING UNNEST(@rows) S
    ON T.id = S.id
    WHEN MATCHED THEN UPDATE SET
      T.chain = S.chain,
      T.contract_address = S.contract_address,
      T.updated_at = CURRENT_TIMESTAMP()
  `;
  const [job] = await bq.createQueryJob({
    query,
    params: { rows: updates },
    location: config.bq.location,
  });
  await job.getQueryResults();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function run() {
  // 1) Un seul appel : snapshot complet
  const cgMap = await fetchCgSnapshot();

  // 2) Tokens à compléter
  const todo = await selectTodo();
  logger.info('Candidates to fill', { count: todo.length });

  // 3) Préparer les updates
  const updates: { id: string; chain: string | null; contract_address: string }[] = [];

  for (const t of todo) {
    const key = (t.id || '').trim().toLowerCase();
    if (!key) continue;

    const platforms = cgMap.get(key);
    if (platforms === undefined) {
      // id introuvable dans CG → on ne touche pas (évite faux positifs)
      // logger.warn(`CG id not found in snapshot`, { id: t.id });
      continue;
    }

    const best = pickBest(platforms);

    if (best.contract) {
      updates.push({
        id: t.id,
        chain: best.chain,
        contract_address: best.contract,
      });
    } else {
      // pas d'adresse => token "natif"
      updates.push({
        id: t.id,
        chain: key,               // ex: "bitcoin", "ethereum", "solana"
        contract_address: 'natif' // pour ne pas le re-scanner
      });
    }
  }

  logger.info('Prepared updates', { count: updates.length });

  // 4) MERGE en batches pour éviter les limites de paramètres
  for (const part of chunk(updates, 3000)) {
    await mergeUpdates(part);
    logger.info('Batch merged', { batchSize: part.length });
  }

  logger.info('fillChainsBatch: DONE', { totalUpdated: updates.length });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

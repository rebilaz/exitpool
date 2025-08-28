import config from '../config';
import logger from '../logger';
import type { PriceProvider } from './priceProvider';

interface LlamaResponse { coins: Record<string, { price: number }> }

interface CacheEntry { ts: number; data: Record<string, number> }

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

function makeKey(ids: string[]) { return ids.slice().sort().join(','); }

async function fetchWithTimeout(url: string, ms: number, rid?: string): Promise<Response> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, next: { revalidate: 0 } });
  } finally {
    clearTimeout(to);
  }
}

class DefiLlamaProvider implements PriceProvider {
  async getCurrentPrices(defillamaIds: string[], rid?: string): Promise<Record<string, number>> {
    const log = logger.withRid(rid);
    if (!defillamaIds.length) return {};
    const unique = Array.from(new Set(defillamaIds.filter(Boolean)));
    const key = makeKey(unique);
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.ts < CACHE_TTL_MS) {
      log.info('defillama cache HIT', { ids: unique.length });
      return hit.data;
    }
    log.info('defillama cache MISS', { ids: unique.length, idsList: unique });
    // Préfixe coingecko: pour les IDs standard 
    const llamaIds = unique.map(id => {
      // Si l'ID ressemble à une adresse Ethereum (0x...), on le garde tel quel
      if (id.startsWith('0x')) {
        return `ethereum:${id}`;
      }
      // Sinon, on préfixe avec coingecko:
      return `coingecko:${id}`;
    });
    const url = `${config.defillamaBase}/prices/current/${llamaIds.join(',')}`;
    log.info('defillama request', { url, idsCount: llamaIds.length, originalIds: unique, llamaIds });
    let json: LlamaResponse | null = null;
    try {
      const res = await fetchWithTimeout(url, 5000, rid);
      log.info('defillama response', { status: res.status, ok: res.ok });
      if (!res.ok) throw new Error(`DeFiLlama HTTP ${res.status}`);
      json = (await res.json()) as LlamaResponse;
      log.info('defillama json received', { hasCoins: !!json?.coins, coinsCount: Object.keys(json?.coins || {}).length });
    } catch (e) {
      log.error('defillama fetch error', { error: (e as Error).message, url });
      throw e;
    }
    const out: Record<string, number> = {};
    if (json?.coins) {
      log.info('defillama parsing coins', { available: Object.keys(json.coins) });
      for (const [llamaId, entry] of Object.entries(json.coins)) {
        if (entry && typeof entry.price === 'number') {
          // Reconvertir l'ID DeFiLlama vers l'ID original
          let originalId = llamaId;
          if (llamaId.startsWith('coingecko:')) {
            originalId = llamaId.replace('coingecko:', '');
          } else if (llamaId.startsWith('ethereum:')) {
            originalId = llamaId.replace('ethereum:', '');
          }
          out[originalId] = entry.price;
          log.info('defillama price found', { llamaId, originalId, price: entry.price });
        } else {
          log.warn('defillama invalid entry', { llamaId, entry });
        }
      }
    } else {
      log.warn('defillama no coins in response', { json });
    }
    log.info('defillama final result', { inputIds: unique.length, outputPrices: Object.keys(out).length, prices: out });
    cache.set(key, { ts: now, data: out });
    return out;
  }
}

export const defiLlamaProvider = new DefiLlamaProvider();
export default defiLlamaProvider;

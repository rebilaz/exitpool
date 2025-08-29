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

  /**
   * Récupérer les prix historiques pour une date donnée
   */
  async getHistoricalPrices(defillamaIds: string[], date: Date, rid?: string): Promise<Record<string, number>> {
    const log = logger.withRid(rid);
    if (!defillamaIds.length) return {};
    
    const unique = Array.from(new Set(defillamaIds.filter(Boolean)));
    const timestamp = Math.floor(date.getTime() / 1000); // Unix timestamp
    
    log.info('defillama historical request', { ids: unique.length, date: date.toISOString(), timestamp });
    
    // Préfixe coingecko: pour les IDs standard 
    const llamaIds = unique.map(id => {
      if (id.startsWith('0x')) {
        return `ethereum:${id}`;
      }
      return `coingecko:${id}`;
    });
    
    const url = `${config.defillamaBase}/prices/historical/${timestamp}/${llamaIds.join(',')}`;
    log.info('defillama historical url', { url });
    
    try {
      const res = await fetchWithTimeout(url, 10000, rid); // Plus de timeout pour l'historique
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const json: LlamaResponse = await res.json();
      const out: Record<string, number> = {};
      
      if (json?.coins) {
        for (const [llamaId, entry] of Object.entries(json.coins)) {
          // Retrouver l'ID original depuis l'ID DeFiLlama
          const originalId = llamaId.replace('coingecko:', '').replace('ethereum:', '');
          const matchingOriginal = unique.find(id => 
            id === originalId || 
            llamaId.endsWith(id) || 
            id.toLowerCase() === originalId.toLowerCase()
          );
          
          if (matchingOriginal && typeof entry?.price === 'number' && entry.price > 0) {
            out[matchingOriginal] = entry.price;
            log.info('defillama historical price found', { 
              llamaId, 
              originalId: matchingOriginal, 
              price: entry.price, 
              date: date.toISOString() 
            });
          }
        }
      }
      
      log.info('defillama historical result', { 
        inputIds: unique.length, 
        outputPrices: Object.keys(out).length, 
        date: date.toISOString() 
      });
      
      return out;
    } catch (error) {
      log.error('defillama historical error', { error: (error as Error).message, date: date.toISOString() });
      return {};
    }
  }
}

export const defiLlamaProvider = new DefiLlamaProvider();
export default defiLlamaProvider;

import { PriceMap } from '../types';
import { tokenService } from './tokenService';
import { defiLlamaProvider } from '../providers/defillamaProvider';
import logger from '../logger';

/** Resolve DeFiLlama ids for given symbols (uppercase, dedup). */
export async function getDefillamaIdsForSymbols(symbols: string[]): Promise<Record<string, string>> {
  const upper = Array.from(new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean)));
  if (!upper.length) return {};
  return tokenService.getTokenMappings(upper);
}

/** Fetch USD prices keyed by original symbols. */
export async function getPricesForSymbols(symbols: string[], rid?: string): Promise<PriceMap> {
  const log = logger.withRid(rid);
  const clean = symbols.map(s => s.trim().toUpperCase()).filter(Boolean);
  const unique = Array.from(new Set(clean));
  if (!unique.length) return {};
  log.info('pricing start', { symbols: unique.length });
  let idMap: Record<string, string>;
  try {
    idMap = await getDefillamaIdsForSymbols(unique);
  } catch (e) {
    log.error('bq mapping failure', { error: (e as Error).message });
    throw new Error('Mapping failed');
  }
  const ids = Object.values(idMap);
  if (!ids.length) return {};
  let pricesById: Record<string, number>;
  try {
    pricesById = await defiLlamaProvider.getCurrentPrices(ids, rid);
  } catch (e) {
    log.error('defillama provider failure', { error: (e as Error).message });
    throw new Error('Pricing provider failed');
  }
  const out: PriceMap = {};
  for (const sym of unique) {
    const id = idMap[sym];
    if (!id) continue;
    const price = pricesById[id];
    if (typeof price === 'number') out[sym] = price;
  }
  log.info('pricing complete', { symbols: clean.length, prices: Object.keys(out).length });
  return out;
}

/** Fetch historical USD prices for a specific date keyed by original symbols. */
export async function getHistoricalPricesForSymbols(symbols: string[], date: Date, rid?: string): Promise<PriceMap> {
  const log = logger.withRid(rid);
  const clean = symbols.map(s => s.trim().toUpperCase()).filter(Boolean);
  const unique = Array.from(new Set(clean));
  if (!unique.length) return {};
  
  log.info('historical pricing start', { symbols: unique.length, date: date.toISOString() });
  
  let idMap: Record<string, string>;
  try {
    idMap = await getDefillamaIdsForSymbols(unique);
  } catch (e) {
    log.error('bq mapping failure for historical', { error: (e as Error).message });
    throw new Error('Historical mapping failed');
  }
  
  const ids = Object.values(idMap);
  if (!ids.length) return {};
  
  let pricesById: Record<string, number>;
  try {
    pricesById = await defiLlamaProvider.getHistoricalPrices(ids, date, rid);
  } catch (e) {
    log.error('defillama historical failure', { error: (e as Error).message });
    throw new Error('Historical pricing failed');
  }
  
  // Map back to symbols
  const result: PriceMap = {};
  for (const [symbol, id] of Object.entries(idMap)) {
    if (pricesById[id] !== undefined) {
      result[symbol] = pricesById[id];
    }
  }
  
  log.info('historical pricing complete', { 
    symbols: clean.length, 
    prices: Object.keys(result).length, 
    date: date.toISOString() 
  });
  return result;
}

export default { getPricesForSymbols, getDefillamaIdsForSymbols, getHistoricalPricesForSymbols };

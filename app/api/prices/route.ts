import { NextRequest } from 'next/server';
import { getPricesForSymbols } from '../../../lib/services/pricingService';
import logger from '../../../lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseSymbols(req: NextRequest): string[] {
  const sp = req.nextUrl.searchParams.get('symbols');
  if (!sp) return [];
  return sp.split(',').map(s => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const rid = crypto.randomUUID();
  const log = logger.withRid(rid);
  let symbols: string[] = [];
  try {
    symbols = parseSymbols(req);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid symbols parameter' }), { status: 400 });
  }
  if (!symbols.length) {
    return new Response(JSON.stringify({ success: true, prices: {} }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } });
  }
  log.info('prices request', { count: symbols.length });
  try {
    const prices = await getPricesForSymbols(symbols, rid);
    return new Response(JSON.stringify({ success: true, prices }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } });
  } catch (e) {
    log.error('prices failure', { error: (e as Error).message });
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}

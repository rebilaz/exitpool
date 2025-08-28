import { NextRequest } from 'next/server';
import { getDefillamaIdsForSymbols } from '../../../lib/services/pricingService';
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
    return new Response(JSON.stringify({ mapping: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  log.info('token-ids request', { count: symbols.length });
  try {
    const mapping = await getDefillamaIdsForSymbols(symbols);
    return new Response(JSON.stringify({ mapping }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    log.error('token-ids failure', { error: (e as Error).message });
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}

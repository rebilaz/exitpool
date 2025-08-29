import { NextRequest, NextResponse } from 'next/server';
import { portfolioService } from '../../../lib/services/portfolioService';
import { transactionRepo } from '../../../lib/repos/transactionRepo';
import { priceRepo } from '../../../lib/repos/priceRepo';
import { snapshotRepo } from '../../../lib/repos/snapshotRepo';
import logger from '../../../lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rid = crypto.randomUUID().slice(0, 8);

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'test-user-123';
    const range = (searchParams.get('range') as '7d' | '30d' | '1y') || '7d';

    logger.info('Debug endpoint called', { rid, userId, range });

    // 1. Vérifier les transactions
    const allTransactions = await transactionRepo.getTransactionsByUser(userId, undefined, undefined, 1000);

    // 2. Vérifier les snapshots
    const { startDate, endDate } = portfolioService['calculateDateRange'](range);
    const snapshots = await snapshotRepo.getSnapshotsInRange(userId, startDate, endDate);

    // 3. Vérifier les prix historiques si il y a des transactions
    let historicalPrices: Record<string, Record<string, number>> = {};
    if (allTransactions.length > 0) {
      const allSymbols = [...new Set(allTransactions.map(t => t.symbol.toUpperCase()))];
      historicalPrices = await priceRepo.getPricesForSymbols(allSymbols, startDate, endDate);
    }

    // 4. Tester le calcul d'historique
    const history = await portfolioService.computePortfolioHistory(userId, range);

    const debug = {
      userId,
      range,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      transactions: {
        count: allTransactions.length,
        sample: allTransactions.slice(0, 3).map(t => ({
          symbol: t.symbol,
          quantity: t.quantity,
          side: t.side,
          price: t.price,
          date: t.timestamp.toISOString().split('T')[0]
        }))
      },
      snapshots: {
        count: snapshots.length,
        sample: snapshots.slice(0, 3).map((s: any) => ({
          date: s.date.toISOString().split('T')[0],
          total_value: s.total_value
        }))
      },
      historicalPrices: {
        datesCount: Object.keys(historicalPrices).length,
        sample: Object.keys(historicalPrices).slice(0, 2).map(date => ({
          date,
          prices: historicalPrices[date]
        }))
      },
      computedHistory: {
        pointsCount: history.points.length,
        totalReturn: history.totalReturn,
        sample: history.points.slice(0, 5).map(p => ({
          date: p.date.toISOString().split('T')[0],
          totalValue: p.totalValue
        }))
      }
    };

    return NextResponse.json({
      success: true,
      debug
    });

  } catch (error) {
    logger.error('Debug endpoint failed', { rid, error });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

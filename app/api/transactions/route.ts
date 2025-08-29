import { NextRequest, NextResponse } from 'next/server';
import { portfolioService } from '../../../lib/services/portfolioService';
import logger from '../../../lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rid = crypto.randomUUID().slice(0, 8);
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit');
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: userId'
      }, { status: 400 });
    }
    
    const limitNumber = limit ? parseInt(limit, 10) : undefined;
    
    logger.info('Fetching transactions', { rid, userId, limit: limitNumber });
    
    const transactions = await portfolioService.getTransactions(userId, undefined, undefined, limitNumber);
    
    logger.info('Transactions fetched', { rid, count: transactions.length });
    
    return NextResponse.json({
      success: true,
      transactions
    });
    
  } catch (error) {
    logger.error('Failed to fetch transactions', { rid, error });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch transactions'
    }, { status: 500 });
  }
}

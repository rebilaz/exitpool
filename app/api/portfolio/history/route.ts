import { NextRequest, NextResponse } from 'next/server';
import { portfolioService } from '../../../../lib/services/portfolioService';
import logger from '../../../../lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rid = crypto.randomUUID().slice(0, 8);
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const range = searchParams.get('range') as '7d' | '30d' | '1y';
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: userId'
      }, { status: 400 });
    }
    
    if (!range || !['7d', '30d', '1y'].includes(range)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid range. Must be 7d, 30d, or 1y'
      }, { status: 400 });
    }
    
    logger.info('Fetching portfolio history', { rid, userId, range });
    
    const history = await portfolioService.computePortfolioHistory(userId, range);
    
    logger.info('Portfolio history fetched', { 
      rid, 
      pointsCount: history.points.length,
      totalReturn: history.totalReturn 
    });
    
    return NextResponse.json({
      success: true,
      history
    });
    
  } catch (error) {
    logger.error('Failed to fetch portfolio history', { rid, error });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch portfolio history'
    }, { status: 500 });
  }
}

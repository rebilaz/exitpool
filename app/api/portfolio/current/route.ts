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
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: userId'
      }, { status: 400 });
    }
    
    logger.info('Fetching current portfolio', { rid, userId });
    
    const portfolio = await portfolioService.getCurrentPortfolio(userId);
    
    logger.info('Current portfolio fetched', { 
      rid, 
      assetsCount: portfolio.assets.length,
      totalValue: portfolio.totalValue 
    });
    
    return NextResponse.json({
      success: true,
      portfolio
    });
    
  } catch (error) {
    logger.error('Failed to fetch current portfolio', { rid, error });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch current portfolio'
    }, { status: 500 });
  }
}

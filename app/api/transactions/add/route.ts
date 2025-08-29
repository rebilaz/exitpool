import { NextRequest, NextResponse } from 'next/server';
import { portfolioService } from '../../../../lib/services/portfolioService';
import logger from '../../../../lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rid = crypto.randomUUID().slice(0, 8);
  
  try {
    const body = await request.json();
    const { userId, symbol, quantity, price, side, note, timestamp } = body;
    
    // Validation des données requises
    if (!userId || !symbol || !quantity || !side) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, symbol, quantity, side'
      }, { status: 400 });
    }
    
    // Validation du side
    if (!['BUY', 'SELL', 'TRANSFER'].includes(side)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid side. Must be BUY, SELL, or TRANSFER'
      }, { status: 400 });
    }
    
    // Validation de la quantity
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Quantity must be a positive number'
      }, { status: 400 });
    }
    
    // Validation de la date si fournie
    let transactionDate: Date | undefined;
    if (timestamp) {
      transactionDate = new Date(timestamp);
      if (isNaN(transactionDate.getTime())) {
        return NextResponse.json({
          success: false,
          error: 'Invalid timestamp format'
        }, { status: 400 });
      }
    }
    
    logger.info('Adding transaction', { rid, userId, symbol, side, quantity, timestamp });
    
    const transactionId = await portfolioService.addTransaction(userId, {
      symbol: symbol.toUpperCase(),
      quantity: Math.abs(quantity), // Garder toujours positif, le side gère la direction
      price,
      side,
      note,
      timestamp: transactionDate
    });
    
    logger.info('Transaction added successfully', { rid, transactionId });
    
    return NextResponse.json({
      success: true,
      transactionId
    });
    
  } catch (error) {
    logger.error('Failed to add transaction', { rid, error });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to add transaction'
    }, { status: 500 });
  }
}

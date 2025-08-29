import { NextRequest, NextResponse } from 'next/server';
import { tokenService } from '../../../../lib/services/tokenService';
import logger from '../../../../lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rid = crypto.randomUUID().slice(0, 8);
  
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    
    if (!query || query.length < 2) {
      return NextResponse.json({ 
        success: true,
        suggestions: [] 
      });
    }

    logger.info(`Token suggestions request`, { rid, query });
    
    // Utilise le service centralisé pour la recherche intelligente
    const result = await tokenService.smartSearch(query);
    
    // Combine correspondance exacte et suggestions
    const suggestions = result.exactMatch 
      ? [result.exactMatch, ...result.suggestions]
      : result.suggestions;

    logger.info(`Token suggestions response`, { 
      rid,
      count: suggestions.length,
      hasExactMatch: !!result.exactMatch 
    });
    
    return NextResponse.json({ 
      success: true,
      suggestions: suggestions.map(s => ({
        symbol: s.symbol,
        name: s.name || null,
        coingecko_id: s.defillama_id // Garde le nom pour compatibilité frontend
      }))
    });
    
  } catch (error) {
    logger.error(`Token suggestions error`, { rid, error });
    return NextResponse.json({ 
      success: false,
      suggestions: [], 
      error: 'Erreur lors de la recherche de tokens' 
    }, { status: 500 });
  }
}

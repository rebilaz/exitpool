import { getPricesForSymbols } from './pricingService';
import logger from '../logger';

/**
 * Service centralisé pour tous les appels de pricing
 * Unifie l'accès aux prix dans toute l'application
 */
export class PricingCentralService {
  
  /**
   * Récupérer les prix actuels pour des symboles
   */
  async getCurrentPrices(symbols: string[]): Promise<Record<string, number>> {
    if (symbols.length === 0) return {};
    
    try {
      const prices = await getPricesForSymbols(symbols);
      logger.info('Prices fetched successfully', { 
        symbols: symbols.length, 
        pricesReturned: Object.keys(prices).length 
      });
      return prices;
    } catch (error) {
      logger.error('Error fetching prices', { error, symbols });
      return {};
    }
  }

  /**
   * Récupérer le prix d'un seul symbole
   */
  async getPriceForSymbol(symbol: string): Promise<number | null> {
    const prices = await this.getCurrentPrices([symbol]);
    return prices[symbol] || null;
  }

  /**
   * Vérifier si les prix sont disponibles pour des symboles
   */
  async checkPricesAvailability(symbols: string[]): Promise<{
    available: string[];
    missing: string[];
    success: boolean;
  }> {
    const prices = await this.getCurrentPrices(symbols);
    const available = Object.keys(prices);
    const missing = symbols.filter(symbol => !prices[symbol]);
    
    return {
      available,
      missing,
      success: missing.length === 0
    };
  }
}

// Export singleton
export const pricingCentralService = new PricingCentralService();

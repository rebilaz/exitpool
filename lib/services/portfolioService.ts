import { transactionRepo, type AddTransactionData, type Transaction } from '../repos/transactionRepo';
import { snapshotRepo } from '../repos/snapshotRepo';
import { tokenService } from './tokenService';
import { getHistoricalPricesForSymbols } from './pricingService';
import logger from '../logger';

export interface CurrentPortfolioAsset {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

export interface CurrentPortfolio {
  userId: string;
  assets: CurrentPortfolioAsset[];
  totalValue: number;
  totalInvested: number;
  totalPnl: number;
  totalPnlPercent: number;
  lastUpdated: Date;
}

export interface PortfolioHistoryPoint {
  date: Date;
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
}

export interface PortfolioHistory {
  userId: string;
  range: '7d' | '30d' | '1y';
  points: PortfolioHistoryPoint[];
  totalReturn: number;
  totalReturnPercent: number;
}

/**
 * Service pour la gestion du portefeuille et des transactions
 * Orchestre transactionRepo et tokenService
 */
export class PortfolioService {
  
  /**
   * Récupère les prix actuels via DeFiLlama API
   */
  private async fetchCurrentPrices(symbols: string[]): Promise<Record<string, number>> {
    try {
      // Récupérer les mappings symbol -> defiLlamaId
      const tokenMappings = await tokenService.getTokenMappings(symbols);
      const defiLlamaIds = Array.from(new Set(Object.values(tokenMappings)));
      
      if (defiLlamaIds.length === 0) {
        logger.warn('No DeFiLlama IDs found for symbols', { symbols });
        return {};
      }

      // Récupérer les prix
      const url = `https://api.llama.fi/prices/current/${defiLlamaIds.join(',')}`;
      logger.info('Fetching prices from DeFiLlama', { url, symbols });
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`DeFiLlama API error: ${response.status}`);
      }

      const data: { coins: Record<string, { price: number }> } = await response.json();
      
      // Mapper les prix par symbol
      const pricesBySymbol: Record<string, number> = {};
      
      for (const symbol of symbols) {
        const defiLlamaId = tokenMappings[symbol.toUpperCase()];
        if (defiLlamaId && data.coins[defiLlamaId]) {
          pricesBySymbol[symbol] = data.coins[defiLlamaId].price;
        } else {
          logger.warn('Price not found for symbol', { symbol, defiLlamaId });
        }
      }

      logger.info('Fetched prices successfully', { pricesBySymbol });
      return pricesBySymbol;
    } catch (error) {
      logger.error('Error fetching prices from DeFiLlama', { error, symbols });
      return {};
    }
  }
  
  /**
   * Ajouter une transaction
   * Si la transaction est dans le passé, invalide les snapshots postérieurs
   */
  async addTransaction(userId: string, data: Omit<AddTransactionData, 'userId'>): Promise<string> {
    const transactionData: AddTransactionData = {
      ...data,
      userId
    };
    
    // Si pas de prix fourni et que c'est un BUY/SELL, récupérer le prix actuel
    if (!data.price && (data.side === 'BUY' || data.side === 'SELL')) {
      const prices = await this.fetchCurrentPrices([data.symbol]);
      if (prices[data.symbol.toUpperCase()]) {
        transactionData.price = prices[data.symbol.toUpperCase()];
        logger.info('Fetched current price for transaction', { symbol: data.symbol, price: transactionData.price });
      }
    }
    
    const transactionDate = data.timestamp || new Date();
    const transactionId = await transactionRepo.addTransaction(transactionData);
    
    // Si la transaction est dans le passé, supprimer les snapshots postérieurs
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset à minuit
    
    const txDate = new Date(transactionDate);
    txDate.setHours(0, 0, 0, 0); // Reset à minuit
    
    if (txDate < today) {
      logger.info('Transaction in the past, invalidating future snapshots', { 
        userId, 
        transactionDate: txDate.toISOString().split('T')[0],
        today: today.toISOString().split('T')[0]
      });
      
      // Supprimer tous les snapshots après la date de la transaction
      await snapshotRepo.deleteSnapshotsAfterDate(userId, txDate);
    }
    
    // Déclencher un recalcul de snapshot pour la date actuelle
    if (data.side === 'BUY' || data.side === 'SELL') {
      await this.updateCurrentSnapshot(userId);
    }
    
    return transactionId;
  }
  
  /**
   * Récupérer le portefeuille actuel avec valorisation temps réel
   */
  async getCurrentPortfolio(userId: string): Promise<CurrentPortfolio> {
    logger.info('Computing current portfolio', { userId });
    
    // 1. Récupérer les positions depuis les transactions
    const positions = await transactionRepo.getCurrentPortfolioFromTransactions(userId);
    
    if (Object.keys(positions).length === 0) {
      return {
        userId,
        assets: [],
        totalValue: 0,
        totalInvested: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        lastUpdated: new Date()
      };
    }
    
    // 2. Récupérer les prix actuels via DeFiLlama
    const symbols = Object.keys(positions);
    const currentPrices = await this.fetchCurrentPrices(symbols);
    
    // 3. Calculer les assets avec valorisation
    const assets: CurrentPortfolioAsset[] = [];
    let totalValue = 0;
    let totalInvested = 0;
    
    for (const [symbol, position] of Object.entries(positions)) {
      const currentPrice = currentPrices[symbol] || position.avgPrice;
      const value = position.quantity * currentPrice;
      const invested = position.quantity * position.avgPrice;
      const pnl = value - invested;
      const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
      
      assets.push({
        symbol,
        quantity: position.quantity,
        avgPrice: position.avgPrice,
        currentPrice,
        value,
        pnl,
        pnlPercent
      });
      
      totalValue += value;
      totalInvested += invested;
    }
    
    const totalPnl = totalValue - totalInvested;
    const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    
    // Trier par valeur décroissante
    assets.sort((a, b) => b.value - a.value);
    
    logger.info('Current portfolio computed', { 
      userId, 
      assetsCount: assets.length, 
      totalValue,
      totalPnl 
    });
    
    return {
      userId,
      assets,
      totalValue,
      totalInvested,
      totalPnl,
      totalPnlPercent,
      lastUpdated: new Date()
    };
  }
  
  /**
   * Calculer l'historique du portefeuille
   * 1. Essaie d'abord les snapshots (cache)
   * 2. Sinon, rejoue les transactions avec prix historiques
   * 3. Sauvegarde les snapshots calculés pour la prochaine fois
   * 4. Fallback vers mock si aucune donnée
   */
  async computePortfolioHistory(userId: string, range: '7d' | '30d' | '1y'): Promise<PortfolioHistory> {
    logger.info('Computing portfolio history', { userId, range });
    
    try {
      // 1. Essayer d'abord de récupérer depuis les snapshots
      const snapshots = await snapshotRepo.getSnapshotsByUser(userId, range);
      
      if (snapshots.length > 0) {
        logger.info('Using portfolio snapshots from cache', { userId, range, pointsCount: snapshots.length });
        
        const points: PortfolioHistoryPoint[] = snapshots.map((snapshot, index) => {
          const prevSnapshot = index > 0 ? snapshots[index - 1] : snapshot;
          const dailyChange = snapshot.total_value - prevSnapshot.total_value;
          const dailyChangePercent = prevSnapshot.total_value > 0 
            ? (dailyChange / prevSnapshot.total_value) * 100 
            : 0;
          
          return {
            date: snapshot.date,
            totalValue: snapshot.total_value,
            dailyChange,
            dailyChangePercent
          };
        });
        
        const totalReturn = points.length > 1 
          ? points[points.length - 1].totalValue - points[0].totalValue 
          : 0;
        const totalReturnPercent = points.length > 1 && points[0].totalValue > 0
          ? (totalReturn / points[0].totalValue) * 100 
          : 0;
        
        return {
          userId,
          range,
          points,
          totalReturn,
          totalReturnPercent
        };
      }
      
      // 2. Si pas de snapshots, calculer depuis les transactions
      logger.info('No snapshots found, computing from transactions', { userId, range });
      const transactionHistory = await transactionRepo.computePortfolioHistoryFromTransactions(userId, range);
      
      if (transactionHistory.length > 0) {
        logger.info('Computed history from transactions, saving snapshots', { userId, range, pointsCount: transactionHistory.length });
        
        // Sauvegarder les snapshots calculés pour accélérer les prochains appels
        const savePromises = transactionHistory.map(entry => 
          snapshotRepo.saveSnapshot(userId, {
            date: entry.date,
            totalValue: entry.totalValue,
            breakdown: entry.breakdown
          })
        );
        
        // Ne pas attendre la sauvegarde pour retourner rapidement
        Promise.all(savePromises).catch(error => 
          logger.warn('Failed to save some snapshots', { userId, error })
        );
        
        const points: PortfolioHistoryPoint[] = transactionHistory.map((entry, index) => {
          const prevEntry = index > 0 ? transactionHistory[index - 1] : entry;
          const dailyChange = entry.totalValue - prevEntry.totalValue;
          const dailyChangePercent = prevEntry.totalValue > 0 
            ? (dailyChange / prevEntry.totalValue) * 100 
            : 0;
          
          return {
            date: entry.date,
            totalValue: entry.totalValue,
            dailyChange,
            dailyChangePercent
          };
        });
        
        const totalReturn = points.length > 1 
          ? points[points.length - 1].totalValue - points[0].totalValue 
          : 0;
        const totalReturnPercent = points.length > 1 && points[0].totalValue > 0
          ? (totalReturn / points[0].totalValue) * 100 
          : 0;
        
        return {
          userId,
          range,
          points,
          totalReturn,
          totalReturnPercent
        };
      }
      
      // 3. Si aucune transaction, retourner un historique vide (valeur 0)
      logger.info('No transactions found, returning empty history', { userId, range });
      
      const endDate = new Date();
      const startDate = new Date();
      
      switch (range) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }
      
      const points: PortfolioHistoryPoint[] = [];
      const daysCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      for (let i = 0; i <= daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        points.push({
          date,
          totalValue: 0, // Pas de transactions = valeur 0
          dailyChange: 0,
          dailyChangePercent: 0
        });
      }
      
      return {
        userId,
        range,
        points,
        totalReturn: 0,
        totalReturnPercent: 0
      };
      
    } catch (error) {
      logger.error('Error computing portfolio history, falling back to mock', { userId, range, error });
      
      // 4. Fallback vers données mock en cas d'erreur
      const endDate = new Date();
      const startDate = new Date();
      
      switch (range) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }
      
      const points: PortfolioHistoryPoint[] = [];
      const daysCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let baseValue = 50000; // Valeur de base mock
      
      for (let i = 0; i <= daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        // Variation aléatoire pour la demo
        const variation = (Math.random() - 0.5) * 0.1; // ±5%
        const dailyChange = baseValue * variation;
        const totalValue = baseValue + dailyChange;
        
        points.push({
          date,
          totalValue,
          dailyChange,
          dailyChangePercent: (dailyChange / baseValue) * 100
        });
        
        baseValue = totalValue;
      }
      
      const totalReturn = points[points.length - 1].totalValue - points[0].totalValue;
      const totalReturnPercent = (totalReturn / points[0].totalValue) * 100;
      
      logger.info('Portfolio history computed (mock fallback)', { 
        userId, 
        range, 
        pointsCount: points.length,
        totalReturn 
      });

      return {
        userId,
        range,
        points,
        totalReturn,
        totalReturnPercent
      };
    }
  }
  
  /**
   * Récupérer les transactions d'un utilisateur
   */
  async getTransactions(userId: string, from?: Date, to?: Date, limit?: number): Promise<Transaction[]> {
    return transactionRepo.getTransactionsByUser(userId, from, to, limit);
  }
  
  /**
   * Ajouter une transaction et mettre à jour les snapshots
   */
  async addTransactionWithSnapshot(data: AddTransactionData): Promise<string> {
    logger.info('Adding transaction with snapshot update', { userId: data.userId, symbol: data.symbol });
    
    // Ajouter la transaction
    const transactionId = await transactionRepo.addTransaction(data);
    
    // Mettre à jour le snapshot actuel
    await this.updateCurrentSnapshot(data.userId);
    
    logger.info('Transaction added with snapshot updated', { userId: data.userId, transactionId });
    return transactionId;
  }
  /**
   * Mettre à jour le snapshot du jour actuel
   */
  private async updateCurrentSnapshot(userId: string): Promise<void> {
    try {
      const portfolio = await this.getCurrentPortfolio(userId);
      const today = new Date();
      
      // Créer le breakdown par asset
      const breakdown: Record<string, { quantity: number; value: number; price: number }> = {};
      
      portfolio.assets.forEach(asset => {
        breakdown[asset.symbol] = {
          quantity: asset.quantity,
          value: asset.value,
          price: asset.currentPrice
        };
      });
      
      await snapshotRepo.saveSnapshot(userId, {
        date: today,
        totalValue: portfolio.totalValue,
        breakdown
      });
      
      logger.info('Current snapshot updated', { userId, totalValue: portfolio.totalValue });
    } catch (error) {
      logger.error('Failed to update current snapshot', { userId, error });
    }
  }
}

// Instance singleton
export const portfolioService = new PortfolioService();
export default portfolioService;

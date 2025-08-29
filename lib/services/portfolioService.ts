import { transactionRepo, type AddTransactionData, type Transaction } from '../repos/transactionRepo';
import { snapshotRepo } from '../repos/snapshotRepo';
import { priceRepo } from '../repos/priceRepo';
import { tokenService } from './tokenService';
import { getHistoricalPricesForSymbols } from './pricingService';
import { pricingCentralService } from './pricingCentralService';
import getBigQuery from '../db/bqClient';
import config from '../config';
import logger from '../logger';

export interface CurrentPortfolioAsset {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  invested: number;
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
  private dataset = 'Cryptopilot';

  /**
   * Récupère les prix actuels via le service de pricing unifié
   */
  private async fetchCurrentPrices(symbols: string[]): Promise<Record<string, number>> {
    return await pricingCentralService.getCurrentPrices(symbols);
  }

  /**
   * Calculer la valeur et P&L d'un asset
   */
  private calculateAssetMetrics(quantity: number, currentPrice: number, avgPrice: number): {
    value: number;
    invested: number;
    pnl: number;
    pnlPercent: number;
  } {
    const value = quantity * currentPrice;
    const invested = quantity * avgPrice;
    const pnl = value - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    
    return { value, invested, pnl, pnlPercent };
  }

  /**
   * Calculer les dates de début et fin pour une période donnée
   */
  private calculateDateRange(range: '7d' | '30d' | '1y'): { startDate: Date; endDate: Date } {
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
    
    return { startDate, endDate };
  }

  /**
   * Récupérer et stocker les prix historiques pour une liste de symboles et une date
   */
  private async fetchAndStoreHistoricalPrices(symbols: string[], date: Date, userId: string): Promise<void> {
    const rid = crypto.randomUUID().slice(0, 8);
    const log = logger.withRid(rid);

    try {
      log.info('Fetching historical prices for past transaction', {
        symbols,
        date: date.toISOString().split('T')[0],
        userId
      });

      // Importer la fonction de récupération des prix historiques
      const { getHistoricalPricesForSymbols } = await import('../services/pricingService');

      // Récupérer les prix historiques depuis DeFiLlama
      const historicalPrices = await getHistoricalPricesForSymbols(symbols, date, rid);

      if (Object.keys(historicalPrices).length === 0) {
        log.warn('No historical prices found from DeFiLlama', { symbols, date: date.toISOString() });
        return;
      }

      // Stocker les prix dans BigQuery
      const bq = getBigQuery();
      const priceInserts = Object.entries(historicalPrices).map(([symbol, price]) => `
        SELECT '${date.toISOString().split('T')[0]}' as date,
               '${symbol.toUpperCase()}' as symbol,
               '${symbol.toLowerCase()}' as token_id,
               ${price} as price,
               'defillama' as source,
               TIMESTAMP('${new Date().toISOString()}') as last_updated
      `);

      const query = `
        INSERT INTO \`${config.projectId}.${this.dataset}.historical_prices\`
        (date, symbol, token_id, price, source, last_updated)
        ${priceInserts.join(' UNION ALL ')}
      `;

      const [job] = await bq.createQueryJob({ query });
      await job.getQueryResults();

      log.info('Historical prices stored successfully', {
        symbols: Object.keys(historicalPrices),
        pricesCount: Object.keys(historicalPrices).length,
        date: date.toISOString().split('T')[0]
      });

    } catch (error) {
      log.error('Failed to fetch and store historical prices', {
        error: (error as Error).message,
        symbols,
        date: date.toISOString()
      });
      // Ne pas throw l'erreur pour ne pas bloquer l'ajout de transaction
    }
  }

  /**
   * Normaliser une date à minuit
   */
  private normalizeToMidnight(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  /**
   * Créer un asset de portfolio
   */
  private createPortfolioAsset(
    symbol: string, 
    quantity: number, 
    avgPrice: number, 
    currentPrice: number
  ): CurrentPortfolioAsset {
    const metrics = this.calculateAssetMetrics(quantity, currentPrice, avgPrice);
    
    return {
      symbol,
      quantity,
      avgPrice,
      currentPrice,
      ...metrics
    };
  }
  
  /**
   * Backfill les prix historiques pour un symbole sur une période donnée
   * Utilisé quand une transaction passée est ajoutée pour permettre la valorisation
   */
  private async backfillHistoricalPrices(symbol: string, from: Date, to: Date, userId: string): Promise<void> {
    const rid = crypto.randomUUID().slice(0, 8);
    const log = logger.withRid(rid);

    log.info('[BACKFILL] Début backfill historique', {
      symbol,
      from: from.toISOString(),
      to: to.toISOString(),
      userId
    });

    try {
      // Récupérer la fonction de pricing
      const { getHistoricalPricesForSymbols } = await import('./pricingService');
      const allPricesToInsert: any[] = [];
      const currentDate = new Date(from);
      let totalApiCalls = 0;
      let totalApiSuccess = 0;
      let totalApiFail = 0;

      while (currentDate <= to) {
        log.info(`[BACKFILL] Appel API DeFiLlama pour ${symbol} à la date ${currentDate.toISOString().split('T')[0]}`);
        totalApiCalls++;
        try {
          const dailyPrices = await getHistoricalPricesForSymbols([symbol], currentDate, rid);
          if (dailyPrices[symbol.toUpperCase()]) {
            allPricesToInsert.push({
              date: new Date(currentDate),
              symbol: symbol.toUpperCase(),
              token_id: symbol.toLowerCase(),
              price: dailyPrices[symbol.toUpperCase()],
              source: 'defillama',
              last_updated: new Date()
            });
            log.info(`[BACKFILL] Prix récupéré pour ${symbol} le ${currentDate.toISOString().split('T')[0]}: ${dailyPrices[symbol.toUpperCase()]}`);
            totalApiSuccess++;
          } else {
            log.warn(`[BACKFILL] Aucun prix retourné pour ${symbol} le ${currentDate.toISOString().split('T')[0]}`);
          }
        } catch (error) {
          log.warn(`[BACKFILL] Erreur API pour ${symbol} le ${currentDate.toISOString().split('T')[0]}: ${(error as Error).message}`);
          totalApiFail++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      log.info(`[BACKFILL] Résumé API: ${totalApiCalls} appels, ${totalApiSuccess} succès, ${totalApiFail} échecs, ${allPricesToInsert.length} prix à insérer`);

      if (allPricesToInsert.length === 0) {
        log.warn('[BACKFILL] Aucun prix à insérer dans historical_prices', { symbol, from, to });
        return;
      }

      log.info(`[BACKFILL] Insertion batch dans BigQuery: ${allPricesToInsert.length} prix...`);
      await priceRepo.insertHistoricalPrices(allPricesToInsert);

      log.info('[BACKFILL] Terminé: prix insérés dans historical_prices', {
        symbol,
        daysProcessed: allPricesToInsert.length,
        dateRange: {
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0]
        }
      });

    } catch (error) {
      log.error('[BACKFILL] Échec global du backfill', {
        symbol,
        from: from.toISOString(),
        to: to.toISOString(),
        error: (error as Error).message
      });
      // Ne pas throw l'erreur pour ne pas bloquer l'ajout de transaction
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

    // Si la transaction est dans le passé, invalider les snapshots futurs ET récupérer les prix historiques
    const today = this.normalizeToMidnight(new Date());
    const txDate = this.normalizeToMidnight(transactionDate);

    if (txDate < today) {
      logger.info('Transaction in the past, invalidating future snapshots', { 
        userId, 
        transactionDate: txDate.toISOString().split('T')[0],
        today: today.toISOString().split('T')[0]
      });
      
      await snapshotRepo.deleteSnapshotsAfterDate(userId, txDate);
      
      // Backfill les prix historiques pour permettre la valorisation
      try {
        await this.backfillHistoricalPrices(data.symbol, txDate, today, userId);
      } catch (error) {
        logger.warn('Failed to backfill historical prices, continuing anyway', {
          userId,
          symbol: data.symbol,
          error: (error as Error).message
        });
        // Ne pas throw l'erreur pour ne pas bloquer l'ajout de transaction
      }
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

    // 2. Récupérer les prix actuels
    const symbols = Object.keys(positions);
    const currentPrices = await this.fetchCurrentPrices(symbols);

    // 3. Créer les assets avec valorisation
    const assets: CurrentPortfolioAsset[] = [];
    let totalValue = 0;
    let totalInvested = 0;

    for (const [symbol, position] of Object.entries(positions)) {
      const currentPrice = currentPrices[symbol] || position.avgPrice;
      const asset = this.createPortfolioAsset(symbol, position.quantity, position.avgPrice, currentPrice);
      
      assets.push(asset);
      totalValue += asset.value;
      totalInvested += asset.invested;
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

  /**
   * NOUVELLE LOGIQUE - Calculer l'historique du portefeuille depuis les transactions + prix historiques
   * Remplace l'ancienne logique mocké par une vraie logique basée sur les données
   */
  async computePortfolioHistory(userId: string, range: '7d' | '30d' | '1y'): Promise<PortfolioHistory> {
    const rid = crypto.randomUUID().slice(0, 8);
    logger.info('Computing portfolio history - NEW LOGIC', { rid, userId, range });
    
    const { startDate, endDate } = this.calculateDateRange(range);
    
    try {
      // 1. Essayer d'abord les snapshots existants (cache)
      const snapshots = await snapshotRepo.getSnapshotsInRange(userId, startDate, endDate);
      
      if (snapshots.length > 0) {
        logger.info('Using cached snapshots', { rid, userId, snapshotsCount: snapshots.length });
        
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
      
      // 2. Pas de snapshots → calculer depuis les transactions + prix historiques
      logger.info('No snapshots found, computing from transactions and historical prices', { rid, userId });
      
      // Récupérer toutes les transactions de l'utilisateur depuis le début
      const allTransactions = await transactionRepo.getTransactionsByUser(userId, undefined, endDate, 10000);
      
      logger.info('DEBUG: Transactions found', { 
        rid, 
        userId, 
        transactionsCount: allTransactions.length,
        transactions: allTransactions.map(t => ({
          symbol: t.symbol,
          quantity: t.quantity,
          side: t.side,
          date: t.timestamp.toISOString().split('T')[0]
        }))
      });
      
      if (allTransactions.length === 0) {
        logger.info('No transactions found, returning zero portfolio', { rid, userId });
        
        // Retourner un historique à zéro (avant la première transaction)
        const points: PortfolioHistoryPoint[] = this.generateDaysBetween(startDate, endDate).map(date => ({
          date,
          totalValue: 0,
          dailyChange: 0,
          dailyChangePercent: 0
        }));
        
        return {
          userId,
          range,
          points,
          totalReturn: 0,
          totalReturnPercent: 0
        };
      }
      
      // Trier les transactions par date
      allTransactions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Récupérer tous les symboles uniques
      const allSymbols = [...new Set(allTransactions.map(t => t.symbol.toUpperCase()))];
      
      // Récupérer les prix historiques pour tous les symboles sur la période
      const historicalPrices = await priceRepo.getPricesForSymbols(allSymbols, startDate, endDate);
      
      logger.info('DEBUG: Historical prices', { 
        rid, 
        userId, 
        symbols: allSymbols,
        pricesCount: Object.keys(historicalPrices).length,
        samplePrices: Object.keys(historicalPrices).slice(0, 3).map(date => ({
          date,
          prices: historicalPrices[date]
        }))
      });
      
      // Calculer la valeur du portefeuille pour chaque jour jusqu'à yesterday
      const today = this.normalizeToMidnight(new Date());
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      // On coupe la période à yesterday pour l'historique
      const endHistoryDate = yesterday < endDate ? yesterday : endDate;
      const portfolioByDay = this.computeDailyPortfolioValues(
        allTransactions, 
        historicalPrices, 
        startDate, 
        endHistoryDate
      );

      // Convertir en points d'historique (jusqu'à yesterday)
      const points: PortfolioHistoryPoint[] = portfolioByDay.map((entry, index) => {
        const prevEntry = index > 0 ? portfolioByDay[index - 1] : entry;
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

      // Ajouter le point du jour courant via snapshot (valorisation temps réel)
      let todaySnapshot = await snapshotRepo.getSnapshotByDate(userId, today);
      if (!todaySnapshot) {
        // Si snapshot absent, on le crée à la volée
        const currentPortfolio = await this.getCurrentPortfolio(userId);
        await snapshotRepo.saveSnapshot(userId, {
          date: today,
          totalValue: currentPortfolio.totalValue,
          breakdown: Object.fromEntries(currentPortfolio.assets.map(a => [a.symbol, { quantity: a.quantity, value: a.value, price: a.currentPrice }]))
        });
        todaySnapshot = await snapshotRepo.getSnapshotByDate(userId, today);
      }
      if (todaySnapshot) {
        const prev = points.length > 0 ? points[points.length - 1] : { totalValue: 0 };
        const dailyChange = todaySnapshot.total_value - prev.totalValue;
        const dailyChangePercent = prev.totalValue > 0 ? (dailyChange / prev.totalValue) * 100 : 0;
        points.push({
          date: today,
          totalValue: todaySnapshot.total_value,
          dailyChange,
          dailyChangePercent
        });
      }

      // Sauvegarder les snapshots pour accélérer les prochains appels (sauf today déjà fait)
      const savePromises = portfolioByDay.map(entry => 
        snapshotRepo.saveSnapshot(userId, {
          date: entry.date,
          totalValue: entry.totalValue,
          breakdown: entry.breakdown
        })
      );
      Promise.all(savePromises).catch(error => 
        logger.warn('Failed to save some snapshots', { rid, userId, error })
      );

      // Calcul du totalReturn sur toute la période (incluant today)
      const totalReturn = points.length > 1 
        ? points[points.length - 1].totalValue - points[0].totalValue 
        : 0;
      const totalReturnPercent = points.length > 1 && points[0].totalValue > 0
        ? (totalReturn / points[0].totalValue) * 100 
        : 0;

      logger.info('Portfolio history computed from transactions (with today snapshot)', { 
        rid, 
        userId, 
        pointsCount: points.length,
        totalReturn,
        samplePoints: points.slice(0, 3).map(p => ({
          date: p.date.toISOString().split('T')[0],
          totalValue: p.totalValue
        }))
      });

      return {
        userId,
        range,
        points,
        totalReturn,
        totalReturnPercent
      };
      
    } catch (error) {
      logger.error('Failed to compute portfolio history', { rid, userId, range, error });
      throw error;
    }
  }
  
  /**
   * Générer toutes les dates entre deux dates
   */
  private generateDaysBetween(startDate: Date, endDate: Date): Date[] {
    const days: Date[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }
  
  /**
   * Calculer la valeur du portefeuille pour chaque jour entre deux dates
   * Logique principale : pour chaque jour, calculer les quantités cumulées de chaque token
   * puis multiplier par le prix historique de ce token pour ce jour
   */
  private computeDailyPortfolioValues(
    transactions: Transaction[], 
    historicalPrices: Record<string, Record<string, number>>, 
    startDate: Date, 
    endDate: Date
  ): Array<{
    date: Date,
    totalValue: number,
    breakdown: Record<string, { quantity: number; value: number; price: number }>
  }> {
    const days = this.generateDaysBetween(startDate, endDate);
    const results: Array<{
      date: Date,
      totalValue: number,
      breakdown: Record<string, { quantity: number; value: number; price: number }>
    }> = [];

    // Préparer la date du jour (normalisée)
    const today = this.normalizeToMidnight(new Date());
    // Préparer la liste des symboles concernés
    const allSymbols = Array.from(new Set(transactions.map(t => t.symbol.toUpperCase())));
    // Récupérer les prix temps réel une seule fois
    let currentPrices: Record<string, number> = {};
    let fetchedCurrentPrices = false;

    for (const day of days) {
      const dayStr = day.toISOString().split('T')[0];

      // Calculer les quantités cumulées jusqu'à cette date
      const portfolioAtDate: Record<string, number> = {};

      for (const tx of transactions) {
        const txDate = this.normalizeToMidnight(tx.timestamp);
        if (txDate <= day) {
          const symbol = tx.symbol.toUpperCase();

          if (!portfolioAtDate[symbol]) {
            portfolioAtDate[symbol] = 0;
          }

          // Appliquer la transaction
          if (tx.side === 'BUY') {
            portfolioAtDate[symbol] += tx.quantity;
          } else if (tx.side === 'SELL') {
            portfolioAtDate[symbol] -= tx.quantity;
          }
          // TRANSFER: pas d'impact sur la quantité totale
        }
      }

      // Calculer la valeur totale pour ce jour
      let totalValue = 0;
      const breakdown: Record<string, { quantity: number; value: number; price: number }> = {};

      for (const [symbol, quantity] of Object.entries(portfolioAtDate)) {
        if (quantity > 0) {
          // On ne gère plus today ici, il est traité via snapshot dans computePortfolioHistory
          const price = historicalPrices[dayStr]?.[symbol] || 0;
          const value = quantity * price;
          totalValue += value;
          breakdown[symbol] = { quantity, value, price };
        }
      }

      results.push({
        date: day,
        totalValue,
        breakdown
      });
    }

    return results;
  }
}

// Instance singleton
export const portfolioService = new PortfolioService();
export default portfolioService;

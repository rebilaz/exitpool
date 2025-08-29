import getBigQuery from '../db/bqClient';
import config from '../config';
import logger from '../logger';
import { getHistoricalPricesForSymbols } from '../services/pricingService';

export interface Transaction {
  transaction_id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  price: number;
  side: 'BUY' | 'SELL' | 'TRANSFER';
  timestamp: Date;
  note?: string;
}

export interface AddTransactionData {
  userId: string;
  symbol: string;
  quantity: number;
  price?: number;
  side: 'BUY' | 'SELL' | 'TRANSFER';
  timestamp?: Date;
  note?: string;
}

export interface PortfolioSnapshot {
  user_id: string;
  date: Date;
  total_value: number;
  breakdown: string; // JSON serialized
}

export interface SaveSnapshotData {
  date: Date;
  totalValue: number;
  breakdown: Record<string, { quantity: number; value: number; price: number }>;
}

/**
 * Repository pour les transactions et snapshots de portefeuille
 * Seul point d'accès à BigQuery pour ce domaine
 */
export class TransactionRepo {
  private dataset = 'Cryptopilot';
  
  /**
   * Ajouter une nouvelle transaction
   */
  async addTransaction(data: AddTransactionData): Promise<string> {
    const bq = getBigQuery();
    const transactionId = crypto.randomUUID();
    const timestamp = data.timestamp || new Date();
    
    const query = `
      INSERT INTO \`${config.projectId}.${this.dataset}.transactions\`
      (transaction_id, user_id, symbol, quantity, price, side, timestamp, note)
      VALUES (@transactionId, @userId, @symbol, @quantity, @price, @side, @timestamp, @note)
    `;
    
    const params = {
      transactionId,
      userId: data.userId,
      symbol: data.symbol.toUpperCase(),
      quantity: data.quantity,
      price: data.price || 0,
      side: data.side,
      timestamp: timestamp.toISOString(),
      note: data.note || null
    };
    
    logger.info('Adding transaction', { userId: data.userId, symbol: data.symbol, side: data.side });
    
    const [job] = await bq.createQueryJob({ query, params });
    await job.getQueryResults();
    
    logger.info('Transaction added', { transactionId, userId: data.userId });
    return transactionId;
  }
  
  /**
   * Récupérer les transactions d'un utilisateur
   */
  async getTransactionsByUser(
    userId: string, 
    from?: Date, 
    to?: Date, 
    limit: number = 100
  ): Promise<Transaction[]> {
    const bq = getBigQuery();
    
    let whereClause = `WHERE user_id = @userId`;
    const params: any = { userId, limit };
    
    if (from) {
      whereClause += ` AND timestamp >= @fromDate`;
      params.fromDate = from.toISOString();
    }
    
    if (to) {
      whereClause += ` AND timestamp <= @toDate`;
      params.toDate = to.toISOString();
    }
    
    const query = `
      SELECT 
        transaction_id,
        user_id,
        symbol,
        quantity,
        price,
        side,
        timestamp,
        note
      FROM \`${config.projectId}.${this.dataset}.transactions\`
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT @limit
    `;
    
    logger.info('Fetching transactions', { userId, from, to, limit });
    
    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();
    
    const transactions: Transaction[] = rows.map((row: any) => ({
      transaction_id: row.transaction_id,
      user_id: row.user_id,
      symbol: row.symbol,
      quantity: parseFloat(row.quantity),
      price: parseFloat(row.price),
      side: row.side,
      timestamp: new Date(row.timestamp.value),
      note: row.note || undefined
    }));
    
    logger.info('Transactions fetched', { userId, count: transactions.length });
    return transactions;
  }
  
  /**
   * Récupérer un snapshot de portefeuille pour une date donnée
   */
  async getPortfolioSnapshot(userId: string, date: Date): Promise<PortfolioSnapshot | null> {
    const bq = getBigQuery();
    
    const query = `
      SELECT user_id, date, total_value, breakdown
      FROM \`${config.projectId}.${this.dataset}.portfolio_snapshots\`
      WHERE user_id = @userId AND date = @date
      LIMIT 1
    `;
    
    const params = {
      userId,
      date: date.toISOString().split('T')[0] // YYYY-MM-DD format
    };
    
    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      user_id: row.user_id,
      date: new Date(row.date.value),
      total_value: parseFloat(row.total_value),
      breakdown: row.breakdown
    };
  }
  
  /**
   * Sauvegarder un snapshot de portefeuille
   */
  async savePortfolioSnapshot(userId: string, snapshot: SaveSnapshotData): Promise<void> {
    const bq = getBigQuery();
    
    const query = `
      MERGE \`${config.projectId}.${this.dataset}.portfolio_snapshots\` AS target
      USING (
        SELECT 
          @userId as user_id,
          @date as date,
          @totalValue as total_value,
          @breakdown as breakdown
      ) AS source
      ON target.user_id = source.user_id AND target.date = source.date
      WHEN MATCHED THEN
        UPDATE SET 
          total_value = source.total_value,
          breakdown = source.breakdown
      WHEN NOT MATCHED THEN
        INSERT (user_id, date, total_value, breakdown)
        VALUES (source.user_id, source.date, source.total_value, source.breakdown)
    `;
    
    const params = {
      userId,
      date: snapshot.date.toISOString().split('T')[0],
      totalValue: snapshot.totalValue,
      breakdown: JSON.stringify(snapshot.breakdown)
    };
    
    logger.info('Saving portfolio snapshot', { userId, date: params.date, totalValue: snapshot.totalValue });
    
    const [job] = await bq.createQueryJob({ query, params });
    await job.getQueryResults();
    
    logger.info('Portfolio snapshot saved', { userId, date: params.date });
  }
  
  /**
   * Récupérer l'historique du portefeuille depuis les snapshots
   */
  async getPortfolioHistory(userId: string, range: '7d' | '30d' | '1y'): Promise<PortfolioSnapshot[]> {
    const bq = getBigQuery();
    
    // Calculer la date de début selon le range
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
    
    const query = `
      SELECT 
        user_id,
        date,
        total_value,
        breakdown
      FROM \`${config.projectId}.${this.dataset}.portfolio_snapshots\`
      WHERE user_id = @userId 
        AND date >= @startDate 
        AND date <= @endDate
      ORDER BY date ASC
    `;
    
    const params = { 
      userId, 
      startDate: startDate.toISOString().split('T')[0], // Format YYYY-MM-DD
      endDate: endDate.toISOString().split('T')[0]
    };
    
    logger.info('Fetching portfolio history from BigQuery', { userId, range, startDate, endDate });
    
    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();
    
    const history = rows.map((row: any) => ({
      user_id: row.user_id,
      date: new Date(row.date),
      total_value: parseFloat(row.total_value),
      breakdown: row.breakdown
    }));
    
    logger.info('Portfolio history fetched', { userId, range, pointsCount: history.length });
    return history;
  }

  /**
   * Calculer l'historique du portefeuille basé sur les transactions + prix historiques
   */
  async computePortfolioHistoryFromTransactions(userId: string, range: '7d' | '30d' | '1y'): Promise<{
    date: Date;
    totalValue: number;
    breakdown: Record<string, { quantity: number; value: number; price: number }>;
  }[]> {
    const bq = getBigQuery();
    
    // Calculer les dates
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
    
    // Requête pour recalculer le portefeuille à chaque date depuis les transactions
    const query = `
      WITH date_range AS (
        SELECT date
        FROM UNNEST(GENERATE_DATE_ARRAY(DATE(@startDate), DATE(@endDate), INTERVAL 1 DAY)) AS date
      ),
      portfolio_at_date AS (
        SELECT 
          dr.date,
          t.symbol,
          SUM(CASE 
            WHEN t.side = 'BUY' THEN t.quantity 
            WHEN t.side = 'SELL' THEN -t.quantity 
            ELSE 0 
          END) as quantity,
          SAFE_DIVIDE(
            SUM(CASE WHEN t.side = 'BUY' THEN t.quantity * t.price ELSE 0 END),
            SUM(CASE WHEN t.side = 'BUY' THEN t.quantity ELSE 0 END)
          ) as avg_price
        FROM date_range dr
        LEFT JOIN \`${config.projectId}.${this.dataset}.transactions\` t
          ON DATE(t.timestamp) <= dr.date 
          AND t.user_id = @userId
        WHERE t.symbol IS NOT NULL
        GROUP BY dr.date, t.symbol
        HAVING quantity > 0
      )
      SELECT 
        date,
        symbol,
        quantity,
        avg_price
      FROM portfolio_at_date
      ORDER BY date ASC, symbol ASC
    `;
    
    const params = { 
      userId, 
      startDate: startDate.toISOString().split('T')[0], // Format YYYY-MM-DD
      endDate: endDate.toISOString().split('T')[0]
    };
    
    logger.info('Computing portfolio history from transactions', { userId, range, startDate, endDate });
    
    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();
    
    // Grouper par date et calculer la valeur totale avec les vrais prix historiques
    const historyMap = new Map<string, {
      date: Date;
      totalValue: number;
      breakdown: Record<string, { quantity: number; value: number; price: number }>;
    }>();
    
    // Grouper les données par date d'abord
    const dateGroups = new Map<string, { symbol: string; quantity: number; avgPrice: number }[]>();
    rows.forEach((row: any) => {
      const dateKey = row.date.toISOString().split('T')[0];
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)!.push({
        symbol: row.symbol,
        quantity: parseFloat(row.quantity),
        avgPrice: parseFloat(row.avg_price) || 0
      });
    });
    
    // Calculer les prix historiques pour chaque date
    for (const [dateKey, assets] of dateGroups.entries()) {
      const date = new Date(dateKey);
      const symbols = assets.map(a => a.symbol);
      
      try {
        // Récupérer les prix historiques réels pour cette date
        const historicalPrices = await getHistoricalPricesForSymbols(symbols, date);
        
        let totalValue = 0;
        const breakdown: Record<string, { quantity: number; value: number; price: number }> = {};
        
        assets.forEach(asset => {
          // Utiliser le prix historique s'il est disponible, sinon fallback sur avg_price
          const price = historicalPrices[asset.symbol] || asset.avgPrice;
          const value = asset.quantity * price;
          
          breakdown[asset.symbol] = {
            quantity: asset.quantity,
            value,
            price
          };
          
          totalValue += value;
        });
        
        historyMap.set(dateKey, {
          date,
          totalValue,
          breakdown
        });
        
        logger.info('Portfolio calculated for date', { 
          date: dateKey, 
          assets: assets.length, 
          totalValue,
          historicalPricesFound: Object.keys(historicalPrices).length
        });
        
      } catch (error) {
        logger.warn('Failed to get historical prices, using avg prices', { 
          date: dateKey, 
          error: (error as Error).message 
        });
        
        // Fallback: utiliser les prix moyens des transactions
        let totalValue = 0;
        const breakdown: Record<string, { quantity: number; value: number; price: number }> = {};
        
        assets.forEach(asset => {
          const value = asset.quantity * asset.avgPrice;
          breakdown[asset.symbol] = {
            quantity: asset.quantity,
            value,
            price: asset.avgPrice
          };
          totalValue += value;
        });
        
        historyMap.set(dateKey, {
          date,
          totalValue,
          breakdown
        });
      }
    }
    
    const history = Array.from(historyMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    
    logger.info('Portfolio history computed from transactions', { userId, range, pointsCount: history.length });
    return history;
  }

  /**
   * Calculer le portefeuille actuel depuis les transactions
   */
  async getCurrentPortfolioFromTransactions(userId: string): Promise<Record<string, { quantity: number; avgPrice: number }>> {
    const bq = getBigQuery();
    
    const query = `
      SELECT 
        symbol,
        SUM(CASE WHEN side = 'BUY' THEN quantity WHEN side = 'SELL' THEN -quantity ELSE 0 END) as total_quantity,
        SAFE_DIVIDE(
          SUM(CASE WHEN side = 'BUY' THEN quantity * price ELSE 0 END),
          SUM(CASE WHEN side = 'BUY' THEN quantity ELSE 0 END)
        ) as avg_price
      FROM \`${config.projectId}.${this.dataset}.transactions\`
      WHERE user_id = @userId
      GROUP BY symbol
      HAVING total_quantity > 0
    `;
    
    const params = { userId };
    
    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();
    
    const portfolio: Record<string, { quantity: number; avgPrice: number }> = {};
    
    rows.forEach((row: any) => {
      portfolio[row.symbol] = {
        quantity: parseFloat(row.total_quantity),
        avgPrice: parseFloat(row.avg_price) || 0
      };
    });
    
    logger.info('Current portfolio calculated', { userId, assets: Object.keys(portfolio).length });
    return portfolio;
  }
}

// Instance singleton
export const transactionRepo = new TransactionRepo();
export default transactionRepo;

import getBigQuery from '../db/bqClient';
import config from '../config';
import logger from '../logger';

export interface HistoricalPrice {
  date: Date;
  symbol: string;
  token_id: string;
  price: number;
  source: string;
  last_updated: Date;
}

/**
 * Repository pour les prix historiques
 * Accès aux données de la table historical_prices
 */
export class PriceRepo {
  private dataset = 'Cryptopilot';
  
  /**
   * Récupérer les prix historiques pour des symboles sur une période
   */
  async getPricesForSymbols(
    symbols: string[], 
    fromDate: Date, 
    toDate: Date
  ): Promise<Record<string, Record<string, number>>> {
    const bq = getBigQuery();
    
    if (symbols.length === 0) {
      return {};
    }
    
    // Normaliser les symboles en uppercase
    const normalizedSymbols = symbols.map(s => s.toUpperCase());
    const symbolsList = normalizedSymbols.map(s => `'${s}'`).join(', ');
    
    const query = `
      SELECT 
        DATE(date) as date,
        UPPER(symbol) as symbol,
        price
  FROM \`${config.projectId}.${this.dataset}.historical_prices\`
      WHERE UPPER(symbol) IN (${symbolsList})
        AND DATE(date) BETWEEN @fromDate AND @toDate
      ORDER BY date ASC, symbol ASC
    `;
    
    const options = {
      query,
      params: {
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0],
      },
    };
    
    try {
      logger.info('Fetching historical prices', { 
        symbols: normalizedSymbols, 
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0]
      });
      
      const [rows] = await bq.query(options);
      
      // Organiser les données par date puis par symbole
      const pricesByDate: Record<string, Record<string, number>> = {};
      
      for (const row of rows) {
        const dateStr = row.date.value; // BigQuery DATE format
        const symbol = row.symbol;
        const price = parseFloat(row.price);
        
        if (!pricesByDate[dateStr]) {
          pricesByDate[dateStr] = {};
        }
        
        pricesByDate[dateStr][symbol] = price;
      }
      
      logger.info('Historical prices fetched', { 
        datesCount: Object.keys(pricesByDate).length,
        totalPrices: rows.length 
      });
      
      return pricesByDate;
      
    } catch (error) {
      logger.error('Failed to fetch historical prices', { error, symbols: normalizedSymbols });
      throw error;
    }
  }
  
  /**
   * Récupérer le prix d'un symbole pour une date spécifique
   */
  async getPriceForSymbolOnDate(symbol: string, date: Date): Promise<number | null> {
    const prices = await this.getPricesForSymbols([symbol], date, date);
    const dateStr = date.toISOString().split('T')[0];
    
    return prices[dateStr]?.[symbol.toUpperCase()] || null;
  }
  
  /**
   * Insérer des prix historiques en batch (MERGE unique avec UNNEST, gestion des doublons)
   */
  async insertHistoricalPrices(prices: Array<{ date: Date | string, symbol: string, token_id: string, price: number, source?: string, last_updated?: Date }>): Promise<void> {
    const bq = getBigQuery();
    if (!prices.length) {
      logger.info('No historical prices to insert');
      return;
    }

    // Préparer les données pour UNNEST (date en string 'YYYY-MM-DD')
    const rows = prices.map(p => ({
      date: typeof p.date === 'string' ? p.date : p.date.toISOString().split('T')[0],
      symbol: p.symbol.toUpperCase(),
      token_id: p.token_id.toLowerCase(),
      price: p.price,
      source: p.source || 'defillama',
      last_updated: (p.last_updated || new Date()).toISOString().replace('T', ' ').replace('Z', '')
    }));

    // Générer la requête MERGE avec UNNEST
    const query = `
      MERGE \`${config.projectId}.${this.dataset}.historical_prices\` AS target
      USING UNNEST(@rows) AS source
      ON target.date = DATE(source.date)
        AND UPPER(target.symbol) = source.symbol
        AND LOWER(target.token_id) = source.token_id
      WHEN MATCHED THEN
        UPDATE SET
          price = source.price,
          source = source.source,
          last_updated = TIMESTAMP(source.last_updated)
      WHEN NOT MATCHED THEN
        INSERT (date, symbol, token_id, price, source, last_updated)
        VALUES (DATE(source.date), source.symbol, source.token_id, source.price, source.source, TIMESTAMP(source.last_updated))
    `;

    try {
      const options = {
        query,
        params: { rows },
      };
      const [job] = await bq.createQueryJob(options);
      const [result] = await job.getQueryResults();

      logger.info('Historical prices batch MERGE done', {
        count: prices.length,
        symbols: [...new Set(prices.map(p => p.symbol))],
        dateRange: prices.length > 0 ? {
          from: rows[0].date,
          to: rows[rows.length - 1].date
        } : null,
        result
      });
    } catch (error) {
      logger.error('Failed to batch-insert historical prices', {
        error: (error as Error).message,
        count: prices.length
      });
      throw error;
    }
  }
}

// Instance singleton
export const priceRepo = new PriceRepo();

import getBigQuery from '../db/bqClient';
import config from '../config';
import logger from '../logger';

export interface HistoricalPrice {
  date: Date;
  symbol: string;    // UPPERCASE (ex: BTC)
  token_id: string;  // lowercase (ex: coingecko:bitcoin ou équivalent)
  price: number;     // FLOAT64
  source: string;    // 'defillama'...
  last_updated: Date;
}

/**
 * Repository pour les prix historiques
 * Accès aux données de la table historical_prices
 */
export class PriceRepo {
  private dataset = 'Cryptopilot';

  private table() {
    return `\`${config.projectId}.${this.dataset}.historical_prices\``;
  }

  /**
   * Récupérer les prix historiques pour des symboles sur une période
   * Optimisé : IN UNNEST(@symbols) (param tableau) au lieu d'une liste inline.
   */
  async getPricesForSymbols(
    symbols: string[],
    fromDate: Date,
    toDate: Date
  ): Promise<Record<string, Record<string, number>>> {
    const bq = getBigQuery();

    if (!symbols.length) {
      return {};
    }

    // Normalise en UPPER côté SQL (pas besoin de construire la liste en JS)
    const query = `
      SELECT
        DATE(date)                       AS date,
        UPPER(symbol)                    AS symbol,
        CAST(price AS FLOAT64)           AS price
      FROM ${this.table()}
      WHERE UPPER(symbol) IN UNNEST(@symbols)
        AND DATE(date) BETWEEN @fromDate AND @toDate
      ORDER BY date ASC, symbol ASC
    `;

    const params = {
      symbols: Array.from(new Set(symbols.map(s => s.toUpperCase()))),
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0],
    };

    try {
      logger.info('Fetching historical prices', {
        symbols: params.symbols,
        fromDate: params.fromDate,
        toDate: params.toDate,
      });

      const [rows] = await bq.query({ query, params });

      // Organiser les données par date -> symbol -> price
      const pricesByDate: Record<string, Record<string, number>> = {};

      for (const row of rows as any[]) {
        const dateStr: string = row?.date?.value || row?.date; // BQ client peut renvoyer { value } ou string
        const symbol: string = row.symbol;
        const price: number = Number(row.price);

        if (!dateStr || !symbol) continue;

        if (!pricesByDate[dateStr]) {
          pricesByDate[dateStr] = {};
        }
        pricesByDate[dateStr][symbol] = price;
      }

      logger.info('Historical prices fetched', {
        datesCount: Object.keys(pricesByDate).length,
        totalPrices: (rows as any[]).length,
      });

      return pricesByDate;
    } catch (error) {
      logger.error('Failed to fetch historical prices', {
        error,
        symbols: params.symbols,
      });
      throw error;
    }
  }

  /**
   * Récupérer le prix d'un symbole pour une date spécifique
   */
  async getPriceForSymbolOnDate(symbol: string, date: Date): Promise<number | null> {
    const prices = await this.getPricesForSymbols([symbol], date, date);
    const dateStr = date.toISOString().split('T')[0];
    return prices[dateStr]?.[symbol.toUpperCase()] ?? null;
  }

  /**
   * Lister les dates déjà présentes en base pour un symbole sur une plage donnée.
   * Utile pour "sauter" ces dates lors d'un backfill.
   */
  async getExistingDatesForSymbol(
    symbol: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Set<string>> {
    const bq = getBigQuery();

    const query = `
      SELECT DATE(date) AS date
      FROM ${this.table()}
      WHERE UPPER(symbol) = @symbol
        AND DATE(date) BETWEEN @fromDate AND @toDate
      ORDER BY date ASC
    `;

    const params = {
      symbol: symbol.toUpperCase(),
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0],
    };

    const [rows] = await bq.query({ query, params });
    const set = new Set<string>();
    for (const r of rows as any[]) {
      const d: string = r?.date?.value || r?.date;
      if (d) set.add(d);
    }
    return set;
  }

  /**
   * Insertion / mise à jour en batch (MERGE) des prix historiques.
   * Correction majeure : on FORCE les types via un SELECT autour de UNNEST(@rows)
   * pour empêcher BigQuery d'inférer INT64 sur "price" (qui peut être décimal).
   */
  async insertHistoricalPrices(
    prices: Array<{
      date: Date | string;
      symbol: string;
      token_id: string;
      price: number;
      source?: string;
      last_updated?: Date;
    }>
  ): Promise<void> {
    const bq = getBigQuery();
    if (!prices.length) {
      logger.info('No historical prices to insert');
      return;
    }

    // Préparer les données pour UNNEST : normalisation et formats stables
    const rows = prices.map((p) => ({
      date: typeof p.date === 'string' ? p.date : p.date.toISOString().split('T')[0], // 'YYYY-MM-DD'
      symbol: p.symbol.toUpperCase(),
      token_id: p.token_id.toLowerCase(),
      price: Number(p.price),
      source: p.source || 'defillama',
      // On garde un format texte ISO "YYYY-MM-DD HH:MM:SS.sss" qui sera casté en TIMESTAMP côté SQL
      last_updated: (p.last_updated || new Date()).toISOString().replace('T', ' ').replace('Z', ''),
    }));

    // ⚠️ CASTs explicites pour contraindre les types (notamment price → FLOAT64)
    const query = `
      MERGE ${this.table()} AS target
      USING (
        SELECT
          DATE(r.date)               AS date,
          CAST(r.symbol AS STRING)   AS symbol,
          CAST(r.token_id AS STRING) AS token_id,
          CAST(r.price AS FLOAT64)   AS price,
          CAST(r.source AS STRING)   AS source,
          TIMESTAMP(r.last_updated)  AS last_updated
        FROM UNNEST(@rows) AS r
      ) AS source
      ON target.date = source.date
         AND UPPER(target.symbol) = source.symbol
         AND LOWER(target.token_id) = source.token_id
      WHEN MATCHED THEN UPDATE SET
        price        = source.price,
        source       = source.source,
        last_updated = source.last_updated
      WHEN NOT MATCHED THEN
        INSERT (date, symbol, token_id, price, source, last_updated)
        VALUES (source.date, source.symbol, source.token_id, source.price, source.source, source.last_updated)
    `;

    try {
      const [job] = await bq.createQueryJob({
        query,
        params: { rows },
      });
      await job.getQueryResults();

      logger.info('Historical prices batch MERGE done', {
        count: rows.length,
        symbols: [...new Set(rows.map((p) => p.symbol))],
        dateRange: rows.length
          ? { from: rows[0].date, to: rows[rows.length - 1].date }
          : null,
      });
    } catch (error) {
      logger.error('Failed to batch-insert historical prices', {
        error: (error as Error).message,
        count: rows.length,
      });
      throw error;
    }
  }
}

// Instance singleton
export const priceRepo = new PriceRepo();
export default priceRepo;

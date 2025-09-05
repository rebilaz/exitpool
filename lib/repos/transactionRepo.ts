import getBigQuery from "../db/bqClient";
import config from "../config";
import logger from "../logger";

export interface Transaction {
  transaction_id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  price: number;
  side: "BUY" | "SELL" | "TRANSFER";
  timestamp: Date;
  note?: string;
}

export interface AddTransactionData {
  userId: string;
  symbol: string;
  quantity: number;
  price?: number;
  side: "BUY" | "SELL" | "TRANSFER";
  timestamp?: Date;
  note?: string;
  /** Optionnel : si fourni, sera utilisé comme transaction_id (idempotence) */
  clientTxId?: string;
}

export interface PortfolioSnapshot {
  user_id: string;
  date: Date;
  total_value: number;
  breakdown: string; // JSON string
}

export interface SaveSnapshotData {
  date: Date;
  totalValue: number;
  breakdown: Record<string, { quantity: number; value: number; price: number }>;
}

export class TransactionRepo {
  private dataset = "Cryptopilot";

  /**
   * Ajout idempotent (MERGE sur transaction_id).
   * Si clientTxId est fourni, il devient le transaction_id (idempotence côté client).
   */
  async addTransaction(data: AddTransactionData): Promise<string> {
    const bq = getBigQuery();

    const transactionId = data.clientTxId ?? crypto.randomUUID();
    const timestamp = (data.timestamp ?? new Date()).toISOString();

    const query = `
      MERGE \`${config.projectId}.${this.dataset}.transactions\` AS target
      USING (
        SELECT
          @transactionId AS transaction_id,
          @userId AS user_id,
          @symbol AS symbol,
          @quantity AS quantity,
          @price AS price,
          @side AS side,
          TIMESTAMP(@timestamp) AS timestamp,
          @note AS note
      ) AS src
      ON target.transaction_id = src.transaction_id
      WHEN MATCHED THEN UPDATE SET
        user_id   = src.user_id,
        symbol    = src.symbol,
        quantity  = src.quantity,
        price     = src.price,
        side      = src.side,
        timestamp = src.timestamp,
        note      = src.note
      WHEN NOT MATCHED THEN INSERT (
        transaction_id, user_id, symbol, quantity, price, side, timestamp, note
      ) VALUES (
        src.transaction_id, src.user_id, src.symbol, src.quantity, src.price, src.side, src.timestamp, src.note
      )`;

    const params = {
      transactionId,
      userId: data.userId,
      symbol: String(data.symbol).toUpperCase(),
      quantity: data.quantity,
      price: data.price ?? 0,
      side: data.side,
      timestamp,
      note: data.note ?? null,
    };

    logger.info("Adding transaction (MERGE)", {
      userId: data.userId,
      symbol: data.symbol,
      side: data.side,
      transactionId,
    });

    const [job] = await bq.createQueryJob({ query, params });
    await job.getQueryResults();

    logger.info("Transaction upserted", { transactionId, userId: data.userId });
    return transactionId;
  }

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
      SELECT transaction_id, user_id, symbol, quantity, price, side, timestamp, note
      FROM \`${config.projectId}.${this.dataset}.transactions\`
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT @limit
    `;

    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();

    return rows.map((row: any) => ({
      transaction_id: row.transaction_id,
      user_id: row.user_id,
      symbol: row.symbol,
      quantity: Number(row.quantity),
      price: Number(row.price),
      side: row.side,
      timestamp: new Date(row.timestamp.value ?? row.timestamp),
      note: row.note ?? undefined,
    }));
  }

  async getCurrentPortfolioFromTransactions(
    userId: string
  ): Promise<Record<string, { quantity: number; avgPrice: number }>> {
    const bq = getBigQuery();

    const query = `
      SELECT 
        UPPER(symbol) AS symbol,
        SUM(CASE WHEN side = 'BUY' THEN quantity WHEN side = 'SELL' THEN -quantity ELSE 0 END) AS total_quantity,
        SAFE_DIVIDE(
          SUM(CASE WHEN side = 'BUY' THEN quantity * price ELSE 0 END),
          SUM(CASE WHEN side = 'BUY' THEN quantity ELSE 0 END)
        ) AS avg_price
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
        quantity: Number(row.total_quantity),
        avgPrice: Number(row.avg_price) || 0,
      };
    });
    return portfolio;
  }
}

export const transactionRepo = new TransactionRepo();
export default transactionRepo;

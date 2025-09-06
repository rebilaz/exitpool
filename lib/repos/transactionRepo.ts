// lib/repos/transactionRepo.ts
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
  client_tx_id?: string | null;
}

export interface AddTransactionData {
  userId: string;
  symbol: string;
  quantity: number;
  price?: number;
  side: "BUY" | "SELL" | "TRANSFER";
  timestamp?: Date;
  note?: string | null;
  /** Idempotence côté client */
  clientTxId?: string | null;
}

export class TransactionRepo {
  private dataset = "Cryptopilot";

  /**
   * Upsert idempotent via MERGE sur transaction_id.
   * Si clientTxId est fourni, on l’utilise comme transaction_id ET on le stocke dans client_tx_id.
   */
  async addTransaction(data: AddTransactionData): Promise<string> {
    const bq = getBigQuery();

    const transactionId = data.clientTxId ?? crypto.randomUUID();

    // Toujours un timestamp non nul (ISO)
    const tsIso = (data.timestamp ?? new Date()).toISOString();

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
          TIMESTAMP(@tsIso) AS timestamp,
          @note AS note,
          @clientTxId AS client_tx_id
      ) AS src
      ON target.transaction_id = src.transaction_id
      WHEN MATCHED THEN UPDATE SET
        user_id     = src.user_id,
        symbol      = src.symbol,
        quantity    = src.quantity,
        price       = src.price,
        side        = src.side,
        timestamp   = src.timestamp,
        note        = src.note,
        client_tx_id= src.client_tx_id
      WHEN NOT MATCHED THEN INSERT (
        transaction_id, user_id, symbol, quantity, price, side, timestamp, note, client_tx_id
      ) VALUES (
        src.transaction_id, src.user_id, src.symbol, src.quantity, src.price, src.side, src.timestamp, src.note, src.client_tx_id
      )
    `;

    const params = {
      transactionId,
      userId: data.userId,
      symbol: String(data.symbol).toUpperCase(),
      quantity: Number(data.quantity),
      price: data.price != null ? Number(data.price) : 0, // champ REQUIRED
      side: data.side,
      tsIso,
      note: data.note ?? null,
      clientTxId: data.clientTxId ?? null,
    };

    // ➜ BigQuery exige les types pour tout param susceptible d'être null
    const types = {
      transactionId: "STRING",
      userId: "STRING",
      symbol: "STRING",
      quantity: "FLOAT64",
      price: "FLOAT64",
      side: "STRING",
      tsIso: "STRING",       // converti en TIMESTAMP(...) dans la requête
      note: "STRING",        // nullable
      clientTxId: "STRING",  // nullable
    } as const;

    logger.info("Adding transaction (MERGE)", {
      userId: data.userId,
      symbol: params.symbol,
      side: data.side,
      transactionId,
    });

    const [job] = await bq.createQueryJob({ query, params, types });
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
    const types: any = { userId: "STRING", limit: "INT64" };

    if (from) {
      whereClause += ` AND timestamp >= @fromDate`;
      params.fromDate = from.toISOString();
      types.fromDate = "STRING";
    }
    if (to) {
      whereClause += ` AND timestamp <= @toDate`;
      params.toDate = to.toISOString();
      types.toDate = "STRING";
    }

    const query = `
      SELECT transaction_id, user_id, symbol, quantity, price, side, timestamp, note, client_tx_id
      FROM \`${config.projectId}.${this.dataset}.transactions\`
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT @limit
    `;

    const [job] = await bq.createQueryJob({ query, params, types });
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
      client_tx_id: row.client_tx_id ?? null,
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
    const types = { userId: "STRING" as const };

    const [job] = await bq.createQueryJob({ query, params, types });
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

import getBigQuery from "../db/bqClient";
import config from "../config";
import logger from "../logger";

export interface PortfolioSnapshot {
  user_id: string;
  date: Date;
  total_value: number;
  breakdown: Record<string, { quantity: number; value: number; price: number }>;
}

export interface SaveSnapshotData {
  date: Date;
  totalValue: number;
  breakdown: Record<string, { quantity: number; value: number; price: number }>;
}

export class SnapshotRepo {
  private dataset = "Cryptopilot";

  private table() {
    return `\`${config.projectId}.${this.dataset}.portfolio_snapshots\``;
  }

  private normalizeDate(d: Date) {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n;
  }

  private parseBreakdown(raw: any) {
    if (!raw) return {};
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  }

  private mapRow(row: any): PortfolioSnapshot {
    return {
      user_id: row.user_id,
      date: new Date(row.date?.value ?? row.date),
      total_value: Number(row.total_value) || 0,
      breakdown: this.parseBreakdown(row.breakdown),
    };
  }

  async getSnapshotsInRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PortfolioSnapshot[]> {
    const bq = getBigQuery();
    const start = this.normalizeDate(startDate);
    const end = this.normalizeDate(endDate);
    if (start > end) return [];

    const query = `
      SELECT user_id, date, total_value, breakdown
      FROM ${this.table()}
      WHERE user_id = @userId
        AND date >= @startDate
        AND date <= @endDate
      ORDER BY date ASC`;

    const params = {
      userId,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };

    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();
    return rows.map((r) => this.mapRow(r));
  }

  async getSnapshotsByUser(userId: string, range: "7d" | "30d" | "1y") {
    const end = new Date();
    const start = new Date();
    if (range === "7d") start.setDate(end.getDate() - 7);
    else if (range === "30d") start.setDate(end.getDate() - 30);
    else start.setFullYear(end.getFullYear() - 1);
    return this.getSnapshotsInRange(userId, start, end);
  }

  async saveSnapshot(userId: string, data: SaveSnapshotData): Promise<void> {
    const bq = getBigQuery();
    const dateStr =
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : (data.date as unknown as string);

    const query = `
      MERGE ${this.table()} AS target
      USING (
        SELECT @userId AS user_id, DATE(@date) AS date, @totalValue AS total_value, @breakdown AS breakdown
      ) AS source
      ON target.user_id = source.user_id AND target.date = source.date
      WHEN MATCHED THEN UPDATE SET total_value = source.total_value, breakdown = source.breakdown
      WHEN NOT MATCHED THEN INSERT (user_id, date, total_value, breakdown)
        VALUES (source.user_id, source.date, source.total_value, source.breakdown)`;

    const params = {
      userId,
      date: dateStr,
      totalValue: data.totalValue,
      breakdown: JSON.stringify(data.breakdown || {}),
    };
    const [job] = await bq.createQueryJob({ query, params });
    await job.getQueryResults();
  }

  /**
   * Bulk upsert (UNNEST) pour éviter les quotas DML par jour.
   */
  async saveSnapshotsBulk(
    userId: string,
    rows: Array<{ date: Date | string; totalValue: number; breakdown: Record<string, any> }>
  ): Promise<void> {
    if (!rows.length) return;
    const bq = getBigQuery();

    const payload = rows.map((r) => ({
      user_id: userId,
      date: (r.date instanceof Date ? r.date.toISOString().split("T")[0] : r.date) as string,
      total_value: r.totalValue,
      breakdown: JSON.stringify(r.breakdown || {}),
    }));

    const query = `
      MERGE ${this.table()} AS target
      USING UNNEST(@rows) AS src
      ON target.user_id = src.user_id AND target.date = DATE(src.date)
      WHEN MATCHED THEN UPDATE SET
        total_value = src.total_value,
        breakdown = src.breakdown
      WHEN NOT MATCHED THEN INSERT (user_id, date, total_value, breakdown)
        VALUES (src.user_id, DATE(src.date), src.total_value, src.breakdown)
    `;

    const [job] = await bq.createQueryJob({ query, params: { rows: payload } });
    await job.getQueryResults();
    logger.info("Snapshots bulk upserted", { userId, count: payload.length });
  }

  async getSnapshotByDate(userId: string, date: Date) {
    const bq = getBigQuery();
    const d = this.normalizeDate(date);
    const query = `
      SELECT user_id, date, total_value, breakdown
      FROM ${this.table()}
      WHERE user_id = @userId AND date = @date
      LIMIT 1`;
    const params = { userId, date: d.toISOString().split("T")[0] };
    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();
    if (!rows.length) return null;
    return this.mapRow(rows[0]);
  }

  async deleteSnapshotsAfterDate(userId: string, date: Date): Promise<void> {
    const bq = getBigQuery();
    const d = this.normalizeDate(date);
    const query = `DELETE FROM ${this.table()} WHERE user_id = @userId AND date > @date`;
    const params = { userId, date: d.toISOString().split("T")[0] };
    const [job] = await bq.createQueryJob({ query, params });
    await job.getQueryResults();
  }
}

export const snapshotRepo = new SnapshotRepo();

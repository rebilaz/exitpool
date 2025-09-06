import { transactionRepo, type AddTransactionData, type Transaction } from "../repos/transactionRepo";
import { snapshotRepo } from "../repos/snapshotRepo";
import { priceRepo } from "../repos/priceRepo";
import { pricingCentralService } from "./pricingCentralService";
import logger from "../logger";

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
  range: "7d" | "30d" | "1y";
  points: PortfolioHistoryPoint[];
  totalReturn: number;
  totalReturnPercent: number;
}

export class PortfolioService {
  // ===== util =====
  private calculateAssetMetrics(quantity: number, currentPrice: number, avgPrice: number) {
    const value = quantity * currentPrice;
    const invested = quantity * avgPrice;
    const pnl = value - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    return { value, invested, pnl, pnlPercent };
  }

  private normalizeToMidnight(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private calculateDateRange(range: "7d" | "30d" | "1y") {
    const endDate = new Date();
    const startDate = new Date();
    if (range === "7d") startDate.setDate(endDate.getDate() - 7);
    else if (range === "30d") startDate.setDate(endDate.getDate() - 30);
    else startDate.setFullYear(endDate.getFullYear() - 1);
    return { startDate, endDate };
  }

  private createPortfolioAsset(symbol: string, quantity: number, avgPrice: number, currentPrice: number): CurrentPortfolioAsset {
    const metrics = this.calculateAssetMetrics(quantity, currentPrice, avgPrice);
    return { symbol, quantity, avgPrice, currentPrice, ...metrics };
  }

  // ===== public API =====
  // surcharge (compat) : addTransaction(userId, data) ET addTransaction({userId,...})
  async addTransaction(userId: string, data: Omit<AddTransactionData, "userId">): Promise<string>;
  async addTransaction(data: AddTransactionData): Promise<string>;
  async addTransaction(arg1: string | AddTransactionData, arg2?: Omit<AddTransactionData, "userId">): Promise<string> {
    try {
      const payload: AddTransactionData =
        typeof arg1 === "string" ? { ...(arg2 as any), userId: arg1 } : arg1;

      console.info("[PORTFOLIO] addTransaction start", {
        userId: payload.userId,
        symbol: payload.symbol,
        side: payload.side,
        qty: payload.quantity,
        hasPrice: payload.price != null,
        ts: payload.timestamp,
        clientTxId: payload.clientTxId
      });

      // récupérer un prix si manquant (BUY/SELL)
      if ((payload.side === "BUY" || payload.side === "SELL") && (payload.price == null || Number.isNaN(payload.price))) {
        console.info("[PORTFOLIO] price resolution", { mode: "lookup" });
        const prices = await pricingCentralService.getCurrentPrices([payload.symbol]);
        const p = prices[String(payload.symbol).toUpperCase()];
        if (p != null) payload.price = p;
      } else {
        console.info("[PORTFOLIO] price resolution", { mode: "provided" });
      }
      
      const result = await transactionRepo.addTransaction(payload);
      console.info("[PORTFOLIO] transaction upserted", { symbol: payload.symbol });
      
      return result;
    } catch (e: any) {
      console.error("[PORTFOLIO] addTransaction error", { message: (e as Error)?.message, stack: (e as Error)?.stack });
      throw e;
    }
  }

  triggerAfterTransactionJob(input: { userId: string; symbol: string; transactionDate: Date }) {
    setTimeout(() => {
      this.runAfterTransactionJob(input).catch((err) =>
        logger.error("after-transaction job failed", { userId: input.userId, symbol: input.symbol, error: String(err) })
      );
    }, 0);
  }

  private async runAfterTransactionJob(input: { userId: string; symbol: string; transactionDate: Date }) {
    const today = this.normalizeToMidnight(new Date());
    const txDate = this.normalizeToMidnight(input.transactionDate);

    if (txDate < today) {
      await snapshotRepo.deleteSnapshotsAfterDate(input.userId, txDate);
      await this.backfillHistoricalPricesMissingOnly(input.symbol.toUpperCase(), txDate, today, 5);
    }
    await this.updateCurrentSnapshot(input.userId);
  }

  async getCurrentPortfolio(userId: string): Promise<CurrentPortfolio> {
    const positions = await transactionRepo.getCurrentPortfolioFromTransactions(userId);
    if (Object.keys(positions).length === 0) {
      return {
        userId,
        assets: [],
        totalValue: 0,
        totalInvested: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        lastUpdated: new Date(),
      };
    }

    const symbols = Object.keys(positions);
    const currentPrices = await pricingCentralService.getCurrentPrices(symbols);

    const assets: CurrentPortfolioAsset[] = [];
    let totalValue = 0;
    let totalInvested = 0;

    for (const [symbol, pos] of Object.entries(positions)) {
      const cp = currentPrices[symbol] ?? pos.avgPrice;
      const asset = this.createPortfolioAsset(symbol, pos.quantity, pos.avgPrice, cp);
      assets.push(asset);
      totalValue += asset.value;
      totalInvested += asset.invested;
    }

    assets.sort((a, b) => b.value - a.value);
    const totalPnl = totalValue - totalInvested;
    const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return {
      userId,
      assets,
      totalValue,
      totalInvested,
      totalPnl,
      totalPnlPercent,
      lastUpdated: new Date(),
    };
  }

  async getTransactions(userId: string, from?: Date, to?: Date, limit?: number): Promise<Transaction[]> {
    return transactionRepo.getTransactionsByUser(userId, from, to, limit);
  }

  // ===== historique =====
  private generateDaysBetween(startDate: Date, endDate: Date): Date[] {
    const days: Date[] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  private computeDailyPortfolioValues(
    transactions: Transaction[],
    historicalPrices: Record<string, Record<string, number>>,
    startDate: Date,
    endDate: Date
  ): Array<{ date: Date; totalValue: number; breakdown: Record<string, { quantity: number; value: number; price: number }> }> {
    const days = this.generateDaysBetween(startDate, endDate);
    const results: Array<{ date: Date; totalValue: number; breakdown: Record<string, { quantity: number; value: number; price: number }> }> =
      [];

    for (const day of days) {
      const dayStr = day.toISOString().split("T")[0];

      const quantities: Record<string, number> = {};
      for (const tx of transactions) {
        const txDate = this.normalizeToMidnight(tx.timestamp);
        if (txDate <= day) {
          const sym = String(tx.symbol).toUpperCase();
          quantities[sym] = quantities[sym] ?? 0;
          if (tx.side === "BUY") quantities[sym] += tx.quantity;
          else if (tx.side === "SELL") quantities[sym] -= tx.quantity;
        }
      }

      let totalValue = 0;
      const breakdown: Record<string, { quantity: number; value: number; price: number }> = {};
      for (const [sym, qty] of Object.entries(quantities)) {
        if (qty > 0) {
          const price = historicalPrices[dayStr]?.[sym] ?? 0;
          const value = qty * price;
          totalValue += value;
          breakdown[sym] = { quantity: qty, value, price };
        }
      }

      results.push({ date: day, totalValue, breakdown });
    }

    return results;
  }

  async computePortfolioHistory(userId: string, range: "7d" | "30d" | "1y"): Promise<PortfolioHistory> {
    const { startDate, endDate } = this.calculateDateRange(range);

    // 1) snapshots existants (cache)
    const cached = await snapshotRepo.getSnapshotsInRange(userId, startDate, endDate);
    if (cached.length > 0) {
      const points: PortfolioHistoryPoint[] = cached.map((s, i) => {
        const prev = i > 0 ? cached[i - 1] : s;
        const change = s.total_value - prev.total_value;
        const pct = prev.total_value > 0 ? (change / prev.total_value) * 100 : 0;
        return { date: s.date, totalValue: s.total_value, dailyChange: change, dailyChangePercent: pct };
      });
      const totalReturn =
        points.length > 1 ? points[points.length - 1].totalValue - points[0].totalValue : 0;
      const totalReturnPercent =
        points.length > 1 && points[0].totalValue > 0 ? (totalReturn / points[0].totalValue) * 100 : 0;

      return { userId, range, points, totalReturn, totalReturnPercent };
    }

    // 2) calcul depuis transactions + prix historiques
    const allTx = await transactionRepo.getTransactionsByUser(userId, undefined, endDate, 10000);
    if (!allTx.length) {
      const points = this.generateDaysBetween(startDate, endDate).map((d) => ({
        date: d,
        totalValue: 0,
        dailyChange: 0,
        dailyChangePercent: 0,
      }));
      return { userId, range, points, totalReturn: 0, totalReturnPercent: 0 };
    }

    allTx.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const symbols = [...new Set(allTx.map((t) => String(t.symbol).toUpperCase()))];

    const today = this.normalizeToMidnight(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const endHistoryDate = yesterday < endDate ? yesterday : endDate;

    const histPrices = await priceRepo.getPricesForSymbols(symbols, startDate, endHistoryDate);
    const daily = this.computeDailyPortfolioValues(allTx, histPrices, startDate, endHistoryDate);

    const points: PortfolioHistoryPoint[] = daily.map((e, i) => {
      const prev = i > 0 ? daily[i - 1] : e;
      const change = e.totalValue - prev.totalValue;
      const pct = prev.totalValue > 0 ? (change / prev.totalValue) * 100 : 0;
      return { date: e.date, totalValue: e.totalValue, dailyChange: change, dailyChangePercent: pct };
    });

    // Ajout du point "today" depuis snapshot courant
    let todaySnap = await snapshotRepo.getSnapshotByDate(userId, today);
    if (!todaySnap) {
      const current = await this.getCurrentPortfolio(userId);
      await snapshotRepo.saveSnapshot(userId, {
        date: today,
        totalValue: current.totalValue,
        breakdown: Object.fromEntries(
          current.assets.map((a) => [a.symbol, { quantity: a.quantity, value: a.value, price: a.currentPrice }])
        ),
      });
      todaySnap = await snapshotRepo.getSnapshotByDate(userId, today);
    }
    if (todaySnap) {
      const prev = points.length ? points[points.length - 1] : { totalValue: 0 };
      const change = todaySnap.total_value - (prev as any).totalValue;
      const pct = (prev as any).totalValue > 0 ? (change / (prev as any).totalValue) * 100 : 0;
      points.push({ date: today, totalValue: todaySnap.total_value, dailyChange: change, dailyChangePercent: pct });
    }

    // Bulk save des snapshots historisés (jusqu'à yesterday)
    await snapshotRepo.saveSnapshotsBulk(
      userId,
      daily.map((d) => ({ date: d.date, totalValue: d.totalValue, breakdown: d.breakdown }))
    );

    const totalReturn =
      points.length > 1 ? points[points.length - 1].totalValue - points[0].totalValue : 0;
    const totalReturnPercent =
      points.length > 1 && points[0].totalValue > 0 ? (totalReturn / points[0].totalValue) * 100 : 0;

    return { userId, range, points, totalReturn, totalReturnPercent };
  }

  // ===== backfill manquant uniquement =====
  private async backfillHistoricalPricesMissingOnly(symbol: string, from: Date, to: Date, concurrency = 5) {
    const start = this.normalizeToMidnight(from);
    const end = this.normalizeToMidnight(to);

    const existing = new Set(await priceRepo.getExistingDatesForSymbol(symbol, start, end));
    const dates: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      if (!existing.has(key)) dates.push(new Date(d));
    }
    if (!dates.length) return;

    const chunks: Date[][] = [];
    for (let i = 0; i < dates.length; i += concurrency) chunks.push(dates.slice(i, i + concurrency));

    const toInsert: Array<{ date: Date | string; symbol: string; token_id: string; price: number; source?: string; last_updated?: Date }> = [];

    for (const pack of chunks) {
      await Promise.allSettled(
        pack.map(async (d) => {
          const { getHistoricalPricesForSymbols } = await import("./pricingService");
          const prices = await getHistoricalPricesForSymbols([symbol], d);
          const p = prices[symbol.toUpperCase()] ?? prices[symbol];
          if (p != null) {
            toInsert.push({
              date: d,
              symbol: symbol.toUpperCase(),
              token_id: symbol.toLowerCase(),
              price: p,
              source: "defillama",
              last_updated: new Date(),
            });
          }
        })
      );
    }

    if (toInsert.length) {
      await priceRepo.insertHistoricalPrices(toInsert);
    }
  }

  private async updateCurrentSnapshot(userId: string): Promise<void> {
    try {
      const portfolio = await this.getCurrentPortfolio(userId);
      const today = new Date();

      const breakdown: Record<string, { quantity: number; value: number; price: number }> = {};
      for (const a of portfolio.assets) {
        breakdown[a.symbol] = { quantity: a.quantity, value: a.value, price: a.currentPrice };
      }

      await snapshotRepo.saveSnapshot(userId, {
        date: today,
        totalValue: portfolio.totalValue,
        breakdown,
      });
      console.info("[PORTFOLIO] snapshot updated", { scope: "current" });
      logger.info("Current snapshot updated", { userId, totalValue: portfolio.totalValue });
    } catch (error) {
      logger.error("Failed to update current snapshot", { userId, error });
    }
  }
}

export const portfolioService = new PortfolioService();
export default portfolioService;

// lib/jobs/afterTransaction.ts
import logger from "../logger";
import { priceRepo } from "../repos/priceRepo";
import { snapshotRepo } from "../repos/snapshotRepo";
import { portfolioService } from "../services/portfolioService";
import { getHistoricalPricesForSymbols } from "../services/pricingService";

/**
 * Payload du job
 */
export interface AfterTransactionPayload {
  userId: string;
  symbol: string;
  txDate: string | Date;
  rid?: string;
  // Pré-chauffage optionnel si besoin plus tard
  prewarmHistory?: false | "7d" | "30d" | "1y";
}

/**
 * Normalise une date à minuit (UTC)
 */
function normalizeToMidnight(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

/**
 * Génère toutes les dates (UTC) entre deux bornes incluses
 */
function enumerateDays(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * Job asynchrone exécuté après l'ajout d'une transaction:
 *  - backfill des prix historiques manquants pour le symbole entre txDate et today
 *  - mise à jour du snapshot du jour (valorisation temps réel)
 *  - (optionnel) pré-chauffage de l'historique
 */
export async function runAfterTransactionJob(payload: AfterTransactionPayload) {
  const rid = payload.rid ?? crypto.randomUUID().slice(0, 8);
  const log = logger.withRid(rid);

  const userId = String(payload.userId);
  const symbol = String(payload.symbol).toUpperCase();

  // bornes de backfill
  const txDate = normalizeToMidnight(new Date(payload.txDate));
  const today = normalizeToMidnight(new Date());

  log.info("[JOB] after-transaction start", {
    userId,
    symbol,
    txDate: txDate.toISOString().split("T")[0],
    today: today.toISOString().split("T")[0],
  });

  try {
    // 1) Lire ce qu'on a déjà en base pour ce symbole & plage
    const existing = await priceRepo.getPricesForSymbols([symbol], txDate, today);
    const existingDates = new Set(Object.keys(existing)); // "YYYY-MM-DD"

    // 2) Déterminer les dates manquantes
    const missingDates = enumerateDays(txDate, today).filter((d) => {
      const key = d.toISOString().split("T")[0];
      return !existingDates.has(key);
    });

    log.info("[JOB] backfill check", {
      symbol,
      totalDays: enumerateDays(txDate, today).length,
      missingDays: missingDates.length,
    });

    // 3) Pour chaque date manquante, récupérer le prix via pricingService
    //    (on batch-insert ensuite via priceRepo.insertHistoricalPrices)
    const toInsert: Array<{
      date: string;
      symbol: string;
      token_id: string;
      price: number;
      source?: string;
      last_updated?: Date;
    }> = [];

    for (const d of missingDates) {
      const dateStr = d.toISOString().split("T")[0];
      try {
        const prices = await getHistoricalPricesForSymbols([symbol], d, rid);
        const price = prices[symbol];
        if (price != null) {
          toInsert.push({
            date: dateStr,
            symbol,
            token_id: symbol.toLowerCase(),
            price,
            source: "defillama",
            last_updated: new Date(),
          });
          log.info("[JOB] historical price fetched", {
            symbol,
            date: dateStr,
            price,
          });
        } else {
          log.warn("[JOB] no historical price for date", { symbol, date: dateStr });
        }
      } catch (err) {
        log.warn("[JOB] historical fetch error (skip date)", {
          symbol,
          date: dateStr,
          error: (err as Error)?.message,
        });
      }
    }

    if (toInsert.length > 0) {
      await priceRepo.insertHistoricalPrices(toInsert);
      log.info("[JOB] historical prices inserted", {
        symbol,
        count: toInsert.length,
        range: {
          from: txDate.toISOString().split("T")[0],
          to: today.toISOString().split("T")[0],
        },
      });
    } else {
      log.info("[JOB] nothing to insert for historical prices");
    }

    // 4) Met à jour/écrit le snapshot du jour (valorisation actuelle)
    try {
      const current = await portfolioService.getCurrentPortfolio(userId);
      const breakdown = Object.fromEntries(
        (current.assets || []).map((a) => [
          a.symbol,
          { quantity: a.quantity, value: a.value, price: a.currentPrice },
        ])
      );
      await snapshotRepo.saveSnapshot(userId, {
        date: today,
        totalValue: current.totalValue,
        breakdown,
      });
      log.info("[JOB] today snapshot saved", {
        userId,
        totalValue: current.totalValue,
      });
    } catch (err) {
      log.warn("[JOB] snapshot update error (non-blocking)", {
        userId,
        error: (err as Error)?.message,
      });
    }

    // 5) (Optionnel) Pré-chauffer l'historique si demandé
    if (payload.prewarmHistory) {
      try {
        await portfolioService.computePortfolioHistory(userId, payload.prewarmHistory);
        log.info("[JOB] history prewarmed", {
          userId,
          range: payload.prewarmHistory,
        });
      } catch (err) {
        // On journalise, mais on ne fait pas échouer le job
        log.warn("[JOB] history prewarm failed (non-blocking)", {
          userId,
          range: payload.prewarmHistory,
          error: (err as Error)?.message,
        });
      }
    }

    log.info("[JOB] after-transaction done", { userId, symbol });
  } catch (error) {
    logger.error("[JOB] after-transaction fatal error", {
      rid,
      userId,
      symbol,
      error: (error as Error)?.message,
    });
    throw error;
  }
}

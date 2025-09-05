import { getPricesForSymbols } from "./pricingService";
import logger from "../logger";

export class PricingCentralService {
  async getCurrentPrices(symbols: string[]): Promise<Record<string, number>> {
    if (!symbols.length) return {};
    try {
      const prices = await getPricesForSymbols(symbols);
      logger.info("Prices fetched successfully", {
        symbols: symbols.length,
        pricesReturned: Object.keys(prices).length,
      });
      return prices;
    } catch (error) {
      logger.error("Error fetching prices", { error, symbols });
      return {};
    }
  }

  async getPriceForSymbol(symbol: string): Promise<number | null> {
    const prices = await this.getCurrentPrices([symbol]);
    return prices[String(symbol).toUpperCase()] ?? null;
  }

  async checkPricesAvailability(symbols: string[]) {
    const prices = await this.getCurrentPrices(symbols);
    const available = Object.keys(prices);
    const missing = symbols.map((s) => String(s).toUpperCase()).filter((s) => !prices[s]);
    return { available, missing, success: missing.length === 0 };
  }
}

export const pricingCentralService = new PricingCentralService();
export default pricingCentralService;

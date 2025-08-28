export interface PriceProvider {
  /** Fetch current USD prices keyed by original DeFiLlama id */
  getCurrentPrices(defillamaIds: string[], rid?: string): Promise<Record<string, number>>;
}

export default PriceProvider;

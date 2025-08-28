// Shared domain types

export type Symbol = string; // always uppercase externally

export interface TokenRow {
  symbol: string; // uppercase
  defillama_id: string; // e.g. 'bitcoin' or 'ethereum' (mapped from id column)
}

export type PriceMap = Record<string, number>; // SYMBOL -> price USD

export interface Config {
  projectId: string;
  bq: {
    dataset: string;
    table: string;
    location: string;
  };
  credentials?: {
    keyFilename?: string; // path style
    keyJsonObject?: Record<string, unknown>; // inline JSON if provided
  };
  defillamaBase: string;
}

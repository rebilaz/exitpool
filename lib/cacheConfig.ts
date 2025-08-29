// Configuration centralisée pour les caches et intervals
export const cacheConfig = {
  staleTime: {
    prices: 30 * 1000,        // 30 secondes
    portfolio: 30 * 1000,      // 30 secondes 
    transactions: 5 * 60 * 1000, // 5 minutes
    history: 10 * 60 * 1000,   // 10 minutes
    symbols: 30 * 60 * 1000,   // 30 minutes
  },
  refetchInterval: {
    prices: 30 * 1000,         // 30 secondes
    portfolio: 60 * 1000,      // 1 minute
    realtime: 10 * 1000,       // 10 secondes (pour les prix en temps réel)
  },
  debounce: {
    search: 300,      // ms pour les recherches
    input: 500,       // ms pour les inputs généraux
  },
} as const;

export default cacheConfig;

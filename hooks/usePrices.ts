"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheConfig } from '../lib/cacheConfig';

export interface PriceData {
  [symbol: string]: number;
}

interface UsePricesOptions {
  symbols: string[];
  refreshInterval?: number; // en millisecondes, défaut depuis config
  enabled?: boolean;
}

interface UsePricesReturn {
  prices: PriceData;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function usePrices({ 
  symbols, 
  refreshInterval = cacheConfig.refetchInterval.prices,
  enabled = true 
}: UsePricesOptions): UsePricesReturn {
  const [prices, setPrices] = useState<PriceData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPrices = useCallback(async (forceRefresh = false) => {
    if (!enabled || symbols.length === 0) return;

    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const symbolsParam = symbols.join(',');
      const url = `/api/prices?symbols=${encodeURIComponent(symbolsParam)}${forceRefresh ? '&_t=' + Date.now() : ''}`;
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': forceRefresh ? 'no-cache, no-store, must-revalidate' : 'no-cache',
          'Pragma': forceRefresh ? 'no-cache' : '',
          'Expires': forceRefresh ? '0' : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setPrices(data.prices);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || 'Erreur inconnue');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Requête annulée, ne pas traiter comme une erreur
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la récupération des prix';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [symbols, enabled]); // Dépendances stables

  // Fonction de rafraîchissement manuel
  const refresh = useCallback(async () => {
    await fetchPrices(true); // Force refresh avec timestamp
  }, [fetchPrices]);

  // Effet pour la récupération initiale et l'intervalle
  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      setPrices({});
      setLastUpdated(null);
      setError(null);
      return;
    }

    // Récupération initiale
    fetchPrices();

    // Configuration de l'intervalle
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchPrices();
      }, refreshInterval);
    }

    // Nettoyage
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [symbols.join(','), refreshInterval, enabled]); // Utilisation de symbols.join(',') pour éviter les références d'array

  // Nettoyage au démontage du composant
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    prices,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}

"use client";

import { useState, useEffect, useCallback } from 'react';
import { cacheConfig } from '../lib/cacheConfig';

export interface SymbolSuggestion {
  symbol: string;
  name: string | null;
  coingecko_id: string;
}

interface UseSymbolSuggestionsReturn {
  suggestions: SymbolSuggestion[];
  loading: boolean;
  error: string | null;
}

export function useSymbolSuggestions(query: string): UseSymbolSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/symbols/suggestions?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success) {
        setSuggestions(data.suggestions || []);
      } else {
        throw new Error(data.error || 'Erreur lors de la recherche');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchSuggestions(query);
    }, cacheConfig.debounce.search);

    return () => clearTimeout(timeoutId);
  }, [query, fetchSuggestions]);

  return {
    suggestions,
    loading,
    error,
  };
}

"use client";

import { useState, useMemo } from 'react';
import { ChartRange } from '../components/PortfolioChart';
import { 
  useCurrentPortfolio, 
  usePortfolioHistory, 
  useAddTransaction,
  useInvalidatePortfolio 
} from './usePortfolio';
import { usePrices } from './usePrices';
import { cacheConfig } from '../lib/cacheConfig';

interface UsePortfolioPageOptions {
  userId: string;
  historyRange?: '7d' | '30d' | '1y';
  priceRefreshInterval?: number;
}

export function usePortfolioPage({ 
  userId, 
  historyRange = '30d',
  priceRefreshInterval = 30000 
}: UsePortfolioPageOptions) {
  
  // États UI locaux uniquement
  const [showAdd, setShowAdd] = useState(false);
  const [chartRange, setChartRange] = useState<ChartRange>('1Y');
  
  // Données centralisées via React Query
  const currentPortfolio = useCurrentPortfolio(userId);
  const portfolioHistory = usePortfolioHistory(userId, historyRange);
  const addTransaction = useAddTransaction();
  const invalidatePortfolio = useInvalidatePortfolio();
  
  // Récupération des prix uniquement pour les assets du portfolio
  const symbols = useMemo(() => {
    return currentPortfolio.data?.assets.map(asset => asset.symbol) || [];
  }, [currentPortfolio.data?.assets]);
  
  const prices = usePrices({ 
    symbols,
    refreshInterval: priceRefreshInterval,
    enabled: symbols.length > 0 
  });

  // Données calculées
  const totalValue = currentPortfolio.data?.totalValue || 0;
  const assets = currentPortfolio.data?.assets || [];
  
  // Actions centralisées
  const handleAddTransaction = async (data: {
    symbol: string;
    quantity: number;
    price?: number;
    side?: 'BUY' | 'SELL' | 'TRANSFER';
    note?: string;
  }) => {
    const result = await addTransaction.mutateAsync({
      userId,
      symbol: data.symbol.toUpperCase(),
      quantity: data.quantity,
      price: data.price,
      side: data.side || 'BUY',
      note: data.note,
    });
    
    if (result.success) {
      setShowAdd(false);
    }
    
    return result;
  };

  const handleRefresh = () => {
    prices.refresh();
    invalidatePortfolio(userId);
  };

  return {
    // Données
    assets,
    totalValue,
    portfolioHistory: portfolioHistory.data,
    prices: prices.prices,
    
    // États de chargement
    loading: {
      portfolio: currentPortfolio.isLoading,
      history: portfolioHistory.isLoading,
      prices: prices.loading,
      addTransaction: addTransaction.isPending,
    },
    
    // Erreurs
    error: {
      portfolio: currentPortfolio.error,
      history: portfolioHistory.error,
      prices: prices.error,
      addTransaction: addTransaction.error,
    },
    
    // États UI
    showAdd,
    setShowAdd,
    chartRange,
    setChartRange,
    
    // Actions
    handleAddTransaction,
    handleRefresh,
    lastUpdated: prices.lastUpdated,
  };
}

"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  type Transaction, 
  type AddTransactionData 
} from '../lib/repos/transactionRepo';
import { 
  type CurrentPortfolio, 
  type PortfolioHistory 
} from '../lib/services/portfolioService';
import { cacheConfig } from '../lib/cacheConfig';

// Types pour les API calls
interface AddTransactionRequest {
  userId: string;
  symbol: string;
  quantity: number;
  price?: number;
  side: 'BUY' | 'SELL' | 'TRANSFER';
  note?: string;
  timestamp?: string; // ISO string pour la date
}

interface AddTransactionResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
}

interface TransactionsResponse {
  success: boolean;
  transactions?: Transaction[];
  error?: string;
}

interface CurrentPortfolioResponse {
  success: boolean;
  portfolio?: CurrentPortfolio;
  error?: string;
}

interface PortfolioHistoryResponse {
  success: boolean;
  history?: PortfolioHistory;
  error?: string;
}

/**
 * Hook pour ajouter une transaction
 */
export function useAddTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: AddTransactionRequest): Promise<AddTransactionResponse> => {
      const response = await fetch('/api/transactions/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      return response.json();
    },
    onSuccess: (data: AddTransactionResponse, variables: AddTransactionRequest) => {
      if (data.success) {
        // Invalider les caches liés aux transactions et portefeuille
        queryClient.invalidateQueries({ 
          queryKey: ['transactions', variables.userId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['portfolio', 'current', variables.userId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['portfolio', 'history', variables.userId] 
        });
      }
    },
  });
}

/**
 * Hook pour récupérer les transactions d'un utilisateur
 */
export function useTransactions(userId: string, limit?: number) {
  return useQuery({
    queryKey: ['transactions', userId, limit],
    queryFn: async (): Promise<Transaction[]> => {
      const params = new URLSearchParams({ userId });
      if (limit) params.append('limit', limit.toString());
      
      const response = await fetch(`/api/transactions?${params}`);
      const data: TransactionsResponse = await response.json();
      
      if (!data.success || !data.transactions) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
      
      return data.transactions;
    },
    enabled: !!userId,
    staleTime: cacheConfig.staleTime.transactions,
  });
}

/**
 * Hook pour récupérer le portefeuille actuel
 */
export function useCurrentPortfolio(userId: string) {
  return useQuery({
    queryKey: ['portfolio', 'current', userId],
    queryFn: async (): Promise<CurrentPortfolio> => {
      const params = new URLSearchParams({ userId });
      
      const response = await fetch(`/api/portfolio/current?${params}`);
      const data: CurrentPortfolioResponse = await response.json();
      
      if (!data.success || !data.portfolio) {
        throw new Error(data.error || 'Failed to fetch current portfolio');
      }
      
      return data.portfolio;
    },
    enabled: !!userId,
    staleTime: cacheConfig.staleTime.portfolio,
    refetchInterval: cacheConfig.refetchInterval.portfolio,
  });
}

/**
 * Hook pour récupérer l'historique du portefeuille
 */
export function usePortfolioHistory(userId: string, range: '7d' | '30d' | '1y') {
  return useQuery({
    queryKey: ['portfolio', 'history', userId, range],
    queryFn: async (): Promise<PortfolioHistory> => {
      const params = new URLSearchParams({ userId, range });
      
      const response = await fetch(`/api/portfolio/history?${params}`);
      const data: PortfolioHistoryResponse = await response.json();
      
      if (!data.success || !data.history) {
        throw new Error(data.error || 'Failed to fetch portfolio history');
      }
      
      return data.history;
    },
    enabled: !!userId && !!range,
    staleTime: cacheConfig.staleTime.history,
  });
}

/**
 * Hook pour invalider le cache du portefeuille
 * Utile après des actions externes qui modifient le portefeuille
 */
export function useInvalidatePortfolio() {
  const queryClient = useQueryClient();
  
  return (userId: string) => {
    queryClient.invalidateQueries({ 
      queryKey: ['portfolio', 'current', userId] 
    });
    queryClient.invalidateQueries({ 
      queryKey: ['portfolio', 'history', userId] 
    });
    queryClient.invalidateQueries({ 
      queryKey: ['transactions', userId] 
    });
  };
}

/**
 * Hook combiné pour récupérer les données principales d'un utilisateur
 */
export function useUserPortfolioData(userId: string, historyRange: '7d' | '30d' | '1y' = '30d') {
  const transactions = useTransactions(userId, 50);
  const currentPortfolio = useCurrentPortfolio(userId);
  const portfolioHistory = usePortfolioHistory(userId, historyRange);
  
  return {
    transactions,
    currentPortfolio,
    portfolioHistory,
    isLoading: transactions.isLoading || currentPortfolio.isLoading || portfolioHistory.isLoading,
    error: transactions.error || currentPortfolio.error || portfolioHistory.error,
  };
}

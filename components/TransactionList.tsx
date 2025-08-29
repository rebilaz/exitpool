"use client";

import { Transaction } from '@/lib/repos/transactionRepo';

interface TransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

export function TransactionList({ transactions, isLoading }: TransactionListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-24"></div>
                <div className="h-3 bg-gray-300 rounded w-32"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-20"></div>
                <div className="h-3 bg-gray-300 rounded w-16"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Aucune transaction trouvée</p>
        <p className="text-sm mt-1">Ajoutez votre première transaction pour commencer</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <div key={transaction.transaction_id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <div className="flex items-center space-x-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
              transaction.side === 'BUY' ? 'bg-green-500' : 
              transaction.side === 'SELL' ? 'bg-red-500' : 'bg-blue-500'
            }`}>
              {transaction.side === 'BUY' ? '+' : transaction.side === 'SELL' ? '-' : '→'}
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-900">{transaction.symbol}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  transaction.side === 'BUY' ? 'bg-green-100 text-green-800' : 
                  transaction.side === 'SELL' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {transaction.side}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {new Date(transaction.timestamp).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="font-semibold text-gray-900">
              {transaction.quantity.toLocaleString('fr-FR', { 
                minimumFractionDigits: 0,
                maximumFractionDigits: 8
              })}
            </div>
            {transaction.price && (
              <div className="text-sm text-gray-600">
                ${transaction.price.toLocaleString('fr-FR', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6
                })}
              </div>
            )}
          </div>
          
          {transaction.price && (
            <div className="text-right min-w-[100px]">
              <div className="font-semibold text-gray-900">
                ${(transaction.quantity * transaction.price).toLocaleString('fr-FR', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface TransactionSummaryProps {
  transactions: Transaction[];
}

export function TransactionSummary({ transactions }: TransactionSummaryProps) {
  const totalTransactions = transactions.length;
  const buyTransactions = transactions.filter(t => t.side === 'BUY').length;
  const sellTransactions = transactions.filter(t => t.side === 'SELL').length;
  
  const totalInvested = transactions
    .filter(t => t.side === 'BUY' && t.price)
    .reduce((sum, t) => sum + (t.quantity * t.price!), 0);
    
  const totalSold = transactions
    .filter(t => t.side === 'SELL' && t.price)
    .reduce((sum, t) => sum + (t.quantity * t.price!), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="text-2xl font-bold text-gray-900">{totalTransactions}</div>
        <div className="text-sm text-gray-600">Total transactions</div>
      </div>
      
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="text-2xl font-bold text-green-600">{buyTransactions}</div>
        <div className="text-sm text-gray-600">Achats</div>
      </div>
      
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="text-2xl font-bold text-red-600">{sellTransactions}</div>
        <div className="text-sm text-gray-600">Ventes</div>
      </div>
      
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="text-2xl font-bold text-blue-600">
          ${(totalInvested - totalSold).toLocaleString('fr-FR', { 
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          })}
        </div>
        <div className="text-sm text-gray-600">Investi net</div>
      </div>
    </div>
  );
}

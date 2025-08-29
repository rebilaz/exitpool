"use client";

import { useState } from 'react';
import { CurrentPortfolioDisplay } from "@/components/PortfolioDisplay";
import { TransactionList, TransactionSummary } from "@/components/TransactionList";
import { SymbolAutocomplete } from "@/components/SymbolAutocomplete";
import { useUserPortfolioData, useAddTransaction } from "@/hooks/usePortfolio";

// Mock user ID - dans une vraie app, viendrait de l'auth
const MOCK_USER_ID = "test-user-123";

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'transactions'>('portfolio');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Hooks pour les données utilisateur
  const { 
    currentPortfolio, 
    transactions, 
    isLoading 
  } = useUserPortfolioData(MOCK_USER_ID, '30d');
  
  const addTransactionMutation = useAddTransaction();

  // État du formulaire d'ajout de transaction
  const [transactionForm, setTransactionForm] = useState({
    symbol: '',
    quantity: '',
    price: '',
    side: 'BUY' as 'BUY' | 'SELL' | 'TRANSFER',
    note: '',
    date: new Date().toISOString().split('T')[0] // Date d'aujourd'hui par défaut
  });

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transactionForm.symbol || !transactionForm.quantity) {
      alert('Veuillez remplir au moins le symbole et la quantité');
      return;
    }

    try {
      const result = await addTransactionMutation.mutateAsync({
        userId: MOCK_USER_ID,
        symbol: transactionForm.symbol.toUpperCase(),
        quantity: parseFloat(transactionForm.quantity),
        price: transactionForm.price ? parseFloat(transactionForm.price) : undefined,
        side: transactionForm.side,
        note: transactionForm.note || undefined,
        timestamp: transactionForm.date ? new Date(transactionForm.date + 'T12:00:00').toISOString() : undefined
      });

      if (result.success) {
        setShowAddModal(false);
        setTransactionForm({
          symbol: '',
          quantity: '',
          price: '',
          side: 'BUY',
          note: '',
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        alert('Erreur lors de l\'ajout de la transaction: ' + result.error);
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Erreur lors de l\'ajout de la transaction');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CryptoPilot</h1>
            <p className="text-gray-600 mt-1">Gérez votre portefeuille crypto</p>
          </div>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Ajouter transaction
          </button>
        </div>

        {/* Navigation tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'portfolio'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Portefeuille
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Transactions
            </button>
          </nav>
        </div>

        {/* Contenu principal */}
        {activeTab === 'portfolio' && (
          <>
            {currentPortfolio.data ? (
              <CurrentPortfolioDisplay 
                portfolio={currentPortfolio.data} 
                isLoading={currentPortfolio.isLoading}
              />
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Portefeuille vide</h3>
                <p className="text-gray-600 mb-4">Ajoutez votre première transaction pour voir votre portefeuille</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Ajouter ma première transaction
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'transactions' && (
          <div>
            {transactions.data && transactions.data.length > 0 && (
              <TransactionSummary transactions={transactions.data} />
            )}
            <TransactionList 
              transactions={transactions.data || []} 
              isLoading={transactions.isLoading}
            />
          </div>
        )}

        {/* Modal d'ajout de transaction */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Ajouter une transaction</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Symbole *
                  </label>
                  <SymbolAutocomplete
                    value={transactionForm.symbol}
                    onChange={(value) => setTransactionForm(prev => ({ ...prev, symbol: value }))}
                    placeholder="ex: BTC, ETH, SOL..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type *
                    </label>
                    <select
                      value={transactionForm.side}
                      onChange={(e) => setTransactionForm(prev => ({ 
                        ...prev, 
                        side: e.target.value as 'BUY' | 'SELL' | 'TRANSFER' 
                      }))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="BUY">Achat</option>
                      <option value="SELL">Vente</option>
                      <option value="TRANSFER">Transfert</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantité *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={transactionForm.quantity}
                      onChange={(e) => setTransactionForm(prev => ({ ...prev, quantity: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prix (optionnel)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={transactionForm.price}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Prix unitaire en USD"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={transactionForm.date}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    max={new Date().toISOString().split('T')[0]} // Empêcher les dates futures
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Si vous ajoutez une transaction dans le passé, l'historique sera recalculé
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Note (optionnel)
                  </label>
                  <textarea
                    value={transactionForm.note}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, note: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    placeholder="Note sur cette transaction..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={addTransactionMutation.isPending}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {addTransactionMutation.isPending ? 'Ajout...' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2">Debug Info</h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <div>User ID: {MOCK_USER_ID}</div>
              <div>Portfolio Loading: {currentPortfolio.isLoading ? 'Yes' : 'No'}</div>
              <div>Transactions Loading: {transactions.isLoading ? 'Yes' : 'No'}</div>
              <div>Portfolio Assets: {currentPortfolio.data?.assets?.length || 0}</div>
              <div>Total Transactions: {transactions.data?.length || 0}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

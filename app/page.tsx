"use client";

import { useState, useMemo, useEffect } from 'react';
import PortfolioMain, { PortfolioAsset } from "../components/PortfolioMain";
import PortfolioChart, { ChartRange } from "../components/PortfolioChart";
import ValueHero from "../components/ValueHero";
import TimeRangeTabs, { TimeRange } from "../components/TimeRangeTabs";
import ChatbotWidget from "../components/ChatbotWidget";
import PriceStatus from "../components/PriceStatus";
import RefreshSettings from "../components/RefreshSettings";
import { SymbolAutocomplete } from "../components/SymbolAutocomplete";
import { usePrices } from "../hooks/usePrices";
import { useCurrentPortfolio, useAddTransaction } from "../hooks/usePortfolio";

export default function Home() {
  // Utiliser l'user_id réel qui a des transactions
  const userId = '0181b8c0-0b0a-7000-8000-000000000000'; // User ID réel avec des données
  
  // Récupérer le vrai portfolio depuis BigQuery
  const { 
    data: currentPortfolio, 
    isLoading: portfolioLoading, 
    error: portfolioError,
    refetch: refetchPortfolio
  } = useCurrentPortfolio(userId);

  // Hook pour récupérer les prix en temps réel avec l'ancien système
  const symbols = useMemo(() => {
    if (!currentPortfolio?.assets) return [];
    return currentPortfolio.assets.map(asset => asset.symbol);
  }, [currentPortfolio]);
  
  const { prices, loading, error, lastUpdated, refresh } = usePrices({ 
    symbols,
    refreshInterval: 30000,
    enabled: true 
  });

  // Convertir les données du portfolio en format compatible avec PortfolioMain
  const assets: PortfolioAsset[] = useMemo(() => {
    if (!currentPortfolio?.assets) return [];
    
    return currentPortfolio.assets.map((asset, index) => ({
      id: `${asset.symbol}-${index}`,
      symbol: asset.symbol,
      name: asset.symbol, // On pourrait enrichir avec les vrais noms plus tard
      quantity: asset.quantity,
      price: prices[asset.symbol] || asset.currentPrice || 0, // Utiliser les prix de l'ancien système en priorité
      avgPrice: asset.avgPrice // Prix moyen depuis BigQuery
    }));
  }, [currentPortfolio, prices]); // Ajouter prices dans les dépendances

  const [showAdd, setShowAdd] = useState(false);
  const [range, setRange] = useState<ChartRange>('1Y');
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 secondes par défaut

  // Utiliser les valeurs du vrai portfolio ou valeurs par défaut si pas de données
  const totalValue = useMemo(() => {
    if (currentPortfolio) {
      return currentPortfolio.totalValue;
    }
    return assets.reduce((acc, a) => acc + a.quantity * a.price, 0);
  }, [currentPortfolio, assets]);

  const pnl24h = currentPortfolio?.totalPnl || 0;
  const pnlYTD = currentPortfolio?.totalPnl || 0; // On pourrait calculer le YTD différemment

  // Hook pour ajouter des transactions
  const addTransactionMutation = useAddTransaction();

  // Plus besoin de removeAsset car on ne peut plus supprimer arbitrairement des assets réels

  // Simple input states for adding a transaction/position
  const [symbol, setSymbol] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY'); // Nouveau state pour le type de transaction
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const addPosition = async () => {
    if (!symbol || !qty) return;
    const s = symbol.toUpperCase();
    const q = parseFloat(qty);
    if (Number.isNaN(q) || q === 0) return;

    setIsAdding(true);
    setAddStatus('idle');

    try {
      await addTransactionMutation.mutateAsync({
        userId,
        symbol: s,
        quantity: q, // On garde la valeur telle quelle (positive ou négative)
        price: price ? parseFloat(price) : undefined,
        side: side, // Utilise le side sélectionné
        note: 'Ajouté depuis la page d\'accueil',
        timestamp: transactionDate ? new Date(transactionDate + 'T12:00:00').toISOString() : undefined
      });

      setAddStatus('success');
      // Rafraîchir le portfolio après l'ajout
      refetchPortfolio();
      
      // Réinitialiser le formulaire après un délai
      setTimeout(() => {
        setSymbol(''); 
        setQty(''); 
        setPrice(''); 
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setSide('BUY'); // Reset à BUY
        setShowAdd(false);
        setAddStatus('idle');
      }, 1500);
      
    } catch (error) {
      setAddStatus('error');
      console.error('Erreur lors de l\'ajout de la transaction:', error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-screen-xl px-4 pb-10 pt-4 md:pt-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🚀</span>
            <span className="text-lg font-semibold text-gray-900">CryptoPilot</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50">Login</button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-gray-800">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Ajouter transaction
            </button>
          </div>
        </header>

        {/* HERO */}
        <div className="mb-8">
          <ValueHero totalValue={totalValue} pnl24h={pnl24h} pnlYTD={pnlYTD} assetsCount={assets.length} />
        </div>

        {/* Portfolio en grand */}
        <section className="col-span-12 flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-gray-900">Portefeuille</h2>
              <div className="flex items-center gap-4">
                <PriceStatus 
                  loading={loading}
                  error={error}
                  lastUpdated={lastUpdated}
                  onRefresh={refresh}
                />
                <RefreshSettings
                  currentInterval={refreshInterval}
                  onIntervalChange={setRefreshInterval}
                  loading={loading}
                />
                {Object.keys(prices).length > 0 && (
                  <div className="text-[10px] text-blue-600 max-w-40 truncate" title={JSON.stringify(prices)}>
                    Debug: {Object.keys(prices).length} prix
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50">Importer</button>
              <button onClick={() => setShowAdd(true)} className="rounded-md bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-gray-800">Nouvelle position</button>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-lg">
            <PortfolioMain 
              assets={assets} 
              onRemove={() => {}} 
              pricesLoading={loading || portfolioLoading}
              lastPriceUpdate={lastUpdated}
            />
          </div>
        </section>

        {/* Chart en grand */}
        <section className="col-span-12 flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-gray-900">Évolution du portefeuille</h2>
              <span className="text-[12px] text-gray-500">Powered by CryptoPilot</span>
            </div>
            <TimeRangeTabs value={range as TimeRange} onChange={r => setRange(r as ChartRange)} />
          </div>
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-lg">
            <PortfolioChart range={range} userId="0181b8c0-0b0a-7000-8000-000000000000" />
          </div>
        </section>
      </div>

      {/* Add transaction panel (modal style w/ translucent backdrop) */}
      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg overflow-visible">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Ajouter une transaction</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-700">Symbole</label>
                <SymbolAutocomplete
                  value={symbol}
                  onChange={setSymbol}
                  onSelect={(suggestion) => {
                    setSymbol(suggestion.symbol);
                  }}
                  placeholder="BTC, ETH, SOL..."
                  className="text-sm text-gray-900"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Quantité
                  </label>
                  <input 
                    type="number" 
                    value={qty} 
                    onChange={e => setQty(e.target.value)} 
                    placeholder="0.5 (négatif pour vente)" 
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30" 
                  />
                </div>
                <div className="w-full sm:w-40 sm:flex-[0.5]">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Prix <span className="text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  <input 
                    type="number" 
                    value={price} 
                    onChange={e => setPrice(e.target.value)} 
                    placeholder="Prix du marché" 
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30" 
                  />
                </div>
              </div>
              
              {/* Toggle BUY/SELL */}
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-medium text-gray-700">
                  Type de transaction
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSide('BUY')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 ${
                      side === 'BUY'
                        ? 'bg-green-50 text-green-700 border border-green-200 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                    }`}
                  >
                    ACHAT
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide('SELL')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 ${
                      side === 'SELL'
                        ? 'bg-red-50 text-red-700 border border-red-200 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                    }`}
                  >
                    VENTE
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-medium text-gray-700">
                  Date de la transaction
                </label>
                <input 
                  type="date" 
                  value={transactionDate} 
                  onChange={e => setTransactionDate(e.target.value)} 
                  max={new Date().toISOString().split('T')[0]} // Empêcher les dates futures
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30" 
                />
              </div>
              <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-md">
                💡 <strong>ACHAT</strong> : Quantité positive (ex: 0.5) ou négative (ex: -0.5)<br/>
                💡 <strong>VENTE</strong> : Quantité positive (ex: 0.5) ou négative (ex: -0.5)<br/>
                Si aucun prix n'est spécifié, le prix actuel du marché sera utilisé. Pour les dates dans le passé, l'historique sera recalculé automatiquement.
              </div>
              
              {/* Status feedback */}
              {addStatus === 'success' && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 p-3 rounded-md flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Transaction ajoutée avec succès !
                </div>
              )}
              
              {addStatus === 'error' && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-md flex items-center gap-2">
                  <span className="text-red-500">✗</span>
                  Erreur lors de l'ajout de la transaction. Veuillez réessayer.
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setShowAdd(false)} 
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isAdding}
              >
                Annuler
              </button>
              <button 
                onClick={addPosition} 
                disabled={isAdding || !symbol || !qty}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAdding && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isAdding ? 'Ajout en cours...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot Widget */}
      <ChatbotWidget />
    </main>
  );
}

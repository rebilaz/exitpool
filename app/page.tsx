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

export default function Home() {
  // Mock assets state (could be lifted further or persisted later)
  const [assets, setAssets] = useState<PortfolioAsset[]>([
    { id: '1', symbol: 'BTC', name: 'Bitcoin', quantity: 0.42, price: 62000 },
    { id: '2', symbol: 'ETH', name: 'Ethereum', quantity: 5, price: 3200 },
    { id: '3', symbol: 'SOL', name: 'Solana', quantity: 50, price: 170 },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [range, setRange] = useState<ChartRange>('1Y');
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 secondes par défaut

  // Debug: log initial
  // Hook pour récupérer les prix en temps réel
  const symbols = useMemo(() => assets.map(asset => asset.symbol), [assets]);
  
  const { prices, loading, error, lastUpdated, refresh } = usePrices({ 
    symbols,
    refreshInterval: 30000,
    enabled: true 
  });

  // Mise à jour des prix des assets quand on reçoit de nouveaux prix
  useEffect(() => {
    if (Object.keys(prices).length > 0) {
      setAssets(currentAssets => 
        currentAssets.map(asset => {
          const newPrice = prices[asset.symbol];
          if (newPrice && newPrice !== asset.price) {
            return { ...asset, price: newPrice };
          }
          return asset;
        })
      );
    }
  }, [prices]);

  const totalValue = useMemo(() => assets.reduce((acc, a) => acc + a.quantity * a.price, 0), [assets]);
  // Simple mock deltas
  const pnl24h = Math.round(totalValue * 0.012); // +1.2% assume
  const pnlYTD = Math.round(totalValue * 0.18); // +18% assume

  const removeAsset = (id: string) => setAssets(a => a.filter(x => x.id !== id));

  // Simple input states for adding a transaction/position
  const [symbol, setSymbol] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

  const addPosition = async () => {
    if (!symbol || !qty) return;
    const s = symbol.toUpperCase();
    const q = parseFloat(qty);
    if (Number.isNaN(q)) return;

    try {
      // Utiliser l'API réelle pour ajouter la transaction
      const transactionData = {
        userId: 'test-user-123', // User ID temporaire
        symbol: s,
        quantity: q,
        price: price ? parseFloat(price) : undefined,
        side: 'BUY',
        note: 'Ajouté depuis la page d\'accueil',
        timestamp: transactionDate ? new Date(transactionDate + 'T12:00:00').toISOString() : undefined
      };

      const response = await fetch('/api/transactions/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      const result = await response.json();
      
      if (result.success) {
        // Réinitialiser le formulaire
        setSymbol(''); 
        setQty(''); 
        setPrice(''); 
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setShowAdd(false);
        
        // Afficher un message de succès
        alert('Transaction ajoutée avec succès !');
        
        // Note: Pour une vraie app, on pourrait aussi invalider les caches React Query ici
        // et/ou déclencher un refresh des données du portfolio
        
      } else {
        alert('Erreur lors de l\'ajout de la transaction: ' + result.error);
      }
      
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la transaction:', error);
      alert('Erreur lors de l\'ajout de la transaction');
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

        {/* Portfolio & Chart sections */}
        <div className="grid grid-cols-12 gap-6">
          {/* Portfolio first */}
            <section className="col-span-12 xl:col-span-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h2 className="text-sm font-semibold text-gray-900">Portefeuille</h2>
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
                    {/* Debug: affichage des prix bruts */}
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
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <PortfolioMain 
                  assets={assets} 
                  onRemove={removeAsset} 
                  pricesLoading={loading}
                  lastPriceUpdate={lastUpdated}
                />
              </div>
            </section>

            {/* Chart second */}
            <section className="col-span-12 xl:col-span-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-gray-900">Portfolio Value</h2>
                  <span className="text-[11px] text-gray-500">Powered by CryptoPilot</span>
                </div>
                <TimeRangeTabs value={range as TimeRange} onChange={r => setRange(r as ChartRange)} />
              </div>
              <PortfolioChart range={range} userId="test-user-123" />
            </section>
        </div>
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
                    placeholder="0.5" 
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
                💡 Cette transaction sera ajoutée à votre portefeuille BigQuery. Si aucun prix n'est spécifié, le prix actuel du marché sera utilisé. Pour les dates dans le passé, l'historique sera recalculé automatiquement.
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setShowAdd(false)} 
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={addPosition} 
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Ajouter
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

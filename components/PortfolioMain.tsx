"use client";

import { useState, useEffect, useRef, useMemo } from 'react';

export interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  avgPrice?: number; // Prix moyen d'achat
}

interface PortfolioMainProps {
  assets: PortfolioAsset[];
  onRemove?: (id: string) => void;
  pricesLoading?: boolean;
  lastPriceUpdate?: Date | null;
}

interface PriceChange {
  [symbol: string]: {
    previous: number;
    current: number;
    direction: 'up' | 'down' | 'neutral';
  };
}

export default function PortfolioMain({ assets, onRemove, pricesLoading }: PortfolioMainProps) {
  const [priceChanges, setPriceChanges] = useState<PriceChange>({});
  const prevPricesRef = useRef<Record<string, number>>({});
  const [showAllWeights, setShowAllWeights] = useState(false);

  // Tracker les changements de prix pour l'animation (sans boucle)
  useEffect(() => {
    const timeouts: number[] = [];
    assets.forEach(asset => {
      const prev = prevPricesRef.current[asset.symbol];
      const cur = asset.price;
      if (prev !== undefined && prev !== cur) {
        setPriceChanges(prevState => ({
          ...prevState,
          [asset.symbol]: {
            previous: prev,
            current: cur,
            direction: cur > prev ? 'up' : cur < prev ? 'down' : 'neutral'
          }
        }));
        const t = window.setTimeout(() => {
          setPriceChanges(prevState => ({
            ...prevState,
            [asset.symbol]: { ...prevState[asset.symbol], direction: 'neutral' }
          }));
        }, 2000);
        timeouts.push(t);
      }
      prevPricesRef.current[asset.symbol] = cur;
    });
    return () => { timeouts.forEach(clearTimeout); };
  }, [assets]);

  const totalValue = assets.reduce((acc, a) => acc + a.quantity * a.price, 0);
  const weight = (a: PortfolioAsset) => (totalValue === 0 ? 0 : (a.quantity * a.price * 100) / totalValue);

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);

  // Quantités : 2 décimales pour < 1000, sinon abréviations k/M/B (2 décimales)
  const fmtQty = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000)     return `${(n/1_000_000).toFixed(2)}M`;
    if (abs >= 1_000)         return `${(n/1_000).toFixed(2)}k`;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  };

  // Tri par valeur pour afficher Top 3 proportions
  const sortedByWeight = useMemo(
    () => [...assets].sort((a,b) => (b.quantity*b.price) - (a.quantity*a.price)),
    [assets]
  );
  const top3 = useMemo(() => sortedByWeight.slice(0, 3), [sortedByWeight]);

  const getPriceClassName = (symbol: string) => {
    const change = priceChanges[symbol];
    if (!change) return 'text-gray-900';
    switch (change.direction) {
      case 'up': return 'text-green-600 animate-pulse';
      case 'down': return 'text-red-600 animate-pulse';
      default: return 'text-gray-900';
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        {/* Tableau plus lisible */}
        <table className="w-full text-base">
          <thead className="bg-gray-50 text-sm uppercase text-gray-600">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Actif</th>
              <th className="px-4 py-3 font-medium">Qté</th>
              <th className="px-4 py-3 font-medium">Prix</th>
              <th className="px-4 py-3 font-medium">Prix Moy.</th>
              <th className="px-4 py-3 font-medium">Valeur</th>
              <th className="px-4 py-3 font-medium">Poids</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assets.map(a => {
              const val = a.quantity * a.price;
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 text-base leading-snug">{a.symbol}</span>
                      <span className="text-sm text-gray-500">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-base text-gray-900">{fmtQty(a.quantity)}</td>
                  <td className={`px-4 py-3 text-base transition-colors ${getPriceClassName(a.symbol)} ${pricesLoading ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-2">
                      {fmtCurrency(a.price)}
                      {pricesLoading && (
                        <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-base text-gray-900">
                    {a.avgPrice ? fmtCurrency(a.avgPrice) : '-'}
                  </td>
                  <td className="px-4 py-3 text-base font-semibold text-gray-900">{fmtCurrency(val)}</td>
                  <td className="px-4 py-3 text-base text-gray-900">{Math.round(weight(a))}%</td>
                  <td className="px-4 py-3 text-base">
                    {onRemove && (
                      <button
                        onClick={() => onRemove(a.id)}
                        className="text-rose-600 hover:text-rose-700"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Proportions – Top 3 + bouton + */}
      <div className="space-y-3">
        {top3.map(a => (
          <div key={a.id} className="flex items-center gap-4">
            <span className="w-14 text-right text-sm font-medium text-gray-700">{a.symbol}</span>
            <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${weight(a)}%` }} />
            </div>
            <span className="w-14 text-sm text-gray-700 text-right">{Math.round(weight(a))}%</span>
          </div>
        ))}
        {assets.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAllWeights(true)}
            className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-800 text-base hover:bg-gray-50"
            aria-label="Voir toutes les proportions"
            title="Voir toutes les proportions"
          >+</button>
        )}
      </div>

      {/* Modal : toutes les proportions */}
      {showAllWeights && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAllWeights(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold text-gray-900">Répartition complète</h4>
              <button onClick={() => setShowAllWeights(false)} className="text-base text-gray-600 hover:text-gray-900">Fermer</button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
              {sortedByWeight.map(a => (
                <div key={a.id} className="flex items-center gap-4">
                  <span className="w-16 text-right text-sm font-medium text-gray-700">{a.symbol}</span>
                  <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gray-900/80" style={{ width: `${weight(a)}%` }} />
                  </div>
                  <span className="w-14 text-sm text-gray-700 text-right">{Math.round(weight(a))}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';

export interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
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

export default function PortfolioMain({ assets, onRemove, pricesLoading, lastPriceUpdate }: PortfolioMainProps) {
  const [priceChanges, setPriceChanges] = useState<PriceChange>({});

  // Tracker les changements de prix pour l'animation
  useEffect(() => {
    assets.forEach(asset => {
      const previous = priceChanges[asset.symbol]?.current ?? asset.price;
      if (previous !== asset.price) {
        setPriceChanges(prev => ({
          ...prev,
          [asset.symbol]: {
            previous,
            current: asset.price,
            direction: asset.price > previous ? 'up' : asset.price < previous ? 'down' : 'neutral'
          }
        }));

        // Reset l'animation après 2 secondes
        setTimeout(() => {
          setPriceChanges(prev => ({
            ...prev,
            [asset.symbol]: {
              ...prev[asset.symbol],
              direction: 'neutral'
            }
          }));
        }, 2000);
      }
    });
  }, [assets, priceChanges]);

  const totalValue = assets.reduce((acc, a) => acc + a.quantity * a.price, 0);
  const weight = (a: PortfolioAsset) => (totalValue === 0 ? 0 : (a.quantity * a.price * 100) / totalValue);
  const fmtCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);

  const getPriceClassName = (symbol: string) => {
    const change = priceChanges[symbol];
    if (!change) return 'text-gray-700';
    
    switch (change.direction) {
      case 'up': return 'text-green-600 animate-pulse';
      case 'down': return 'text-red-600 animate-pulse';
      default: return 'text-gray-700';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Actif</th>
              <th className="px-3 py-2 font-medium">Qté</th>
              <th className="px-3 py-2 font-medium">Prix</th>
              <th className="px-3 py-2 font-medium">Valeur</th>
              <th className="px-3 py-2 font-medium">Poids</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assets.map(a => {
              const val = a.quantity * a.price;
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 text-xs leading-snug">{a.symbol}</span>
                      <span className="text-[11px] text-gray-500">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{a.quantity}</td>
                  <td className={`px-3 py-2 text-xs transition-colors ${getPriceClassName(a.symbol)} ${pricesLoading ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-1">
                      {fmtCurrency(a.price)}
                      {pricesLoading && (
                        <div className="animate-spin h-2 w-2 border border-gray-400 border-t-transparent rounded-full" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-gray-900">{fmtCurrency(val)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{Math.round(weight(a))}%</td>
                  <td className="px-3 py-2 text-xs">
                    {onRemove && (
                      <button
                        onClick={() => onRemove(a.id)}
                        className="text-rose-600 transition-colors hover:text-rose-700"
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
      <div className="space-y-2">
        {assets.map(a => (
          <div key={a.id} className="flex items-center gap-3">
            <span className="w-10 text-right text-[11px] font-medium text-gray-600">{a.symbol}</span>
            <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${weight(a)}%` }} />
            </div>
            <span className="w-10 text-[11px] text-gray-500 text-right">{Math.round(weight(a))}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";
import React from 'react';

interface ValueHeroProps {
  totalValue: number;
  pnl24h: number; // absolute P&L 24h in USD
  pnlYTD: number; // absolute P&L YTD in USD
  assetsCount: number;
}

const fmtCurrency = (v: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, ...opts }).format(v);

const pct = (base: number, delta: number) => (base === 0 ? 0 : (delta / (base - delta)) * 100);

export const ValueHero: React.FC<ValueHeroProps> = ({ totalValue, pnl24h, pnlYTD, assetsCount }) => {
  const base24h = totalValue - pnl24h;
  const baseYTD = totalValue - pnlYTD;
  const pct24 = pct(totalValue, pnl24h);
  const pctYear = pct(totalValue, pnlYTD);
  const color24 = pnl24h >= 0 ? 'text-emerald-600' : 'text-rose-600';
  const colorYTD = pnlYTD >= 0 ? 'text-emerald-600' : 'text-rose-600';

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium tracking-wide text-gray-500">Valeur Totale du Portefeuille</h2>
        <div className="text-4xl font-semibold tracking-tight text-gray-900">{fmtCurrency(totalValue)}</div>
        <div className="text-xs text-gray-500">{assetsCount} actif{assetsCount > 1 && 's'} suivi{assetsCount > 1 && 's'} (mock)</div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">P&L 24h</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-sm font-semibold ${color24}`}>{pnl24h >= 0 ? '+' : ''}{fmtCurrency(Math.abs(pnl24h), { maximumFractionDigits: 0 })}</span>
            <span className={`text-[11px] ${color24}`}>{pct24 >= 0 ? '+' : ''}{pct24.toFixed(2)}%</span>
          </div>
          <span className="text-[10px] text-gray-400">Base {fmtCurrency(base24h)}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">P&L YTD</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-sm font-semibold ${colorYTD}`}>{pnlYTD >= 0 ? '+' : ''}{fmtCurrency(Math.abs(pnlYTD), { maximumFractionDigits: 0 })}</span>
              <span className={`text-[11px] ${colorYTD}`}>{pctYear >= 0 ? '+' : ''}{pctYear.toFixed(2)}%</span>
            </div>
            <span className="text-[10px] text-gray-400">Base {fmtCurrency(baseYTD)}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Actifs</span>
          <span className="text-xl font-semibold text-gray-900">{assetsCount}</span>
          <span className="text-[10px] text-gray-400">Données simulées</span>
        </div>
      </div>
    </section>
  );
};

export default ValueHero;

'use client';

import { useState } from 'react';

interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number; // prix moyen pondéré stocké localement
}

interface FormState {
  symbol: string;
  quantity: string;
  price: string;
}

const baseCardHeading = 'text-lg font-semibold text-gray-900';

export default function PortfolioMain() {
  const [assets, setAssets] = useState<CryptoAsset[]>([
    { id: '1', symbol: 'BTC', name: 'Bitcoin', quantity: 0.1, price: 112_449 },
    { id: '2', symbol: 'ETH', name: 'Ethereum', quantity: 1, price: 4_479.38 },
    { id: '3', symbol: 'SOL', name: 'Solana', quantity: 5, price: 209.67 },
  ]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ symbol: '', quantity: '', price: '' });

  const totalValue = assets.reduce((acc, a) => acc + a.quantity * a.price, 0);
  const weight = (a: CryptoAsset) => (totalValue === 0 ? 0 : (a.quantity * a.price * 100) / totalValue);

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);

  const handleAdd = () => {
    if (!form.symbol || !form.quantity || !form.price) return;
    const symbol = form.symbol.toUpperCase();
    const quantity = parseFloat(form.quantity);
    const price = parseFloat(form.price);
    if (Number.isNaN(quantity) || Number.isNaN(price)) return;

    setAssets(prev => {
      const idx = prev.findIndex(a => a.symbol === symbol);
      if (idx >= 0) {
        const copy = [...prev];
        const existing = copy[idx];
        const newQty = existing.quantity + quantity;
        const newAvg = (existing.quantity * existing.price + quantity * price) / newQty;
        copy[idx] = { ...existing, quantity: newQty, price: newAvg };
        return copy;
      }
      return [...prev, { id: Date.now().toString(), symbol, name: symbol, quantity, price }];
    });
    setForm({ symbol: '', quantity: '', price: '' });
    setFormOpen(false);
  };

  const remove = (id: string) => setAssets(a => a.filter(x => x.id !== id));

  return (
    <div className="flex flex-col gap-4">
      {/* Header row inside card */}
      <div className="flex items-start justify-between">
        <h2 className={baseCardHeading}>Portfolio</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Total</span>
          <span className="text-2xl font-semibold text-gray-900 leading-none">{fmtCurrency(totalValue)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{assets.length} actif{assets.length > 1 && 's'} • valeurs mockées</p>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Nouvelle
        </button>
      </div>

      {/* Table */}
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
                  <td className="px-3 py-2 text-xs text-gray-700">{fmtCurrency(a.price)}</td>
                  <td className="px-3 py-2 text-xs font-medium text-gray-900">{fmtCurrency(val)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{Math.round(weight(a))}%</td>
                  <td className="px-3 py-2 text-xs">
                    <button
                      onClick={() => remove(a.id)}
                      className="text-rose-600 transition-colors hover:text-rose-700"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Allocation bars */}
      <div className="space-y-2">
        {assets.map(a => (
          <div key={a.id} className="flex items-center gap-3">
            <span className="w-10 text-right text-[11px] font-medium text-gray-600">{a.symbol}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${weight(a)}%` }} />
            </div>
            <span className="w-10 text-[11px] text-gray-500 text-right">{Math.round(weight(a))}%</span>
          </div>
        ))}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" onClick={() => setFormOpen(false)}>
          <div
            className="w-full max-w-xs rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Nouvelle position</h3>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">Symbole</label>
                <input
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="BTC"
                  value={form.symbol}
                  onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">Quantité</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">Prix</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >Annuler</button>
              <button
                onClick={handleAdd}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

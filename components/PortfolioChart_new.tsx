'use client';

import React, { useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { usePortfolioHistory } from '../hooks/usePortfolio';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export type ChartRange = '1D' | '1W' | '1M' | 'YTD' | '1Y';

// Fonction pour mapper les ranges du composant vers celles de l'API
const mapRangeToAPI = (range: ChartRange): '7d' | '30d' | '1y' => {
  switch (range) {
    case '1D':
    case '1W':
      return '7d';
    case '1M':
      return '30d';
    case 'YTD':
    case '1Y':
    default:
      return '1y';
  }
};

// --- Utilitaires formatage ---
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
};

// Tooltip sobre / compact
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="rounded-md bg-white px-2.5 py-2 text-xs shadow-sm border border-gray-200">
      <p className="mb-0.5 text-[10px] font-medium tracking-wide text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">{fmtCurrency(v)}</p>
    </div>
  );
};

interface PortfolioChartProps { 
  range: ChartRange; 
  userId?: string; // Rendre userId optionnel avec une valeur par défaut
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({ range, userId = "test-user-123" }) => {
  // Utiliser les vraies données du portefeuille - PLUS DE MOCK
  const apiRange = mapRangeToAPI(range);
  const { data: portfolioHistory, isLoading, error } = usePortfolioHistory(userId, apiRange);

  const portfolioData = useMemo(() => {
    // Utiliser UNIQUEMENT les vraies données - supprimer le fallback mock
    if (portfolioHistory?.points && portfolioHistory.points.length > 0) {
      return portfolioHistory.points.map(point => {
        const date = new Date(point.date);
        let name: string;
        
        // Formatter la date selon le range
        switch (range) {
          case '1D':
            name = format(date, 'HH:mm', { locale: fr });
            break;
          case '1W':
            name = format(date, 'EEE', { locale: fr });
            break;
          case '1M':
            name = format(date, 'd', { locale: fr });
            break;
          case 'YTD':
          case '1Y':
            name = format(date, 'MMM', { locale: fr });
            break;
          default:
            name = format(date, 'MMM', { locale: fr });
        }
        
        return {
          name,
          value: point.totalValue
        };
      });
    }

    // Si pas de données, retourner un tableau vide (pas de mock)
    return [];
  }, [range, portfolioHistory]);

  const last = portfolioData.at(-1)?.value ?? 0;
  const prev = portfolioData.at(-2)?.value ?? last;
  const deltaPct = prev ? ((last - prev) / prev) * 100 : 0;
  const deltaColor = deltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600';

  // Gestion des états de chargement et d'erreur
  if (isLoading) {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-center h-[320px]">
          <div className="text-gray-500">Chargement des données historiques...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-center h-[320px]">
          <div className="text-red-500">Erreur lors du chargement des données</div>
        </div>
      </div>
    );
  }

  // Si aucune donnée, afficher un message informatif
  if (portfolioData.length === 0) {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-center h-[320px]">
          <div className="text-gray-500">Aucune donnée disponible pour cette période</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-1 text-2xl font-semibold text-gray-900">{fmtCurrency(last)}</div>
      <div className="mb-3 text-xs text-gray-500 flex items-center gap-2">
        <span className={`font-medium ${deltaColor}`}>
          {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(2)}%
        </span>
        <span className="text-gray-300">•</span>
        {range} performance
      </div>
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={portfolioData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0A84FF" stopOpacity={0.10} />
                <stop offset="100%" stopColor="#4F9BFF" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} dy={6} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v: number) => fmtShort(v)} width={50} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#0A84FF', strokeWidth: 1, strokeDasharray: '4 4' }} wrapperStyle={{ outline: 'none' }} />
            <Area type="monotone" dataKey="value" stroke="none" fill="url(#areaGradient)" fillOpacity={1} />
            <Line type="monotone" dataKey="value" stroke="#0A84FF" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#0A84FF', stroke: '#fff', strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default PortfolioChart;

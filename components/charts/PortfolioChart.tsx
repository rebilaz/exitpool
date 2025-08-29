"use client";

import { usePortfolioHistory } from '@/hooks/usePortfolio';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PortfolioChartProps {
  userId: string;
  range: '7d' | '30d' | '1y';
  className?: string;
}

interface ChartDataPoint {
  date: string;
  dateFormatted: string;
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(dateStr: string, range: '7d' | '30d' | '1y'): string {
  const date = new Date(dateStr);
  
  switch (range) {
    case '7d':
      return format(date, 'EEE dd', { locale: fr }); // "Lun 01"
    case '30d':
      return format(date, 'dd/MM', { locale: fr }); // "01/08"
    case '1y':
      return format(date, 'MMM yyyy', { locale: fr }); // "Août 2025"
    default:
      return format(date, 'dd/MM', { locale: fr });
  }
}

export function PortfolioChart({ userId, range, className = "" }: PortfolioChartProps) {
  const { data: portfolioHistory, isLoading, error } = usePortfolioHistory(userId, range);

  if (isLoading) {
    return (
      <div className={`w-full h-64 flex items-center justify-center bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (error || !portfolioHistory) {
    return (
      <div className={`w-full h-64 flex items-center justify-center bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="text-red-500 text-2xl mb-2">📊</div>
          <p className="text-sm text-gray-600">Impossible de charger l'historique</p>
          <p className="text-xs text-gray-500 mt-1">
            {error instanceof Error ? error.message : 'Erreur inconnue'}
          </p>
        </div>
      </div>
    );
  }

  if (!portfolioHistory.points || portfolioHistory.points.length === 0) {
    return (
      <div className={`w-full h-64 flex items-center justify-center bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 text-2xl mb-2">📈</div>
          <p className="text-sm text-gray-600">Aucune donnée disponible</p>
          <p className="text-xs text-gray-500 mt-1">
            Ajoutez des transactions pour voir l'évolution
          </p>
        </div>
      </div>
    );
  }

  // Préparer les données pour le graphique
  const chartData: ChartDataPoint[] = portfolioHistory.points.map(point => {
    const dateStr = point.date instanceof Date 
      ? point.date.toISOString().split('T')[0] 
      : point.date;
    
    return {
      date: dateStr,
      dateFormatted: formatDate(dateStr, range),
      totalValue: point.totalValue,
      dailyChange: point.dailyChange,
      dailyChangePercent: point.dailyChangePercent
    };
  });

  // Calculer les min/max pour l'axe Y avec une marge
  const values = chartData.map(d => d.totalValue);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const margin = (maxValue - minValue) * 0.1; // 10% de marge
  const yAxisMin = Math.max(0, minValue - margin);
  const yAxisMax = maxValue + margin;

  // Déterminer la couleur de la ligne basée sur la performance globale
  const totalReturn = portfolioHistory.totalReturn || 0;
  const lineColor = totalReturn >= 0 ? '#10b981' : '#ef4444'; // green-500 : red-500

  return (
    <div className={`w-full ${className}`}>
      {/* Header avec performance */}
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Évolution du portefeuille
          </h3>
          <p className="text-xs text-gray-500">
            {range === '7d' && '7 derniers jours'}
            {range === '30d' && '30 derniers jours'}
            {range === '1y' && '1 an'}
          </p>
        </div>
        
        <div className="text-right">
          <div className={`text-sm font-semibold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
          </div>
          <div className={`text-xs ${portfolioHistory.totalReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {portfolioHistory.totalReturnPercent >= 0 ? '+' : ''}{portfolioHistory.totalReturnPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Graphique */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: 10,
              bottom: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis 
              dataKey="dateFormatted"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={{ stroke: '#d1d5db' }}
              axisLine={{ stroke: '#d1d5db' }}
            />
            <YAxis 
              domain={[yAxisMin, yAxisMax]}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={{ stroke: '#d1d5db' }}
              axisLine={{ stroke: '#d1d5db' }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as ChartDataPoint;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="text-xs text-gray-600 mb-1">{label}</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(data.totalValue)}
                      </p>
                      <p className={`text-xs ${data.dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.dailyChange >= 0 ? '+' : ''}{formatCurrency(data.dailyChange)} 
                        ({data.dailyChangePercent >= 0 ? '+' : ''}{data.dailyChangePercent.toFixed(2)}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line 
              type="monotone" 
              dataKey="totalValue" 
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: lineColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PortfolioChart;

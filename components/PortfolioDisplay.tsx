"use client";

import { CurrentPortfolio, CurrentPortfolioAsset } from '@/lib/services/portfolioService';

interface CurrentPortfolioProps {
  portfolio: CurrentPortfolio;
  isLoading?: boolean;
}

export function CurrentPortfolioDisplay({ portfolio, isLoading }: CurrentPortfolioProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 p-4 rounded-lg">
                <div className="h-6 bg-gray-300 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-24"></div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-100 p-4 rounded-lg h-20"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (portfolio.assets.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <div className="text-gray-400 text-6xl mb-4">📊</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Portefeuille vide</h3>
        <p className="text-gray-600 mb-4">Ajoutez votre première transaction pour voir votre portefeuille</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Résumé du portefeuille */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Portefeuille actuel</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-3xl font-bold text-gray-900">
              ${portfolio.totalValue.toLocaleString('fr-FR', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </div>
            <div className="text-sm text-gray-600 mt-1">Valeur totale</div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-3xl font-bold text-gray-900">
              ${portfolio.totalInvested.toLocaleString('fr-FR', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </div>
            <div className="text-sm text-gray-600 mt-1">Investi</div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className={`text-3xl font-bold ${portfolio.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(portfolio.totalPnl).toLocaleString('fr-FR', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {portfolio.totalPnl >= 0 ? 'Gain' : 'Perte'}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className={`text-3xl font-bold ${portfolio.totalPnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolio.totalPnlPercent >= 0 ? '+' : ''}
              {portfolio.totalPnlPercent.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Performance</div>
          </div>
        </div>
      </div>

      {/* Assets détaillés */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par asset</h3>
        <div className="space-y-3">
          {portfolio.assets
            .sort((a, b) => b.value - a.value) // Trier par valeur décroissante
            .map((asset) => (
              <AssetCard 
                key={asset.symbol} 
                asset={asset} 
                totalPortfolioValue={portfolio.totalValue}
              />
            ))}
        </div>
      </div>
      
      {/* Dernière mise à jour */}
      <div className="text-center text-sm text-gray-500">
        Dernière mise à jour: {new Date(portfolio.lastUpdated).toLocaleString('fr-FR')}
      </div>
    </div>
  );
}

interface AssetCardProps {
  asset: CurrentPortfolioAsset;
  totalPortfolioValue?: number;
}

function AssetCard({ asset, totalPortfolioValue }: AssetCardProps) {
  
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="font-bold text-blue-600">{asset.symbol.slice(0, 2)}</span>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 text-lg">{asset.symbol}</h4>
            <div className="text-sm text-gray-600">
              {asset.quantity.toLocaleString('fr-FR', { 
                minimumFractionDigits: 0,
                maximumFractionDigits: 8
              })} tokens
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="font-semibold text-gray-900 text-lg">
            ${asset.value.toLocaleString('fr-FR', { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
          <div className="text-sm text-gray-600">
            ${asset.currentPrice.toLocaleString('fr-FR', { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 6
            })} par token
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-sm">
            <span className="text-gray-600">Prix moyen: </span>
            <span className="font-medium">
              ${asset.avgPrice.toLocaleString('fr-FR', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
              })}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            asset.pnl >= 0 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {asset.pnl >= 0 ? '+' : ''}${Math.abs(asset.pnl).toLocaleString('fr-FR', { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
          
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            asset.pnlPercent >= 0 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {asset.pnlPercent >= 0 ? '+' : ''}{asset.pnlPercent.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}

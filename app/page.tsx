"use client";

import { useState, useMemo } from 'react';
import { useSession } from "next-auth/react";
import { PortfolioAsset } from "../components/PortfolioMain";
import { ChartRange } from "../components/PortfolioChart";
import PortfolioSection, { usePortfolioChartData } from "../components/PortfolioSection";
import PortfolioChart from "../components/PortfolioChart";
import ValueHero from "../components/ValueHero";
import TimeRangeTabs, { TimeRange } from "../components/TimeRangeTabs";
import ChatbotWidget from "../components/ChatbotWidget";
import PriceStatus from "../components/PriceStatus";
import RefreshSettings from "../components/RefreshSettings";
import { usePrices } from "../hooks/usePrices";
import { useCurrentPortfolio } from "../hooks/usePortfolio";
import TransactionForm from "@/components/ui/TransactionForm";

export default function Home() {
  // Récupérer la session NextAuth
  const { data: session } = useSession();

  // Utiliser l'ID permanent s'il existe, sinon fallback sur cp_temp_user_id
  const userId =
    session?.user?.id ??
    (typeof window !== "undefined"
      ? localStorage.getItem("cp_temp_user_id")
      : "") ??
    "";

  // Récupérer le vrai portfolio depuis BigQuery
  const {
    data: currentPortfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = useCurrentPortfolio(userId);

  // Hook pour récupérer les prix en temps réel
  const symbols = useMemo(() => {
    if (!currentPortfolio?.assets) return [];
    return currentPortfolio.assets.map((asset) => asset.symbol);
  }, [currentPortfolio]);

  const { prices, loading, error, lastUpdated, refresh } = usePrices({
    symbols,
    refreshInterval: 30000,
    enabled: true,
  });

  // Convertir les données du portfolio pour PortfolioMain
  const assets: PortfolioAsset[] = useMemo(() => {
    if (!currentPortfolio?.assets) return [];

    return currentPortfolio.assets.map((asset, index) => ({
      id: `${asset.symbol}-${index}`,
      symbol: asset.symbol,
      name: asset.symbol, // On pourra enrichir avec les vrais noms
      quantity: asset.quantity,
      price: prices[asset.symbol] || asset.currentPrice || 0,
      avgPrice: asset.avgPrice,
    }));
  }, [currentPortfolio, prices]);

  const [showAdd, setShowAdd] = useState(false);
  const [range, setRange] = useState<ChartRange>("1Y");
  const [refreshInterval, setRefreshInterval] = useState(30000);

  // Valeur totale
  const totalValue = useMemo(() => {
    if (currentPortfolio) {
      return currentPortfolio.totalValue;
    }
    return assets.reduce((acc, a) => acc + a.quantity * a.price, 0);
  }, [currentPortfolio, assets]);

  const pnl24h = currentPortfolio?.totalPnl || 0;
  const pnlYTD = currentPortfolio?.totalPnl || 0;

  // Données synchronisées pour le chart
  const { todayValue, lastUpdatedLabel } = usePortfolioChartData(assets, lastUpdated);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-screen-xl px-4 pb-10 pt-4 md:pt-6">
        {/* HERO */}
        <div className="mb-8">
          <ValueHero
            totalValue={totalValue}
            pnl24h={pnl24h}
            pnlYTD={pnlYTD}
            assetsCount={assets.length}
          />
        </div>

        {/* Portfolio */}
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
                  <div
                    className="text-[10px] text-blue-600 max-w-40 truncate"
                    title={JSON.stringify(prices)}
                  >
                    Debug: {Object.keys(prices).length} prix
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                Importer
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-gray-800"
              >
                Nouvelle position
              </button>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-lg">
            <PortfolioSection
              assets={assets}
              onRemove={() => {}}
              pricesLoading={loading || portfolioLoading}
              lastPriceUpdate={lastUpdated}
            />
          </div>
        </section>

        {/* Chart */}
        <section className="col-span-12 flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-gray-900">
                Évolution du portefeuille
              </h2>
              <span className="text-[12px] text-gray-500">
                Powered by CryptoPilot
              </span>
            </div>
            <TimeRangeTabs
              value={range as TimeRange}
              onChange={(r) => setRange(r as ChartRange)}
            />
          </div>
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-lg">
            {userId && (
              <PortfolioChart 
                range={range} 
                userId={userId}
                todayValue={todayValue}
                lastUpdatedLabel={lastUpdatedLabel}
              />
            )}
          </div>
        </section>
      </div>

      {/* Transaction Form */}
      <TransactionForm
        userId={userId}
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => {
          refetchPortfolio();
        }}
      />

      {/* Chatbot Widget */}
      <ChatbotWidget />
    </div>
  );
}

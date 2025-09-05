"use client";

import { useState, useMemo } from "react";
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
import FileDropzone from "@/components/FileDropzone";

export default function Home() {
  // Session NextAuth
  const { data: session } = useSession();

  // User ID permanent ou temporaire
  const userId =
    session?.user?.id ??
    (typeof window !== "undefined" ? localStorage.getItem("cp_temp_user_id") : "") ??
    "";

  // Récupération du portfolio depuis BigQuery
  const {
    data: currentPortfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = useCurrentPortfolio(userId);

  // Récupération des prix
  const symbols = useMemo(() => {
    if (!currentPortfolio?.assets) return [];
    return currentPortfolio.assets.map((asset) => asset.symbol);
  }, [currentPortfolio]);

  const { prices, loading, error, lastUpdated, refresh } = usePrices({
    symbols,
    refreshInterval: 30000,
    enabled: true,
  });

  // Conversion des assets
  const assets: PortfolioAsset[] = useMemo(() => {
    if (!currentPortfolio?.assets) return [];

    return currentPortfolio.assets.map((asset, index) => ({
      id: `${asset.symbol}-${index}`,
      symbol: asset.symbol,
      name: asset.symbol,
      quantity: asset.quantity,
      price: prices[asset.symbol] || asset.currentPrice || 0,
      avgPrice: asset.avgPrice,
    }));
  }, [currentPortfolio, prices]);

  const [showAdd, setShowAdd] = useState(false);
  const [range, setRange] = useState<ChartRange>("1Y");
  const [refreshInterval, setRefreshInterval] = useState(30000);

  // Onglet actif (portfolio ou import)
  const [portfolioTab, setPortfolioTab] = useState<"portfolio" | "import">("portfolio");

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

  // Gestionnaire d'import
  const handleFileImport = (file: File) => {
    console.log("Fichier importé :", file.name);
    // TODO: parser CSV/XLSX et mettre à jour assets
    // puis revenir à l’onglet portfolio si besoin :
    // setPortfolioTab("portfolio");
  };

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
              <button
                onClick={() => setPortfolioTab("import")}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
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

          {/* Tabs */}
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-200">
              <button
                onClick={() => setPortfolioTab("portfolio")}
                className={`px-3 py-2 text-sm font-medium rounded-t-md ${
                  portfolioTab === "portfolio"
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Portefeuille
              </button>
              <button
                onClick={() => setPortfolioTab("import")}
                className={`px-3 py-2 text-sm font-medium rounded-t-md ${
                  portfolioTab === "import"
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Import
              </button>
            </div>

            {portfolioTab === "portfolio" ? (
              <PortfolioSection
                assets={assets}
                onRemove={() => {}}
                pricesLoading={loading || portfolioLoading}
                lastPriceUpdate={lastUpdated}
              />
            ) : (
              <div>
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Importer des transactions</h3>
                  <p className="text-xs text-gray-500">Formats acceptés : CSV, XLSX</p>
                </div>

                <FileDropzone onFileSelect={handleFileImport} />

                <ul className="mt-6 text-xs text-gray-500 list-disc pl-5 space-y-1">
                  <li>
                    Colonnes recommandées : <code>symbol</code>, <code>quantity</code>,{" "}
                    <code>price</code>, <code>avgPrice</code>
                  </li>
                  <li>Vos positions apparaîtront dans l’onglet Portefeuille après import.</li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Chart */}
        <section className="col-span-12 flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-gray-900">Évolution du portefeuille</h2>
              <span className="text-[12px] text-gray-500">Powered by CryptoPilot</span>
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

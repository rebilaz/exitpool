"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { PortfolioAsset } from "../components/PortfolioMain";
import { ChartRange } from "../components/PortfolioChart";
import PortfolioSection, { usePortfolioChartData } from "../components/PortfolioSection";
import PortfolioChart from "../components/PortfolioChart";
import ValueHero from "../components/ValueHero";
import TimeRangeTabs, { TimeRange } from "../components/TimeRangeTabs";

import PriceStatus from "../components/PriceStatus";
import RefreshSettings from "../components/RefreshSettings";
import { usePrices } from "../hooks/usePrices";
import { useCurrentPortfolio } from "../hooks/usePortfolio";
import TransactionForm from "@/components/ui/TransactionForm";
import FileDropzone from "@/components/FileDropzone";
import { useBulkImport, type NormalizedRow } from "@/hooks/useBulkImport";
import ImportPreviewTable from "@/components/import/ImportPreviewTable";
import PortfolioLeftRail from "@/components/PortfolioLeftRail";
import FooterLinks from "@/components/ui/FooterLinks";
import ChatbotWidget from "@/components/ChatbotWidget";
import { detectCsvType } from "@/src/importers/detectCsvType";
import { parseMexcSpotFrCsv } from "@/src/importers/parseMexcSpotFr";
import { parseBinanceSpotFrCsv } from "@/src/importers/parseBinanceSpotFr";
import { parseGenericCsv } from "@/src/importers/parseGenericCsv";

/** Onglet — taille LARGE (comme ancien script) */
function TabButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-selected={active}
      className={[
        "px-4 py-2.5 text-base font-semibold rounded-t-md transition-colors",
        active
          ? "text-gray-900 border-b-2 border-gray-900 bg-white"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** Lecture .xlsx (nécessite `xlsx`) */
async function parseXlsx(file: File): Promise<NormalizedRow[]> {
  const XLSX = await import("xlsx");
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const toNum = (v: any) => (v === "" || v == null ? undefined : Number(v));
  const toIsoSec = (d: Date) => new Date(Math.floor(d.getTime() / 1000) * 1000).toISOString();

  return json
    .map((r) => {
      const t = (s: any) => (typeof s === "string" ? s.trim() : s);
      const symbol = String(t(r.symbol) ?? t(r.SYMBOL) ?? t(r.base) ?? "").toUpperCase();
      const rawSide = String(t(r.side) ?? t(r.SIDE) ?? "").toUpperCase();
      const side = (["BUY", "SELL", "TRANSFER"].includes(rawSide) ? rawSide : "BUY") as
        | "BUY"
        | "SELL"
        | "TRANSFER";
      const quantity = Number(t(r.quantity) ?? t(r.qty) ?? t(r.executed) ?? 0);
      if (!symbol || !Number.isFinite(quantity) || quantity === 0) return null;

      const price = toNum(t(r.price) ?? t(r.PRICE));
      const dateRaw = t(r.timestamp) ?? t(r.date) ?? t(r["Date(UTC)"]) ?? "";
      const timestamp = dateRaw ? toIsoSec(new Date(dateRaw)) : undefined;
      const fee = toNum(t(r.fee) ?? t(r.FEE));
      const fee_currency = (t(r.fee_currency) ?? t(r["Fee Coin"]) ?? "").toUpperCase() || undefined;
      const ext_ref = (t(r.ext_ref) ?? t(r["Trade ID"]) ?? t(r["Order ID"]) ?? "") || undefined;
      const note = (t(r.note) ?? t(r.NOTE) ?? "") || undefined;
      const exchange = (t(r.exchange) ?? t(r.EXCHANGE) ?? "") || undefined;
      const import_batch_id = (t(r.import_batch_id) ?? t(r.IMPORT_BATCH_ID) ?? "") || undefined;

      const row: NormalizedRow = {
        symbol,
        side,
        quantity,
        price,
        timestamp,
        note,
        client_tx_id: (t(r.client_tx_id) ?? t(r.CLIENT_TX_ID) ?? "") || undefined,
        ext_ref,
        fee,
        fee_currency,
        exchange,
        import_batch_id,
      };
      return row;
    })
    .filter(Boolean) as NormalizedRow[];
}

export default function Home() {
  const { data: session } = useSession();

  const userId =
    session?.user?.id ??
    (typeof window !== "undefined" ? (localStorage.getItem("cp_temp_user_id") ?? "") : "") ??
    "";

  const {
    data: currentPortfolio,
    isLoading: portfolioLoading,
    refetch: refetchPortfolio,
  } = useCurrentPortfolio(userId);

  const symbols = useMemo(
    () => currentPortfolio?.assets?.map((a) => a.symbol) ?? [],
    [currentPortfolio]
  );

  const [refreshInterval, setRefreshInterval] = useState(30000);
  const { prices, loading, error, lastUpdated, refresh } = usePrices({
    symbols,
    refreshInterval,
    enabled: true,
  });

  // Valeurs brutes pour calculs ; l’affichage 2 déc. se fait dans PortfolioMain
  const assets: PortfolioAsset[] = useMemo(() => {
    if (!currentPortfolio?.assets) return [];
    return currentPortfolio.assets.map((asset, index) => ({
      id: `${asset.symbol}-${index}`,
      symbol: asset.symbol,
      name: asset.symbol,
      quantity: Number(asset.quantity),
      price: prices[asset.symbol] || asset.currentPrice || 0,
      avgPrice: asset.avgPrice,
    }));
  }, [currentPortfolio, prices]);

  const [showAdd, setShowAdd] = useState(false);
  const [range, setRange] = useState<ChartRange>("1Y");
  const [portfolioTab, setPortfolioTab] = useState<"portfolio" | "import">("portfolio");

  const totalValue = useMemo(() => {
    if (currentPortfolio) return currentPortfolio.totalValue;
    return assets.reduce((acc, a) => acc + a.quantity * a.price, 0);
  }, [currentPortfolio, assets]);

  // Placeholder tant que l’API ne fournit pas 24h/YTD
  const pnl24h = currentPortfolio?.totalPnl ?? 0;
  const pnlYTD = currentPortfolio?.totalPnl ?? 0;

  const { todayValue, lastUpdatedLabel } = usePortfolioChartData(assets, lastUpdated);

  // === Import bulk ===
  const [previewRows, setPreviewRows] = useState<NormalizedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const bulkImport = useBulkImport();

  // Import gestionnaire (CSV avec fallback encodage + XLSX)
  const handleFileImport = async (file: File) => {
    setParseError(null);
    setSelectedFile(file);

    try {
      const name = file.name.toLowerCase();

      if (name.endsWith(".csv")) {
        // UTF-8 puis tentative windows-1252 / iso-8859-1 si mojibake
        let text = await file.text();
        if (text.includes("�")) {
          try {
            const ab = await file.arrayBuffer();
            // @ts-ignore - TextDecoder legacy encodings
            for (const enc of ["windows-1252", "iso-8859-1"]) {
              try {
                // @ts-ignore
                const td = new TextDecoder(enc);
                const alt = td.decode(new Uint8Array(ab));
                if (alt && !alt.includes("�")) {
                  text = alt;
                  break;
                }
              } catch {}
            }
          } catch {}
        }

        const firstLine = (text.split(/\r?\n/)[0] || "").replace(/^\uFEFF/, "");
        const kind = detectCsvType(firstLine);

        let rows: NormalizedRow[] = [];
        switch (kind) {
          case "mexc-fr":
            rows = parseMexcSpotFrCsv(text, file.name);
            break;
          case "binance-fr":
            rows = parseBinanceSpotFrCsv ? parseBinanceSpotFrCsv(text, file.name) : [];
            break;
          default: {
            const fl = firstLine.toLowerCase();
            if (
              fl.includes("cryptomonnaie") ||
              fl.includes("temps de création") ||
              fl.includes("temps de creation")
            ) {
              rows = parseMexcSpotFrCsv(text, file.name);
            } else {
              rows = await parseGenericCsv(file);
            }
            break;
          }
        }

        if (!rows.length) {
          setParseError("Aucune ligne valide trouvée.");
          setPreviewRows([]);
          return;
        }

        setPreviewRows(rows);
        return;
      }

      if (name.endsWith(".xlsx")) {
        try {
          const rows = await parseXlsx(file);
          if (!rows.length) {
            setParseError("Aucune ligne valide trouvée.");
            setPreviewRows([]);
            return;
          }
          setPreviewRows(rows);
        } catch {
          setParseError("Pour les .xlsx, installe 'xlsx' ou exporte en CSV.");
          setPreviewRows([]);
        }
        return;
      }

      // Format non supporté
      setParseError("Format non supporté. Utilisez un CSV (ou XLSX si activé).");
      setPreviewRows([]);
    } catch (e: any) {
      setParseError(e?.message || "Erreur pendant l’analyse du fichier.");
      setPreviewRows([]);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Panneau GAUCHE FIXE (widgets) */}
      <div className="hidden lg:block fixed left-0 top-24 bottom-20 w-[300px] px-3 z-30">
        <PortfolioLeftRail
          assets={assets}
          events={(currentPortfolio as any)?.events ?? []}
          onImportClick={() => setPortfolioTab("import")}
          onAddNoteClick={() => alert("Note: fonctionnalité à venir")}
          onExportClick={() => console.info("[EXPORT] coming soon")}
          stickyOffset={0}
        />
      </div>



      {/* Contenu central sans “cartes compactes” */}
      <div className="mx-auto w-full max-w-[1600px] px-6 pb-28 pt-6 lg:pl-[320px] lg:pr-[340px]">
        {/* HERO — conserve son style propre */}
        <div className="mb-10">
          <ValueHero
            totalValue={totalValue}
            pnl24h={pnl24h}
            pnlYTD={pnlYTD}
            assetsCount={assets.length}
          />
        </div>

        {/* Barre de statut + actions */}
        <section className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-gray-900">Portefeuille</h2>
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
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPortfolioTab("import")}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
              >
                Importer
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-gray-800"
              >
                Nouvelle position
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3 border-b border-gray-200">
            <button
              onClick={() => setPortfolioTab("portfolio")}
              className={`px-4 py-2.5 text-base font-semibold rounded-t-md transition-colors ${
                portfolioTab === "portfolio"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Portefeuille
            </button>
            <button
              onClick={() => setPortfolioTab("import")}
              className={`px-4 py-2.5 text-base font-semibold rounded-t-md transition-colors ${
                portfolioTab === "import"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Import
            </button>
          </div>
        </section>

        {/* Zone principale sans cartes : sections full-width, espacées */}
        <section className="mb-12">
          {portfolioTab === "portfolio" ? (
            <div className="space-y-6">
              {/* Tableau portefeuille en plein largeur */}
              <PortfolioSection
                assets={assets}
                onRemove={() => {}}
                pricesLoading={loading || portfolioLoading}
                lastPriceUpdate={lastUpdated}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Importer des transactions
                </h3>
                <p className="text-xs text-gray-500">Formats acceptés : CSV / XLSX</p>
              </div>

              <FileDropzone onFileSelect={handleFileImport} />

              {parseError && (
                <div className="mt-1 text-xs text-red-600">{parseError}</div>
              )}

              <ImportPreviewTable
                rows={previewRows}
                // @ts-ignore si ton composant les accepte
                fileName={selectedFile?.name}
                // @ts-ignore
                onRemoveFile={() => {
                  setSelectedFile(null);
                  setPreviewRows([]);
                }}
              />

              {previewRows.length > 0 && (
                <div className="mt-2 flex items-center gap-3">
                  <button
                    disabled={bulkImport.isPending || !userId}
                    onClick={async () => {
                      const result = await bulkImport.mutateAsync({
                        userId,
                        importBatchId: `manual-${new Date().toISOString().slice(0, 10)}`,
                        exchange: previewRows[0]?.exchange ?? null,
                        rows: previewRows,
                      });
                      console.info("[IMPORT/UI] bulk result", result);
                      setPreviewRows([]);
                      await refetchPortfolio();
                      setPortfolioTab("portfolio");
                    }}
                    className="rounded-md bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {bulkImport.isPending ? "Import..." : "Importer"}
                  </button>
                  <button
                    onClick={() => setPreviewRows([])}
                    className="rounded-md border px-3 py-1.5 text-[11px]"
                  >
                    Annuler
                  </button>
                  {bulkImport.error && (
                    <span className="text-xs text-red-600">
                      {(bulkImport.error as Error).message}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Chart en plein largeur, sans carte */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-gray-900">Évolution du portefeuille</h2>
              <span className="text-[12px] text-gray-500">Powered by CryptoPilot</span>
            </div>
            <TimeRangeTabs
              value={range as TimeRange}
              onChange={(r) => setRange(r as ChartRange)}
            />
          </div>

          {userId && (
            <PortfolioChart
              range={range}
              userId={userId}
              todayValue={todayValue}
              lastUpdatedLabel={lastUpdatedLabel}
            />
          )}
        </section>
      </div>



      {/* Footer */}
      <FooterLinks />

      {/* Chatbot en bas à droite */}
      <ChatbotWidget />

      <TransactionForm
        userId={userId}
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => {
          refetchPortfolio();
        }}
      />
    </div>
  );
}



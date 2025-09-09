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

// 👉 bulk + preview
import { useBulkImport, type NormalizedRow } from "@/hooks/useBulkImport";
import ImportPreviewTable from "@/components/import/ImportPreviewTable";

// 👉 routeur + parsers
import { detectCsvType } from "@/src/importers/detectCsvType";
import { parseMexcSpotFrCsv } from "@/src/importers/parseMexcSpotFr";
import { parseBinanceSpotFrCsv } from "@/src/importers/parseBinanceSpotFr"; // si tu l'as
import { parseGenericCsv } from "@/src/importers/parseGenericCsv";

export default function Home() {
  const { data: session } = useSession();

  const userId =
    session?.user?.id ??
    (typeof window !== "undefined" ? localStorage.getItem("cp_temp_user_id") : "") ??
    "";

  const {
    data: currentPortfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = useCurrentPortfolio(userId);

  const symbols = useMemo(() => {
    if (!currentPortfolio?.assets) return [];
    return currentPortfolio.assets.map((asset) => asset.symbol);
  }, [currentPortfolio]);

  const { prices, loading, error, lastUpdated, refresh } = usePrices({
    symbols,
    refreshInterval: 30000,
    enabled: true,
  });

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
  const [portfolioTab, setPortfolioTab] = useState<"portfolio" | "import">("portfolio");

  const totalValue = useMemo(() => {
    if (currentPortfolio) return currentPortfolio.totalValue;
    return assets.reduce((acc, a) => acc + a.quantity * a.price, 0);
  }, [currentPortfolio, assets]);

  const pnl24h = currentPortfolio?.totalPnl || 0;
  const pnlYTD = currentPortfolio?.totalPnl || 0;
  const { todayValue, lastUpdatedLabel } = usePortfolioChartData(assets, lastUpdated);

  // === Import bulk ===
  const [previewRows, setPreviewRows] = useState<NormalizedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const bulkImport = useBulkImport();

  // XLSX (si activé)
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

  // Gestionnaire d'import
  const handleFileImport = async (file: File) => {
  setParseError(null);
  setSelectedFile(file);
    console.info("[IMPORT/UI] start", { name: file.name, size: file.size, type: file.type });

    try {
      const name = file.name.toLowerCase();

      if (name.endsWith(".csv")) {
        // lire en UTF-8 puis retenter en latin1/windows-1252 si mojibake
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
                  console.info("[IMPORT/UI] recoded", { encoding: enc });
                  text = alt;
                  break;
                }
              } catch {}
            }
          } catch {}
        }

        const firstLine = (text.split(/\r?\n/)[0] || "").replace(/^\uFEFF/, "");
        console.info("[IMPORT/UI] csv read", { firstLine: firstLine.slice(0, 140) });

        const kind = detectCsvType(firstLine);
        console.info("[IMPORT/UI] detected type", { kind });

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
              console.info("[IMPORT/UI] generic→mexc heuristic");
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

        console.info("[IMPORT/UI] parsed", { rows: rows.length, sample: rows.slice(0, 2) });
        setPreviewRows(rows);
      } else if (name.endsWith(".xlsx")) {
        try {
          const rows = await parseXlsx(file);
          if (!rows.length) {
            setParseError("Aucune ligne valide trouvée.");
            setPreviewRows([]);
            return;
          }
          console.info("[IMPORT/UI] parsed", { rows: rows.length, sample: rows.slice(0, 2) });
          setPreviewRows(rows);
        } catch {
          setParseError("Pour les .xlsx, installe 'xlsx' ou exporte en CSV.");
          setPreviewRows([]);
        }
      } else {
        setParseError("Format non supporté. Utilisez un CSV (ou XLSX si activé).");
        setPreviewRows([]);
      }
    } catch (e: any) {
      console.error("[IMPORT/UI] parse error", { message: e?.message, stack: e?.stack });
      setParseError(e?.message || "Erreur pendant l’analyse du fichier.");
      setPreviewRows([]);
    }
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
                  <p className="text-xs text-gray-500">Formats acceptés : CSV</p>
                </div>

                <FileDropzone onFileSelect={handleFileImport} />

                {parseError && <div className="mt-3 text-xs text-red-600">{parseError}</div>}

                <ImportPreviewTable
                  rows={previewRows}
                  fileName={selectedFile?.name}
                  onRemoveFile={() => {
                    setSelectedFile(null);
                    setPreviewRows([]);
                  }}
                />

                {previewRows.length > 0 && (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      disabled={bulkImport.isPending || !userId}
                      onClick={async () => {
                        console.info("[IMPORT/UI] bulk submit", {
                          userId,
                          rows: previewRows.length,
                          exchange: previewRows[0]?.exchange,
                          importBatchId: `manual-${new Date().toISOString().slice(0, 10)}`,
                        });
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
                      className="rounded-md bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
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

                <ul className="mt-6 text-xs text-gray-500 list-disc pl-5 space-y-1">
                  <li>
                    Colonnes reconnues : <code>symbol</code>, <code>side</code>, <code>quantity</code>,{" "}
                    <code>price</code>, <code>timestamp</code>, <code>note</code>, <code>client_tx_id</code>,{" "}
                    <code>ext_ref</code>, <code>fee</code>, <code>fee_currency</code>, <code>exchange</code>,{" "}
                    <code>import_batch_id</code>.
                  </li>
                  <li>
                    Auto-détection des CSV MEXC FR / Binance FR / générique par en-têtes. Décimales au{" "}
                    <strong>point</strong>.
                  </li>
                  <li>
                    Les valeurs <em>deposit/withdraw</em> sont normalisées en <code>TRANSFER</code>.
                  </li>
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
            <TimeRangeTabs value={range as TimeRange} onChange={(r) => setRange(r as ChartRange)} />
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

      <TransactionForm
        userId={userId}
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => {
          refetchPortfolio();
        }}
      />

      <ChatbotWidget />
    </div>
  );
}

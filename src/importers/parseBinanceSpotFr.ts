import type { NormalizedRow } from "@/hooks/useBulkImport";

/**
 * Mapper pour les exports Binance Spot en français
 * (colonnes : Date(UTC); Pair; Type; Side; Amount; etc.).
 */
export function parseBinanceSpotFrCsv(text: string, fileName?: string): NormalizedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];

  // Détecter séparateur , ou ;
  const headerLine = lines[0];
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  const sep = semis > commas ? ";" : ",";

  const headers = headerLine.split(sep).map((h) => h.trim().toLowerCase());

  const iDate = headers.findIndex((h) => h.includes("date(utc)") || h.includes("date"));
  const iPair = headers.findIndex((h) => h.includes("pair") || h.includes("market"));
  const iType = headers.findIndex((h) => h.includes("type") || h.includes("side"));
  const iAmount = headers.findIndex((h) => h.includes("amount") || h.includes("quantity"));
  const iPrice = headers.findIndex((h) => h.includes("price") || h.includes("executed"));
  const iFee = headers.findIndex((h) => h.includes("fee"));
  const iFeeCoin = headers.findIndex((h) => h.includes("fee coin") || h.includes("fee_coin"));

  if (iDate === -1 || iPair === -1 || iType === -1 || iAmount === -1) {
    throw new Error("Ce fichier ne ressemble pas à un export Binance Spot FR.");
  }

  const rows: NormalizedRow[] = [];
  const batchId = `binance-spot-${fileName || "import"}`;

  const toIso = (s: string | undefined) => {
    if (!s) return undefined;
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const extractSymbol = (pair: string) => {
    // Ex: "BTCUSDT" -> "BTC", "ETHUSDT" -> "ETH"
    const commonQuotes = ["USDT", "USDC", "BUSD", "BTC", "ETH", "BNB"];
    for (const quote of commonQuotes) {
      if (pair.endsWith(quote)) {
        return pair.slice(0, -quote.length);
      }
    }
    return pair; // fallback
  };

  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split(sep);

    const pair = (cols[iPair] || "").trim().toUpperCase();
    const type = (cols[iType] || "").trim().toLowerCase();
    const amountRaw = cols[iAmount];
    const priceRaw = iPrice >= 0 ? cols[iPrice] : undefined;
    const ts = toIso(cols[iDate]);

    const amount = amountRaw ? Math.abs(Number(amountRaw)) : 0;
    const price = priceRaw ? Number(priceRaw) : undefined;
    
    if (!pair || !amount || !ts) continue;

    const symbol = extractSymbol(pair);

    // Déterminer le side
    let side: "BUY" | "SELL" | "TRANSFER" = "TRANSFER";
    if (type.includes("buy") || type.includes("achat")) side = "BUY";
    if (type.includes("sell") || type.includes("vente")) side = "SELL";
    if (type.includes("deposit") || type.includes("withdraw")) side = "TRANSFER";

    // Gestion des frais
    const fee = iFee >= 0 && cols[iFee] ? Number(cols[iFee]) : undefined;
    const feeCurrency = iFeeCoin >= 0 ? (cols[iFeeCoin]?.trim() || undefined) : undefined;

    rows.push({
      symbol,
      side,
      quantity: amount,
      price: Number.isFinite(price as number) ? price : undefined,
      timestamp: ts,
      note: undefined,
      client_tx_id: undefined,
      ext_ref: undefined,
      fee,
      fee_currency: feeCurrency,
      exchange: "Binance",
      import_batch_id: batchId,
    });
  }

  return rows;
}

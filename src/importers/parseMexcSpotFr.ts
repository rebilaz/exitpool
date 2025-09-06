import type { NormalizedRow } from "@/hooks/useBulkImport";

/** Parse MEXC Spot FR → NormalizedRow[] */
export function parseMexcSpotFrCsv(text: string, fileName?: string): NormalizedRow[] {
  console.info("[IMPORT/MEXC] start", { fileName });

  const rawLines = (text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const lines = rawLines.filter((l) => l.trim().length);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const sep = (headerLine.match(/;/g)?.length || 0) > (headerLine.match(/,/g)?.length || 0) ? ";" : ",";
  const headers = headerLine
    .split(sep)
    .map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  console.info("[IMPORT/MEXC] headers", headers);

  const iTime = headers.findIndex(
    (h) => h.includes("temps de création") || h.includes("temps de creation") || h.includes("date")
  );
  const iSym = headers.findIndex((h) => h.includes("cryptomonnaie"));
  const iType = headers.findIndex((h) => h.includes("type de transaction"));
  const iDir = headers.findIndex((h) => h.includes("direction"));
  const iQty = headers.findIndex((h) => h.includes("quantité") || h.includes("quantite"));

  if ([iTime, iSym, iType, iDir, iQty].some((i) => i === -1)) {
    throw new Error("Ce CSV ne ressemble pas à un export MEXC Spot (FR).");
  }

  const batchId = `mexc-spot-${fileName || "import"}`;
  const toISO = (s?: string) => {
    if (!s) return undefined;
    const d = new Date(String(s).trim().replace(" ", "T"));
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const out: NormalizedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);

    const symbol = String(cols[iSym] ?? "").trim().toUpperCase();
    const type = String(cols[iType] ?? "").trim().toLowerCase();
    const dir = String(cols[iDir] ?? "").trim().toLowerCase();
    const ts = toISO(cols[iTime] ?? "");
    const qtyNum = Number(String(cols[iQty] ?? "0").replace(",", "."));
    const qtyAbs = Math.abs(qtyNum);

    if (!symbol || !qtyAbs || !ts) continue;

    // Frais → fee row (quantity=0, side=TRANSFER)
    if (type.includes("frais")) {
      console.info("[IMPORT/MEXC] fee row", { i, symbol, qtyAbs });
      out.push({
        symbol,
        side: "TRANSFER",
        quantity: 0,
        price: undefined,
        timestamp: ts,
        note: "FEE",
        client_tx_id: undefined,
        ext_ref: undefined,
        fee: qtyAbs,
        fee_currency: symbol,
        exchange: "MEXC",
        import_batch_id: batchId,
      });
      continue;
    }

    // Trading au comptant → BUY/SELL selon Direction
    let side: "BUY" | "SELL" | "TRANSFER" = "TRANSFER";
    if (type.includes("trading")) {
      if (dir.includes("entrée")) side = "BUY";
      if (dir.includes("entree")) side = "BUY";
      if (dir.includes("sortie")) side = "SELL";
    }

    console.info("[IMPORT/MEXC] trade row", { i, symbol, side, qtyAbs });
    out.push({
      symbol,
      side,
      quantity: qtyAbs,
      price: undefined, // backend reconstruira si besoin
      timestamp: ts,
      note: undefined,
      client_tx_id: undefined,
      ext_ref: undefined,
      fee: undefined,
      fee_currency: undefined,
      exchange: "MEXC",
      import_batch_id: batchId,
    });
  }

  console.info("[IMPORT/MEXC] parsed rows", { count: out.length, sample: out.slice(0, 2) });
  return out;
}

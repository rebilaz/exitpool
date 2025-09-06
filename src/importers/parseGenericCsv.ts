import type { NormalizedRow } from "@/hooks/useBulkImport";

export async function parseGenericCsv(file: File): Promise<NormalizedRow[]> {
  console.info("[IMPORT/GEN] start", { name: (file as any)?.name });

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];

  const header = lines[0].replace(/^\uFEFF/, "");
  const sep = (header.match(/;/g)?.length || 0) > (header.match(/,/g)?.length || 0) ? ";" : ",";
  const headers = header.split(sep).map((h) => h.trim().toLowerCase());
  console.info("[IMPORT/GEN] headers", headers);
  const idx = (k: string) => headers.indexOf(k);

  const iSymbol = idx("symbol");
  const iSide = idx("side");
  const iQty = idx("quantity") !== -1 ? idx("quantity") : idx("qty");
  const iPrice = idx("price");
  const iTs = idx("timestamp") !== -1 ? idx("timestamp") : idx("date");
  const iNote = idx("note");
  const iClient = idx("client_tx_id");
  const iRef = idx("ext_ref");
  const iFee = idx("fee");
  const iFeeCcy = idx("fee_currency");
  const iExchange = idx("exchange");
  const iBatch = idx("import_batch_id");

  if (iSymbol === -1 || iSide === -1 || iQty === -1) {
    console.error("[IMPORT/GEN] missing headers", { headers });
    throw new Error(
      `En-têtes requis manquants: symbol, side, quantity/qty — headers lus: ${headers.join(" | ")}`
    );
  }

  const toISO = (s?: string) => {
    if (!s) return undefined;
    const d = new Date(s.trim());
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const out: NormalizedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const symbol = (cols[iSymbol] || "").trim().toUpperCase();
    const side = (cols[iSide] || "").trim().toUpperCase() as NormalizedRow["side"];
    const quantity = Number(cols[iQty] || "0");
    if (!symbol || !quantity || !["BUY", "SELL", "TRANSFER"].includes(side)) continue;

    const price = iPrice >= 0 && cols[iPrice] ? Number(cols[iPrice]) : undefined;
    const timestamp = iTs >= 0 ? toISO(cols[iTs]) : undefined;

    out.push({
      symbol,
      side,
      quantity,
      price: Number.isFinite(price as number) ? price : undefined,
      timestamp,
      note: iNote >= 0 ? (cols[iNote]?.trim() || undefined) : undefined,
      client_tx_id: iClient >= 0 ? (cols[iClient]?.trim() || undefined) : undefined,
      ext_ref: iRef >= 0 ? (cols[iRef]?.trim() || undefined) : undefined,
      fee: iFee >= 0 && cols[iFee] ? Number(cols[iFee]) : undefined,
      fee_currency: iFeeCcy >= 0 ? (cols[iFeeCcy]?.trim().toUpperCase() || undefined) : undefined,
      exchange: iExchange >= 0 ? (cols[iExchange]?.trim() || undefined) : undefined,
      import_batch_id: iBatch >= 0 ? (cols[iBatch]?.trim() || undefined) : undefined,
    });
  }

  console.info("[IMPORT/GEN] parsed rows", { count: out.length, sample: out.slice(0, 2) });
  return out;
}

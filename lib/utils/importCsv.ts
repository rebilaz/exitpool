// app/(utils)/importCsv.ts
export type NormalizedRow = {
    symbol: string;
    side: 'BUY' | 'SELL' | 'TRANSFER';
    quantity: number;
    price?: number | null;
    timestamp?: string | null;
    note?: string | null;
    client_tx_id?: string | null;
    ext_ref?: string | null;
    fee?: number | null;
    fee_currency?: string | null;
    exchange?: string | null;
    import_batch_id?: string | null;
  };
  
  function detectDelimiter(headerLine: string) {
    const commas = (headerLine.match(/,/g) || []).length;
    const semis = (headerLine.match(/;/g) || []).length;
    return semis > commas ? ';' : ',';
  }
  function toUpperSafe(s?: string | null) {
    return (s ?? '').trim().toUpperCase();
  }
  function normalizeSide(s: string): 'BUY' | 'SELL' | 'TRANSFER' {
    const v = toUpperSafe(s);
    if (v === 'BUY' || v === 'SELL' || v === 'TRANSFER') return v;
    if (v.includes('DEPOSIT') || v.includes('WITHDRAW')) return 'TRANSFER';
    throw new Error(`Type de transaction inconnu: "${s}"`);
  }
  
  export async function parseCsv(file: File): Promise<NormalizedRow[]> {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (lines.length < 2) return [];
  
    const delim = detectDelimiter(lines[0]);
    const headers = lines[0].split(delim).map((h) => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);
  
    const iSymbol = idx('symbol'), iSide = idx('side'), iQty = idx('quantity');
    const iPrice = idx('price'), iTs = idx('timestamp'), iNote = idx('note');
    const iClient = idx('client_tx_id'), iRef = idx('ext_ref'), iFee = idx('fee');
    const iFeeCcy = idx('fee_currency'), iExch = idx('exchange'), iBatch = idx('import_batch_id');
  
    if (iSymbol === -1 || iSide === -1 || iQty === -1) {
      throw new Error('En-têtes requis manquants: symbol, side, quantity');
    }
  
    const rows: NormalizedRow[] = [];
  
    for (let li = 1; li < lines.length; li++) {
      const raw = lines[li];
      if (!raw.trim()) continue;
  
      // simple split (sans guillemets imbriqués volontairement pour rester léger côté client)
      const cols = raw.split(delim);
  
      const symbol = toUpperSafe(cols[iSymbol]);
      const side = normalizeSide(cols[iSide] ?? '');
      const quantity = Number(cols[iQty]);
      if (!symbol || !Number.isFinite(quantity)) continue;
  
      const price = iPrice >= 0 ? Number(cols[iPrice]) : NaN;
      const ts = iTs >= 0 ? (cols[iTs]?.trim() || null) : null;
  
      rows.push({
        symbol,
        side,
        quantity,
        price: Number.isFinite(price) ? price : undefined,
        timestamp: ts,
        note: iNote >= 0 ? (cols[iNote]?.trim() || null) : null,
        client_tx_id: iClient >= 0 ? (cols[iClient]?.trim() || null) : null,
        ext_ref: iRef >= 0 ? (cols[iRef]?.trim() || null) : null,
        fee: iFee >= 0 && cols[iFee] ? Number(cols[iFee]) : null,
        fee_currency: iFeeCcy >= 0 ? (cols[iFeeCcy]?.trim() || null) : null,
        exchange: iExch >= 0 ? (cols[iExch]?.trim() || null) : null,
        import_batch_id: iBatch >= 0 ? (cols[iBatch]?.trim() || null) : null,
      });
    }
    return rows;
  }
  
import { NextRequest, NextResponse } from "next/server";
import logger from "../../../../lib/logger";
import { portfolioService } from "../../../../lib/services/portfolioService";
import { sha256Hex } from "../../../../lib/utils/hash";
import getBigQuery from "../../../../lib/db/bqClient";
import config from "../../../../lib/config";
import { resolveSymbol } from "../../../../lib/services/symbolResolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Side = "BUY" | "SELL" | "TRANSFER";

type NormalizedRow = {
  symbol: string;                   // base symbol (UPPER)
  side: Side;
  quantity: number;                 // BUY:+ SELL:- ; TRANSFER: +/- (dépôt/retrait)
  price?: number | null;            // en USD si connu (sinon null)
  timestamp: string;                // ISO (arrondi seconde)
  note?: string | null;
  fee?: number | null;
  fee_currency?: string | null;
  exchange?: string | null;
  ext_ref?: string | null;
  import_batch_id?: string | null;
  client_tx_id?: string | null;     // si non fourni, on calcule
  dedupe_key?: string | null;       // fallback si pas de client_tx_id
  // optionnel si connu côté parsing pour calcul pair :
  pair_quote_symbol?: string | null; // ex: "USDT"
};

type BulkRequest = {
  userId: string;
  exchange?: string | null;
  importBatchId?: string | null;
  rows: NormalizedRow[];
};

const TABLE = `\`${config.projectId}.Cryptopilot.transactions\``;
const PAIRS_VIEW = `\`${config.projectId}.Cryptopilot.pairs_daily\``;

// arrondi "seconde"
function toIsoSec(d: Date) {
  const t = new Date(Math.floor(d.getTime() / 1000) * 1000);
  return t.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Récupère le prix exact d'une paire (base/quote) pour une date (YYYY-MM-DD) depuis la vue pairs_daily */
async function getPairPrice(baseSymbol: string, quoteSymbol: string, date: string): Promise<number | null> {
  const bq = getBigQuery();
  const [rows] = await bq.query(
    {
      query: `
        SELECT price
        FROM ${PAIRS_VIEW}
        WHERE base_symbol = @base AND quote_symbol = @quote AND date = @d
        LIMIT 1`,
      params: { base: baseSymbol.toUpperCase(), quote: quoteSymbol.toUpperCase(), d: date },
    }
  );
  const typed = (rows as any[]).map(r => ({ price: r.price }));
  if (!typed?.length) return null;
  const p = Number(typed[0].price);
  return Number.isFinite(p) ? p : null;
}

/** Construit une clé canonique pour le dedupe si pas de client_tx_id */
function buildDedupeKeyBase(r: {
  user_id: string; symbol: string; quantity: number; price: number | null;
  side: Side; timestamp: string; note?: string | null; fee?: number | null;
  fee_currency?: string | null; exchange?: string | null; ext_ref?: string | null;
}) {
  return sha256Hex({
    u: r.user_id,
    s: r.symbol,
    q: r.quantity,
    p: r.price,
    sd: r.side,
    t: r.timestamp,
    n: r.note ?? null,
    f: r.fee ?? null,
    fc: r.fee_currency ? r.fee_currency.toUpperCase() : null,
    ex: r.exchange ?? null,
    er: r.ext_ref ?? null,
  });
}

export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID().slice(0, 8);

  try {
    const body = (await req.json()) as BulkRequest;
    const { userId, rows, importBatchId, exchange } = body ?? {};
    console.info("[BULK] start", { userId, rows: Array.isArray(rows) ? rows.length : 0 });
    
    if (!userId || !rows?.length) {
      return NextResponse.json({ success: false, error: "Missing userId or rows[]" }, { status: 400 });
    }

    // 1) normalisation locale + résolution symboles + prix de paire si manquant
    const prepared: Array<{
      user_id: string; symbol: string; quantity: number; price: number | null; side: Side;
      timestamp: string; note?: string | null; fee?: number | null; fee_currency?: string | null;
      exchange?: string | null; ext_ref?: string | null; client_tx_id?: string | null;
      import_batch_id?: string | null; dedupe_key: string;
    }> = [];

    // pour les jobs after-transaction
    const perSymbolMinDate = new Map<string, string>(); // symbol -> YYYY-MM-DD

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      console.info("[BULK] addTransaction try", { i, symbol: r.symbol, side: r.side, qty: r.quantity, ts: r.timestamp });
      
      // 1.a timestamp → ISO seconde + YYYY-MM-DD
      const d = new Date(r.timestamp);
      if (Number.isNaN(d.getTime())) {
        // on ignore la ligne invalide (on pourrait aussi renvoyer un rapport détaillé)
        continue;
      }
      const iso = toIsoSec(d);
      const day = iso.slice(0, 10); // "YYYY-MM-DD"

      // 1.b side/qty validations
      const side = (String(r.side).toUpperCase() as Side);
      if (!["BUY","SELL","TRANSFER"].includes(side)) continue;
      const qty = Number(r.quantity);
      if (!Number.isFinite(qty) || qty === 0) continue;

      // 1.c symbole canonique (zéro interaction)
      const resolved = await resolveSymbol({
        symbol: r.symbol,
        pairQuoteSymbol: r.pair_quote_symbol || undefined,
        priceObserved: r.price ?? undefined,
        date: d
      });
      const sym = resolved.symbol; // UPPER

      // 1.d prix : si manquant et on a une quote → pairs_daily
      let price: number | null = r.price == null ? null : Number(r.price);
      if ((price == null || !Number.isFinite(price)) && r.pair_quote_symbol) {
        price = await getPairPrice(sym, r.pair_quote_symbol, day);
      }
      if (price != null && !Number.isFinite(price)) price = null;

      const fee = r.fee == null ? null : Number(r.fee);
      const payload = {
        user_id: userId,
        symbol: sym,
        quantity: qty,
        price,
        side,
        timestamp: iso,
        note: r.note ?? null,
        fee: fee,
        fee_currency: r.fee_currency ? String(r.fee_currency).toUpperCase() : null,
        exchange: (r.exchange ?? exchange ?? null) ? String(r.exchange ?? exchange).toLowerCase() : null,
        ext_ref: r.ext_ref ?? null,
        client_tx_id: r.client_tx_id ?? (r.ext_ref ? `${(r.exchange ?? exchange ?? "unknown")}|${r.ext_ref}` : null),
        import_batch_id: r.import_batch_id ?? importBatchId ?? null,
        dedupe_key: r.dedupe_key ?? "", // sera rempli juste après
      };
      payload.dedupe_key = payload.client_tx_id
        ? sha256Hex({ u: payload.user_id, c: payload.client_tx_id })
        : buildDedupeKeyBase(payload);

      prepared.push(payload);

      // Min date pour jobs
      const prev = perSymbolMinDate.get(sym);
      if (!prev || day < prev) perSymbolMinDate.set(sym, day);
    }

    if (!prepared.length) {
      return NextResponse.json({ success: false, error: "No valid rows after normalization" }, { status: 400 });
    }

    // 2) MERGE UNNEST idempotent
    const bq = getBigQuery();
    const query = `
MERGE ${TABLE} T
USING (
  SELECT
    CAST(user_id AS STRING)         AS user_id,
    CAST(symbol AS STRING)          AS symbol,
    CAST(quantity AS FLOAT64)       AS quantity,
    CAST(price AS FLOAT64)          AS price,
    CAST(side AS STRING)            AS side,
    TIMESTAMP(timestamp)            AS timestamp,
    CAST(note AS STRING)            AS note,
    CAST(fee AS FLOAT64)            AS fee,
    CAST(fee_currency AS STRING)    AS fee_currency,
    CAST(exchange AS STRING)        AS exchange,
    CAST(ext_ref AS STRING)         AS ext_ref,
    CAST(client_tx_id AS STRING)    AS client_tx_id,
    CAST(import_batch_id AS STRING) AS import_batch_id,
    CAST(dedupe_key AS STRING)      AS dedupe_key
  FROM UNNEST(@rows)
) S
ON T.user_id = S.user_id
   AND (
     (S.client_tx_id IS NOT NULL AND T.client_tx_id = S.client_tx_id)
     OR
     (S.client_tx_id IS NULL AND T.dedupe_key = S.dedupe_key)
   )
WHEN MATCHED THEN
  UPDATE SET
    symbol         = S.symbol,
    quantity       = S.quantity,
    price          = S.price,
    side           = S.side,
    timestamp      = S.timestamp,
    note           = S.note,
    fee            = S.fee,
    fee_currency   = S.fee_currency,
    exchange       = S.exchange,
    ext_ref        = S.ext_ref,
    import_batch_id= S.import_batch_id,
    dedupe_key     = S.dedupe_key
WHEN NOT MATCHED THEN
  INSERT (transaction_id, user_id, symbol, quantity, price, side, timestamp, note,
          client_tx_id, dedupe_key, import_batch_id, exchange, ext_ref, fee, fee_currency)
  VALUES (GENERATE_UUID(), S.user_id, S.symbol, S.quantity, S.price, S.side, S.timestamp, S.note,
          S.client_tx_id, S.dedupe_key, S.import_batch_id, S.exchange, S.ext_ref, S.fee, S.fee_currency)
    `;
    const [job] = await bq.createQueryJob({ query, params: { rows: prepared } });
    await job.getQueryResults();

    // 3) Jobs after-transaction (1 par symbole)
    const perSymbolJobs: Array<{ symbol: string; from: string }> = [];
    for (const [symbol, fromDay] of perSymbolMinDate) {
      perSymbolJobs.push({ symbol, from: fromDay });
      portfolioService.triggerAfterTransactionJob({
        userId,
        symbol,
        transactionDate: new Date(fromDay + "T00:00:00Z"),
      });
    }

    logger.info("bulk import done", { rid, rows: prepared.length, symbols: perSymbolJobs.length });
    console.info("[BULK] done", { imported: prepared.length, skipped: 0 });

    return NextResponse.json({
      success: true,
      imported: prepared.length, // approximation
      skipped: 0,
      importBatchId: importBatchId ?? null,
      perSymbolJobs,
    });
  } catch (e: any) {
    console.error("[BULK] error", { message: e?.message, stack: e?.stack });
    logger.error("bulk import error", { rid, error: e?.message });
    return NextResponse.json({ success: false, error: e?.message ?? "error", rid }, { status: 500 });
  }
}

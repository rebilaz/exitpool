// src/hooks/useBulkImport.ts
"use client";

import { useMutation } from "@tanstack/react-query";

export type NormalizedRow = {
  symbol: string;
  side: "BUY" | "SELL" | "TRANSFER";
  quantity: number;
  price?: number;
  timestamp?: string;
  note?: string;
  client_tx_id?: string;
  ext_ref?: string;
  fee?: number;
  fee_currency?: string;
  exchange?: string;
  import_batch_id?: string;
};

type BulkPayload = {
  userId: string;
  rows: NormalizedRow[];
  exchange?: string | null;       // meta du lot
  importBatchId?: string | null;  // meta du lot
  fallbackOnFailure?: boolean;    // nouveau: fallback /add si bulk ko
};

type BulkResult = { success: true; imported: number; skipped: number };

async function tryBulk(payload: BulkPayload): Promise<BulkResult | null> {
  console.info("[IMPORT/BULK] request", {
    userId: payload.userId,
    rows: payload.rows?.length ?? 0,
    exchange: payload.exchange ?? null,
    importBatchId: payload.importBatchId ?? null,
  });

  const res = await fetch("/api/transactions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: payload.userId,
      rows: payload.rows,
      exchange: payload.exchange ?? null,
      importBatchId: payload.importBatchId ?? null,
    }),
  });

  const json = await res.json().catch(() => ({} as any));
  console.info("[IMPORT/BULK] response", { status: res.status, ok: res.ok, json });

  if (res.ok && json?.success) {
    return { success: true, imported: Number(json.imported || 0), skipped: Number(json.skipped || 0) };
  }

  // null => laisser le caller décider (fallback ou throw)
  return null;
}

async function fallbackAddIndividually(userId: string, rows: NormalizedRow[]): Promise<BulkResult> {
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      console.info("[IMPORT/FALLBACK] add row", {
        i,
        symbol: r.symbol,
        side: r.side,
        qty: r.quantity,
        hasPrice: r.price != null,
      });

      const rr = await fetch("/api/transactions/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // l'API attend { userId, ...row }
        body: JSON.stringify({ userId, ...r }),
      });

      if (!rr.ok) {
        const txt = await rr.text().catch(() => "");
        throw new Error(`HTTP ${rr.status} ${rr.statusText} ${txt}`.trim());
      }
      imported++;
    } catch (e: any) {
      console.error("[IMPORT/FALLBACK] error row", { i, err: e?.message });
      skipped++;
    }
  }

  console.info("[IMPORT/FALLBACK] done", { imported, skipped, total: rows.length });
  return { success: true, imported, skipped };
}

export function useBulkImport() {
  return useMutation({
    mutationFn: async (payload: BulkPayload): Promise<BulkResult> => {
      const { userId, rows, fallbackOnFailure = true } = payload;

      if (!userId) throw new Error("userId manquant");
      if (!Array.isArray(rows) || rows.length === 0) throw new Error("Aucune ligne à importer");

      // 1) Tentative BULK
      const bulk = await tryBulk(payload);
      if (bulk) return bulk;

      // 2) Fallback optionnel
      if (fallbackOnFailure) {
        console.warn("[IMPORT/BULK] bulk failed → fallback /api/transactions/add");
        return await fallbackAddIndividually(userId, rows);
      }

      // 3) Sinon, erreur explicite
      throw new Error("Bulk import failed et fallback désactivé");
    },
  });
}

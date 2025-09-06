// app/api/transactions/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { portfolioService } from "@/lib/services/portfolioService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RowIn = {
  symbol: string;
  side: "BUY" | "SELL" | "TRANSFER" | string; // on normalise ensuite
  quantity: number | string;
  price?: number | string | null;
  timestamp?: string | null; // ISO ou vide
  note?: string | null;
  client_tx_id?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId: string | undefined = body?.userId;
    const rows: RowIn[] = Array.isArray(body?.rows) ? body.rows : [];

    if (!userId || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "userId et rows requis" },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];

      // Normalisations & validations soft
      const symbol = String(raw.symbol || "").trim().toUpperCase();
      const side = String(raw.side || "").trim().toUpperCase() as
        | "BUY"
        | "SELL"
        | "TRANSFER";

      const qtyNum = Number(raw.quantity);
      const hasQty = Number.isFinite(qtyNum) && qtyNum !== 0;

      // Règles de skip :
      // - pas de symbole/side
      // - quantité vide/NaN/0
      // - TRANSFER avec qty 0 (souvent des lignes "bruit")
      if (!symbol || !side || !Number.isFinite(qtyNum)) {
        skipped++;
        continue;
      }
      if (!hasQty) {
        skipped++;
        continue;
      }
      if (side === "TRANSFER" && qtyNum === 0) {
        skipped++;
        continue;
      }

      // price optionnel
      const price =
        raw.price != null && raw.price !== ""
          ? Number(raw.price)
          : undefined;

      // timestamp optionnel : on laisse le repo appliquer un fallback (now) si absent
      const ts =
        raw.timestamp && String(raw.timestamp).trim().length > 0
          ? new Date(raw.timestamp as string)
          : undefined;

      try {
        await portfolioService.addTransaction({
          userId,
          symbol,
          side,
          quantity: qtyNum,
          price,
          timestamp: ts,
          note: raw.note ?? undefined,
          clientTxId: raw.client_tx_id ?? undefined, // idempotence côté client
        });
        imported++;
      } catch (e: any) {
        // On compte en "skipped" pour que le bulk ne soit pas bloquant
        console.error("[BULK] addTransaction error", {
          i,
          symbol,
          side,
          qty: qtyNum,
          err: e?.message,
        });
        skipped++;
      }
    }

    return NextResponse.json({ success: true, imported, skipped });
  } catch (e: any) {
    console.error("[BULK] fatal", e);
    return NextResponse.json(
      { success: false, error: e?.message || "bulk failed" },
      { status: 500 }
    );
  }
}

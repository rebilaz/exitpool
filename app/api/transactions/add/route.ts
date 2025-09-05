import { NextRequest, NextResponse } from "next/server";
import { portfolioService } from "../../../../lib/services/portfolioService";
import logger from "../../../../lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rid = crypto.randomUUID().slice(0, 8);

  try {
    const body = await request.json();

    const {
      userId,
      symbol,
      quantity,
      side,
      price,
      note,
      timestamp,
      clientTxId, // optionnel : idempotence côté client
      batchId,    // optionnel : pour regrouper des imports
    } = body ?? {};

    // Validations
    if (!userId || !symbol || typeof quantity !== "number" || !side) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userId, symbol, quantity, side",
        },
        { status: 400 }
      );
    }

    if (!["BUY", "SELL", "TRANSFER"].includes(String(side))) {
      return NextResponse.json(
        { success: false, error: "Invalid side. Must be BUY, SELL, or TRANSFER" },
        { status: 400 }
      );
    }

    if (quantity === 0) {
      return NextResponse.json(
        { success: false, error: "Quantity must be a non-zero number" },
        { status: 400 }
      );
    }

    let txDate: Date | undefined = undefined;
    if (timestamp) {
      const d = new Date(timestamp);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid timestamp format" },
          { status: 400 }
        );
      }
      txDate = d;
    }

    // On exécute l'INSERT/MERGE idempotent immédiatement
    const transactionId = await portfolioService.addTransaction({
      userId,
      symbol: String(symbol).toUpperCase(),
      quantity,
      side,
      price,
      note,
      timestamp: txDate,
      clientTxId: clientTxId, // si fourni, sera utilisé comme transaction_id
    } as any);

    // On déclenche le job asynchrone sans bloquer la réponse
    portfolioService.triggerAfterTransactionJob({
      userId,
      symbol: String(symbol).toUpperCase(),
      transactionDate: txDate ?? new Date(),
    });

    logger.info("Transaction accepted", { rid, transactionId, userId, symbol });

    return NextResponse.json({
      success: true,
      accepted: true,
      transactionId,
      batchId: batchId ?? null,
      rid,
    });
  } catch (error) {
    logger.error("Failed to add transaction", { rid, error });
    return NextResponse.json(
      { success: false, error: "Failed to add transaction", rid },
      { status: 500 }
    );
    }
}


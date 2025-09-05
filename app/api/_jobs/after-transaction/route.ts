// app/api/_jobs/after-transaction/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runAfterTransactionJob } from "@/lib/jobs/afterTransaction"; // <- alias @

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Petit endpoint interne appelé en "fire-and-forget"
// Payload attendu: { userId: string; symbol: string; txDate: string }
export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID().slice(0, 8);

  try {
    const body = await req.json().catch(() => ({}));
    const { userId, symbol, txDate } = body ?? {};

    if (!userId || !symbol || !txDate) {
      return NextResponse.json(
        {
          success: false,
          error: "userId, symbol et txDate sont requis",
          rid,
        },
        { status: 400 }
      );
    }

    // Lancer le job sans bloquer la réponse HTTP
    // (on ne fait pas `await`, on log juste les erreurs si ça rejette plus tard)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runAfterTransactionJob({
      userId: String(userId),
      symbol: String(symbol).toUpperCase(),
      txDate: new Date(txDate),
      rid,
    }).catch((e) => {
      // On log asynchrone (n’affecte pas la réponse renvoyée au client)
      // Vous pouvez brancher votre logger ici si besoin
      console.error(`[after-transaction][${rid}] async job failed:`, e);
    });

    // Réponse immédiate
    return NextResponse.json({ success: true, rid }, { status: 202 });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unexpected error in job endpoint";
    return NextResponse.json(
      { success: false, error: msg, rid },
      { status: 500 }
    );
  }
}

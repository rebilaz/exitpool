import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import config from "@/lib/config";
import getBigQuery from "@/lib/db/bqClient";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const { tempUserId } = await req.json();
    if (!tempUserId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_TEMP_ID" },
        { status: 400 }
      );
    }

    const globalUserId = session.user.id as string;

    // --- Prisma (optionnel) ---
    try {
      const { prisma } = await import("@/app/api/auth/[...nextauth]/route");
      if (prisma?.transaction?.updateMany) {
        await prisma.transaction.updateMany({
          where: { userId: tempUserId },
          data: { userId: globalUserId },
        });
      }
    } catch {
      console.info("[migration] Prisma skipped (no local table)");
    }

    // --- BigQuery via singleton ---
    try {
      const bq = getBigQuery();

      const projectId =
        process.env.GOOGLE_PROJECT_ID ||
        process.env.GCP_PROJECT_ID ||
        config.projectId;

      const dataset = process.env.BQ_DATASET || "Cryptopilot";
      const table = process.env.BQ_TRANSACTIONS_TABLE || "transactions";
      const column = process.env.BQ_USER_COLUMN || "user_id";
      const location = process.env.BQ_LOCATION || "US";

      const query = `
        UPDATE \`${projectId}.${dataset}.${table}\`
        SET ${column} = @globalUserId
        WHERE ${column} = @tempUserId
      `;

      const [job] = await bq.createQueryJob({
        query,
        params: { globalUserId, tempUserId },
        location,
      });
      await job.getQueryResults();

      console.log(`[migration] OK - ${tempUserId} → ${globalUserId}`);
    } catch (e) {
      console.error("[migration] BigQuery update failed", e);
      return NextResponse.json(
        { ok: false, error: "BIGQUERY_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[migration] Fatal error", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

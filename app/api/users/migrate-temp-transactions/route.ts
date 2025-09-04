import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { BigQuery } from "@google-cloud/bigquery";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import config from "@/lib/config";

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

    // --- Migration Prisma (optionnelle) ---
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

    // --- Migration BigQuery ---
    try {
      const bq = new BigQuery({ projectId: config.projectId });

      // ⚠️ Vérifie que ces valeurs correspondent bien à ton dataset et ta table BQ
      const dataset = "Cryptopilot";
      const table = "transactions";
      const column = "user_id";

      const query = `
        UPDATE \`${config.projectId}.${dataset}.${table}\`
        SET ${column} = @globalUserId
        WHERE ${column} = @tempUserId
      `;

      const [job] = await bq.createQueryJob({
        query,
        params: { globalUserId, tempUserId },
        location: "US", // adapte si ton dataset est ailleurs (ex: EU)
      });
      await job.getQueryResults();

      console.log(
        `[migration] OK - Migrated from ${tempUserId} → ${globalUserId}`
      );
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

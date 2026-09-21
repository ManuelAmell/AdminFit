import { and, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { subscriptions } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { withPlatform } from "@/lib/tenant";

// Marca como "expired" las membresías activas cuyo end_date ya pasó, en todas las orgs.
// Programar diario (ej. 00:10 America/Bogota). Protegido por CRON_SECRET.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayISO();
  const expired = await withPlatform((tx) =>
    tx
      .update(subscriptions)
      .set({ status: "expired" })
      .where(and(eq(subscriptions.status, "active"), lt(subscriptions.endDate, today)))
      .returning({ id: subscriptions.id, orgId: subscriptions.orgId }),
  );

  return NextResponse.json({ ok: true, today, expired: expired.length });
}

export const GET = POST;

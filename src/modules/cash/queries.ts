import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { cashClosures, user } from "@/db/schema";
import { withTenant } from "@/lib/tenant";
import { getCashExpensesTotal } from "@/modules/expenses/queries";
import { getCashClose } from "@/modules/payments/queries";

// Mismo truco que el índice único de la tabla: coalesce a un uuid fijo para tratar
// "sin sede" como una sola sede al buscar/guardar (ver drizzle/0005).
const NO_BRANCH = "00000000-0000-0000-0000-000000000000";
function branchExpr(branchId: string | null) {
  return branchId ?? NO_BRANCH;
}

export async function getCashClosure(orgId: string, dateISO: string, branchId: string | null) {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({
        closure: cashClosures,
        closedByName: user.name,
      })
      .from(cashClosures)
      .leftJoin(user, eq(user.id, cashClosures.closedBy))
      .where(
        and(
          eq(cashClosures.orgId, orgId),
          isNull(cashClosures.deletedAt),
          eq(sql`coalesce(${cashClosures.branchId}, ${NO_BRANCH}::uuid)`, branchExpr(branchId)),
          eq(cashClosures.businessDate, dateISO),
        ),
      )
      .limit(1);
    if (!row) return null;

    let reopenedByName: string | null = null;
    if (row.closure.reopenedBy) {
      const [u] = await tx
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, row.closure.reopenedBy))
        .limit(1);
      reopenedByName = u?.name ?? null;
    }
    return { ...row, reopenedByName };
  });
}

// Lo esperado en caja: base + efectivo cobrado - gastos en efectivo del día/sede. Sin
// filtrar por usuario (a diferencia de la vista de Recepción) — el cierre siempre suma
// TODO el efectivo; el arqueo ciego (Fase 5 slice 0) solo oculta la cifra en la UI, no
// cambia el cálculo.
export async function computeExpectedCashCents(
  orgId: string,
  dateISO: string,
  branchId: string | null,
  openingCashCents: number,
) {
  const [close, cashExpenses] = await Promise.all([
    getCashClose(orgId, dateISO, {}),
    getCashExpensesTotal(orgId, dateISO, branchId),
  ]);
  const cashSales = branchId
    ? close.completed
        .filter((p) => p.branchId === branchId && p.method === "cash")
        .reduce((a, p) => a + p.amountCents, 0)
    : (close.byMethod.find((m) => m.method === "cash")?.total ?? 0);
  return openingCashCents + cashSales - cashExpenses;
}

export async function listCashClosures(orgId: string, limit = 30) {
  return withTenant(orgId, (tx) =>
    tx
      .select({ closure: cashClosures, closedByName: user.name })
      .from(cashClosures)
      .leftJoin(user, eq(user.id, cashClosures.closedBy))
      .where(and(eq(cashClosures.orgId, orgId), isNull(cashClosures.deletedAt)))
      .orderBy(desc(cashClosures.businessDate))
      .limit(limit),
  );
}

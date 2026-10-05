import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can, requirePermission } from "@/lib/auth/authorize";
import { dateTimeFmt } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_STATUS_LABELS } from "@/modules/expenses/constants";
import { getExpense } from "@/modules/expenses/queries";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/constants";
import { VoidExpenseDialog } from "./void-expense-dialog";

export const metadata: Metadata = { title: "Gasto — AdminFit" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-muted-foreground w-40 shrink-0 text-sm">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function ExpenseDetailPage(props: PageProps<"/app/[orgSlug]/expenses/[id]">) {
  const { orgSlug, id } = await props.params;
  const ctx = await requirePermission(orgSlug, { expense: ["read"] });
  const { org } = ctx;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const canSeeAll = can(ctx, { expense: ["readAll"] });
  const data = await getExpense(org.id, id, canSeeAll ? {} : { recordedBy: ctx.userId });
  if (!data) notFound();
  // Sin readPayroll no se ve el detalle de un gasto de nómina, aunque exista.
  if (data.expense.category === "payroll" && !can(ctx, { expense: ["readPayroll"] })) notFound();

  const { expense, branchName, recordedByName, voidedByName } = data;
  const canVoid = expense.status === "completed" && can(ctx, { expense: ["void"] });
  const base = `/app/${org.slug}/expenses`;

  return (
    <>
      <PageHeader
        title="Detalle de gasto"
        description={expense.description}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              nativeButton={false}
              render={<Link href={base} />}
            >
              <ArrowLeft data-icon="inline-start" />
              <span className="hidden sm:inline">Gastos</span>
            </Button>
            {canVoid && <VoidExpenseDialog orgSlug={org.slug} expenseId={expense.id} />}
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {expense.status === "voided" && (
          <Alert variant="destructive">
            <AlertTitle>Gasto anulado</AlertTitle>
            <AlertDescription>
              {voidedByName ?? "Alguien"} lo anuló el{" "}
              {expense.voidedAt ? dateTimeFmt.format(expense.voidedAt) : "—"}
              {expense.voidReason ? `: ${expense.voidReason}` : "."}
            </AlertDescription>
          </Alert>
        )}

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Detalle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <Row label="Monto">
                <span className="text-xl font-semibold tabular-nums">
                  {formatCOP(expense.amountCents)}
                </span>
              </Row>
              <Row label="Estado">
                <Badge variant={expense.status === "voided" ? "destructive" : "secondary"}>
                  {EXPENSE_STATUS_LABELS[expense.status]}
                </Badge>
              </Row>
              <Row label="Categoría">{EXPENSE_CATEGORY_LABELS[expense.category]}</Row>
              <Row label="Descripción">{expense.description}</Row>
              <Row label="Fecha">{dateTimeFmt.format(expense.spentAt)}</Row>
              <Row label="Método">{PAYMENT_METHOD_LABELS[expense.method]}</Row>
              {branchName && <Row label="Sede">{branchName}</Row>}
              <Row label="Registró">{recordedByName ?? "—"}</Row>
              {expense.notes && <Row label="Notas">{expense.notes}</Row>}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

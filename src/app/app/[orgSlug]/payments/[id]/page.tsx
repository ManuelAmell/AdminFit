import type { Metadata } from "next";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleCan } from "@/lib/auth/authorize";
import { requireOrg } from "@/lib/auth/session";
import { dateTimeFmt, formatDate } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatReceiptNumber,
} from "@/modules/payments/constants";
import { getOrgReceiptInfo, getPayment, getSubscriptionBalance } from "@/modules/payments/queries";
import { VoidPaymentDialog } from "./void-payment-dialog";

export const metadata: Metadata = { title: "Detalle de pago — AdminFit" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-muted-foreground w-40 shrink-0 text-sm">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function PaymentDetailPage(props: PageProps<"/app/[orgSlug]/payments/[id]">) {
  const { orgSlug, id } = await props.params;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, info] = await Promise.all([getPayment(org.id, id), getOrgReceiptInfo(org.id)]);
  if (!data) notFound();
  const { payment, member, subscription, planName, receivedByName, voidedByName } = data;
  const balance = subscription?.id ? await getSubscriptionBalance(org.id, subscription.id) : null;

  const receiptLabel = formatReceiptNumber(
    info.settings?.receiptPrefix ?? "REC",
    payment.receiptNumber,
  );
  const canVoid =
    payment.status === "completed" && (isSuperadmin || roleCan(role, { payment: ["void"] }));
  const base = `/app/${org.slug}/payments`;

  return (
    <>
      <PageHeader
        title={`Recibo ${receiptLabel}`}
        description={`${member.firstName} ${member.lastName}`}
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
              <span className="hidden sm:inline">Pagos</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              nativeButton={false}
              render={<Link href={`${base}/${payment.id}/receipt`} />}
            >
              <Printer data-icon="inline-start" />
              Recibo
            </Button>
            {canVoid && (
              <VoidPaymentDialog
                orgSlug={org.slug}
                paymentId={payment.id}
                receiptLabel={receiptLabel}
              />
            )}
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {payment.status === "voided" && (
          <Alert variant="destructive">
            <AlertTitle>Pago anulado</AlertTitle>
            <AlertDescription>
              {voidedByName ?? "Alguien"} lo anuló el{" "}
              {payment.voidedAt ? dateTimeFmt.format(payment.voidedAt) : "—"}
              {payment.voidReason ? `: ${payment.voidReason}` : "."}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                Detalle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3">
                <Row label="Monto">
                  <span className="text-xl font-semibold tabular-nums">
                    {formatCOP(payment.amountCents)}
                  </span>
                </Row>
                <Row label="Estado">
                  <Badge variant={payment.status === "voided" ? "destructive" : "secondary"}>
                    {PAYMENT_STATUS_LABELS[payment.status]}
                  </Badge>
                </Row>
                <Row label="Fecha de pago">{dateTimeFmt.format(payment.paidAt)}</Row>
                <Row label="Método">
                  {PAYMENT_METHOD_LABELS[payment.method]}
                  {payment.reference && (
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      {payment.reference}
                    </span>
                  )}
                </Row>
                <Row label="Recibió">{receivedByName ?? "—"}</Row>
                {payment.notes && <Row label="Notas">{payment.notes}</Row>}
              </dl>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                  Socio
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {member.firstName} {member.lastName}
                </span>
                <span className="text-muted-foreground">
                  {member.documentType} {member.documentNumber}
                </span>
                {member.phone && <span className="text-muted-foreground">{member.phone}</span>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                  Membresía
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {subscription?.id ? (
                  <>
                    <span className="font-medium">{planName}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatDate(subscription.startDate)} → {formatDate(subscription.endDate)}
                    </span>
                    {balance && (
                      <dl className="mt-1 grid grid-cols-2 gap-y-1">
                        <dt className="text-muted-foreground">Precio</dt>
                        <dd className="text-right tabular-nums">{formatCOP(balance.priceCents)}</dd>
                        <dt className="text-muted-foreground">Pagado</dt>
                        <dd className="text-right tabular-nums">{formatCOP(balance.paidCents)}</dd>
                        <dt className="font-medium">Saldo</dt>
                        <dd
                          className={
                            "text-right font-medium tabular-nums " +
                            (balance.balanceCents > 0 ? "text-destructive" : "text-success")
                          }
                        >
                          {formatCOP(balance.balanceCents)}
                        </dd>
                      </dl>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">Abono sin membresía asociada.</span>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

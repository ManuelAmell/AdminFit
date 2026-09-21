import type { Metadata } from "next";
import { ArrowLeft, Dumbbell } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireOrg } from "@/lib/auth/session";
import { dateTimeFmt, formatDate } from "@/lib/dates";
import { centsToPesos, formatCOP } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, formatReceiptNumber } from "@/modules/payments/constants";
import { PrintButton } from "@/modules/payments/print/print-button";
import { PrintStyles } from "@/modules/payments/print/print-styles";
import { pesosToWords } from "@/modules/payments/print/number-to-words";
import { getOrgReceiptInfo, getPayment, getSubscriptionBalance } from "@/modules/payments/queries";

export const metadata: Metadata = { title: "Recibo — AdminFit" };

export default async function ReceiptPage(
  props: PageProps<"/app/[orgSlug]/payments/[id]/receipt">,
) {
  const { orgSlug, id } = await props.params;
  const { org } = await requireOrg(orgSlug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, info] = await Promise.all([getPayment(org.id, id), getOrgReceiptInfo(org.id)]);
  if (!data) notFound();
  const { payment, member, subscription, planName, receivedByName } = data;
  const balance = subscription?.id ? await getSubscriptionBalance(org.id, subscription.id) : null;
  const settings = info.settings;
  const receiptLabel = formatReceiptNumber(settings?.receiptPrefix ?? "REC", payment.receiptNumber);
  const concept = subscription?.id
    ? `Membresía ${planName} (${formatDate(subscription.startDate)} – ${formatDate(subscription.endDate)})`
    : "Abono a cuenta";
  const base = `/app/${org.slug}/payments`;

  return (
    <>
      <PrintStyles />
      <div data-print-hide>
        <PageHeader
          title={`Recibo ${receiptLabel}`}
          description="Vista de impresión"
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                nativeButton={false}
                render={<Link href={`${base}/${payment.id}`} />}
              >
                <ArrowLeft data-icon="inline-start" />
                Volver
              </Button>
              <PrintButton className="h-9" />
            </>
          }
        />
      </div>

      <div className="flex flex-1 flex-col items-center p-4 md:p-8">
        <article
          data-print-area
          className="bg-card text-card-foreground w-full max-w-2xl rounded-xl border p-8 shadow-sm print:text-black"
          aria-label={`Recibo de pago ${receiptLabel}`}
        >
          <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
            <div className="flex items-center gap-3">
              <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg print:border print:border-black print:bg-transparent print:text-black">
                <Dumbbell className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-semibold">{info.org?.name ?? org.name}</span>
                {settings?.nit && (
                  <span className="text-muted-foreground text-sm">NIT {settings.nit}</span>
                )}
                {(settings?.address || info.org?.city) && (
                  <span className="text-muted-foreground text-sm">
                    {[settings?.address, info.org?.city].filter(Boolean).join(" · ")}
                  </span>
                )}
                {settings?.phone && (
                  <span className="text-muted-foreground text-sm">Tel. {settings.phone}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end text-right leading-tight">
              <span className="text-muted-foreground text-xs tracking-wide uppercase">
                Recibo de pago
              </span>
              <span className="font-mono text-xl font-semibold">{receiptLabel}</span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {dateTimeFmt.format(payment.paidAt)}
              </span>
              {payment.status === "voided" && (
                <span className="text-destructive mt-1 text-sm font-semibold uppercase">
                  Anulado
                </span>
              )}
            </div>
          </header>

          <section className="grid gap-6 py-6 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs tracking-wide uppercase">
                Recibido de
              </span>
              <span className="font-medium">
                {member.firstName} {member.lastName}
              </span>
              <span className="text-muted-foreground text-sm">
                {member.documentType} {member.documentNumber}
              </span>
              {member.phone && (
                <span className="text-muted-foreground text-sm">{member.phone}</span>
              )}
            </div>
            <div className="flex flex-col gap-1 sm:text-right">
              <span className="text-muted-foreground text-xs tracking-wide uppercase">
                Forma de pago
              </span>
              <span className="font-medium">{PAYMENT_METHOD_LABELS[payment.method]}</span>
              {payment.reference && (
                <span className="text-muted-foreground font-mono text-sm">{payment.reference}</span>
              )}
            </div>
          </section>

          <table className="w-full border-t border-b text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs tracking-wide uppercase">
                <th className="py-3 font-medium">Concepto</th>
                <th className="py-3 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3">{concept}</td>
                <td className="py-3 text-right font-medium tabular-nums">
                  {formatCOP(payment.amountCents)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="py-3 font-semibold">Total recibido</td>
                <td className="py-3 text-right text-lg font-semibold tabular-nums">
                  {formatCOP(payment.amountCents)}
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="text-muted-foreground mt-3 text-sm">
            Son:{" "}
            <span className="first-letter:uppercase">
              {pesosToWords(centsToPesos(payment.amountCents))}
            </span>
            .
          </p>

          {balance && (
            <dl className="mt-6 grid max-w-xs grid-cols-2 gap-y-1 text-sm sm:ml-auto">
              <dt className="text-muted-foreground">Valor membresía</dt>
              <dd className="text-right tabular-nums">{formatCOP(balance.priceCents)}</dd>
              <dt className="text-muted-foreground">Total pagado</dt>
              <dd className="text-right tabular-nums">{formatCOP(balance.paidCents)}</dd>
              <dt className="font-medium">Saldo pendiente</dt>
              <dd className="text-right font-medium tabular-nums">
                {formatCOP(Math.max(0, balance.balanceCents))}
              </dd>
            </dl>
          )}

          {payment.notes && (
            <p className="text-muted-foreground mt-6 text-sm">Notas: {payment.notes}</p>
          )}

          <footer className="text-muted-foreground mt-8 flex flex-wrap items-end justify-between gap-6 border-t pt-6 text-xs">
            <span>Recibió: {receivedByName ?? "—"}</span>
            <div className="flex flex-col items-center gap-1">
              <span className="block w-48 border-t border-current pt-1 text-center">
                Firma y sello
              </span>
            </div>
          </footer>
        </article>
      </div>
    </>
  );
}

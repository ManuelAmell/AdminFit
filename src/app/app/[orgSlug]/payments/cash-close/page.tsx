import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireOrg } from "@/lib/auth/session";
import { DEFAULT_TZ, formatDate, todayISO } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/modules/payments/constants";
import { PrintButton } from "@/modules/payments/print/print-button";
import { PrintStyles } from "@/modules/payments/print/print-styles";
import { getCashClose } from "@/modules/payments/queries";
import { CashCloseDatePicker } from "./date-picker";

export const metadata: Metadata = { title: "Cierre de caja — AdminFit" };

const timeFmt = new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone: DEFAULT_TZ });

export default async function CashClosePage(
  props: PageProps<"/app/[orgSlug]/payments/cash-close">,
) {
  const { orgSlug } = await props.params;
  const { date } = await props.searchParams;
  const { org } = await requireOrg(orgSlug);
  const dateISO = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
  const close = await getCashClose(org.id, dateISO);
  const base = `/app/${org.slug}/payments`;

  return (
    <>
      <PrintStyles />
      <div data-print-hide>
        <PageHeader
          title="Cierre de caja"
          description={formatDate(dateISO)}
          actions={
            <>
              <CashCloseDatePicker value={dateISO} />
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
              <PrintButton className="h-9" />
            </>
          }
        />
      </div>

      <div data-print-area className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="hidden print:block">
          <h1 className="text-xl font-semibold">Cierre de caja — {org.name}</h1>
          <p className="text-sm">{formatDate(dateISO)}</p>
        </div>

        <section aria-label="Resumen" className="grid gap-4 md:grid-cols-3">
          <Card className="gap-1 py-4">
            <CardHeader className="pb-0">
              <CardDescription>Total del día</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCOP(close.total)}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              {close.completed.length} {close.completed.length === 1 ? "pago" : "pagos"} ·{" "}
              {close.voided.length} {close.voided.length === 1 ? "anulado" : "anulados"}
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Por método
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Método</TableHead>
                    <TableHead className="text-right">Pagos</TableHead>
                    <TableHead className="pr-6 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {close.byMethod.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground pl-6">
                        Sin pagos completados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    close.byMethod.map((m) => (
                      <TableRow key={m.method}>
                        <TableCell className="pl-6">
                          {PAYMENT_METHOD_LABELS[m.method as PaymentMethod]}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{m.n}</TableCell>
                        <TableCell className="pr-6 text-right font-medium tabular-nums">
                          {formatCOP(m.total)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Por persona que recibió
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Usuario</TableHead>
                  <TableHead className="text-right">Pagos</TableHead>
                  <TableHead className="pr-6 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {close.byUser.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground pl-6">
                      Sin pagos completados.
                    </TableCell>
                  </TableRow>
                ) : (
                  close.byUser.map((u) => (
                    <TableRow key={u.name}>
                      <TableCell className="pl-6">{u.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{u.n}</TableCell>
                      <TableCell className="pr-6 text-right font-medium tabular-nums">
                        {formatCOP(u.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {close.byBranch.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Por sede
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Sede</TableHead>
                    <TableHead className="text-right">Pagos</TableHead>
                    <TableHead className="pr-6 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {close.byBranch.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="pl-6">{b.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.n}</TableCell>
                      <TableCell className="pr-6 text-right font-medium tabular-nums">
                        {formatCOP(b.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Pagos del día
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Recibo</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Socio</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Recibió</TableHead>
                    <TableHead className="pr-6 text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {close.completed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground pl-6">
                        No hay pagos completados este día.
                      </TableCell>
                    </TableRow>
                  ) : (
                    close.completed.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="pl-6 font-mono text-xs">
                          <Link
                            href={`${base}/${p.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            #{String(p.receiptNumber).padStart(6, "0")}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular-nums">{timeFmt.format(p.paidAt)}</TableCell>
                        <TableCell>
                          {p.memberFirstName} {p.memberLastName}
                        </TableCell>
                        <TableCell>
                          {PAYMENT_METHOD_LABELS[p.method]}
                          {p.reference && (
                            <span className="text-muted-foreground ml-1 font-mono text-xs">
                              {p.reference}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.receivedByName ?? "—"}
                        </TableCell>
                        <TableCell className="pr-6 text-right font-medium tabular-nums">
                          {formatCOP(p.amountCents)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {close.completed.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="pl-6 font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="pr-6 text-right font-semibold tabular-nums">
                        {formatCOP(close.total)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>

        {close.voided.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Anulados
              </CardTitle>
              <CardDescription>No cuentan en los totales.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Recibo</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Socio</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="pr-6 text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {close.voided.map((p) => (
                      <TableRow key={p.id} className="text-muted-foreground">
                        <TableCell className="pl-6 font-mono text-xs">
                          <Link
                            href={`${base}/${p.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            #{String(p.receiptNumber).padStart(6, "0")}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular-nums">{timeFmt.format(p.paidAt)}</TableCell>
                        <TableCell>
                          {p.memberFirstName} {p.memberLastName}
                        </TableCell>
                        <TableCell>{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                        <TableCell className="pr-6 text-right tabular-nums line-through">
                          {formatCOP(p.amountCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

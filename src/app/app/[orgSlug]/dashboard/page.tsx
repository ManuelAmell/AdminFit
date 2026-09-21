import type { Metadata } from "next";
import { CreditCard, Receipt, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireOrg } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { getDashboardKpis, listUpcomingExpirations } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Dashboard — AdminFit" };

export default async function DashboardPage({ params }: PageProps<"/app/[orgSlug]/dashboard">) {
  const { orgSlug } = await params;
  const { org } = await requireOrg(orgSlug);
  const base = `/app/${org.slug}`;

  const { counts, revenueCentsThisMonth } = await getDashboardKpis(org.id);

  const isNewOrg = counts.active + counts.expired + counts.frozen + counts.cancelled === 0;

  if (isNewOrg) {
    const nextSteps = [
      {
        icon: Users,
        title: "Registra tu primer socio",
        description: "Crea la ficha con documento, contacto y foto.",
        href: `${base}/members`,
      },
      {
        icon: CreditCard,
        title: "Crea tus planes",
        description: "Mensual, trimestral, por visitas — con precio en COP.",
        href: `${base}/plans`,
      },
      {
        icon: Receipt,
        title: "Registra pagos",
        description: "Efectivo o transferencia, con recibo numerado.",
        href: `${base}/payments`,
      },
    ];

    return (
      <>
        <PageHeader title="Dashboard" description={org.name} />
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <section aria-labelledby="next-steps-heading" className="flex flex-col gap-3">
            <h2 id="next-steps-heading" className="text-sm font-medium">
              Primeros pasos
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {nextSteps.map((step) => (
                <Card key={step.href}>
                  <CardHeader>
                    <step.icon className="text-primary size-5" aria-hidden="true" />
                    <CardTitle className="text-base">{step.title}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-fit"
                      nativeButton={false}
                      render={<Link href={step.href} />}
                    >
                      Ir
                    </Button>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </>
    );
  }

  const expirations = await listUpcomingExpirations(org.id);

  const kpis = [
    {
      label: "Membresías activas",
      value: String(counts.active),
      href: `${base}/memberships?filter=active`,
    },
    {
      label: "Ingresos este mes",
      value: formatCOP(revenueCentsThisMonth),
      href: `${base}/payments`,
    },
    {
      label: "Por vencer (5 días)",
      value: String(counts.expiring),
      href: `${base}/memberships?filter=expiring`,
    },
    {
      label: "Vencidas",
      value: String(counts.expired),
      href: `${base}/memberships?filter=expired`,
    },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={org.name} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="block">
              <Card className="hover:border-primary/40 gap-1 py-4 transition-colors">
                <CardHeader className="pb-0">
                  <CardDescription>{k.label}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{k.value}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Próximos vencimientos
            </CardTitle>
            <CardDescription>Membresías activas que vencen en los próximos 5 días.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Socio</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="pr-6 text-right">Vence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expirations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground pl-6">
                      No hay membresías por vencer en los próximos días.
                    </TableCell>
                  </TableRow>
                ) : (
                  expirations.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-6">
                        <Link
                          href={`${base}/members/${e.memberId}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {e.firstName} {e.lastName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.planName}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {formatDate(e.endDate)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

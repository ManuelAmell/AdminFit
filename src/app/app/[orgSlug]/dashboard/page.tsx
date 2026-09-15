import type { Metadata } from "next";
import { CreditCard, Receipt, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard — AdminFit" };

export default async function DashboardPage({ params }: PageProps<"/app/[orgSlug]/dashboard">) {
  const { orgSlug } = await params;
  const { org } = await requireOrg(orgSlug);
  const base = `/app/${org.slug}`;

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

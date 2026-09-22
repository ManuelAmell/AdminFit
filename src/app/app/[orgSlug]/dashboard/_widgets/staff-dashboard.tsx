import { CreditCard, Lock, Receipt, UserPlus, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaggerGroup, StaggerItem } from "@/components/motion/stagger-list";
import { MoneyFlow } from "@/components/motion/money-flow";
import { todayISO } from "@/lib/dates";
import { getCashClosure } from "@/modules/cash/queries";
import { getCashClose } from "@/modules/payments/queries";
import type { UpcomingExpiration } from "@/modules/reports/queries";

// Vista "Mi turno" del dashboard (Recepción, sin finance.read): acciones del día a día y
// lo que le toca cobrar, sin ninguna cifra agregada del negocio (esas ni se consultan
// aquí — no es que se oculten en la UI, ver Fase 5 slice 0).
export async function StaffDashboard({
  orgId,
  userId,
  base,
  expirations,
}: {
  orgId: string;
  userId: string;
  base: string;
  expirations: UpcomingExpiration[];
}) {
  const today = todayISO();
  const [myClose, closureRow] = await Promise.all([
    getCashClose(orgId, today, { receivedBy: userId }),
    getCashClosure(orgId, today, null),
  ]);

  const actions = [
    { label: "Venta rápida", href: `${base}/payments/quick`, icon: Zap },
    { label: "Vender membresía", href: `${base}/memberships/new`, icon: CreditCard },
    { label: "Registrar pago", href: `${base}/payments/new`, icon: Receipt },
    { label: "Nuevo socio", href: `${base}/members/new`, icon: UserPlus },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StaggerGroup aria-label="Acciones" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a, i) => (
          <StaggerItem index={i} key={a.label}>
            <Button
              size="lg"
              variant="outline"
              className="h-16 w-full justify-start gap-3 text-base"
              nativeButton={false}
              render={<Link href={a.href} />}
            >
              <a.icon className="text-primary size-5" aria-hidden="true" />
              {a.label}
            </Button>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-1 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Mis cobros de hoy</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              <MoneyFlow cents={myClose.total} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {myClose.completed.length}{" "}
            {myClose.completed.length === 1 ? "cobro registrado" : "cobros registrados"}
          </CardContent>
        </Card>

        <Card className="gap-1 py-4">
          <CardHeader className="pb-0">
            <CardDescription>Caja de hoy</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              {closureRow ? (
                <>
                  <Lock className="text-muted-foreground size-4" aria-hidden="true" />
                  Cerrada
                </>
              ) : (
                "Abierta"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              nativeButton={false}
              render={<Link href={`${base}/payments/cash-close`} />}
            >
              {closureRow ? "Ver cierre" : "Cerrar caja"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Vencen pronto
          </CardTitle>
          <CardDescription>Membresías activas que vencen en los próximos días.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {expirations.length === 0 ? (
            <p className="text-muted-foreground px-6 pb-2 text-sm">
              No hay membresías por vencer en los próximos días.
            </p>
          ) : (
            <ul className="flex flex-col">
              {expirations.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-6 py-2 text-sm">
                  <Link
                    href={`${base}/members/${e.memberId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {e.firstName} {e.lastName}
                  </Link>
                  <span className="text-muted-foreground">{e.planName}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`${base}/payments/debts`} />}
        >
          Ver cartera
        </Button>
      </div>
    </div>
  );
}

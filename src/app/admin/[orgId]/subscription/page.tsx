import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
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
import { requireSuperadmin } from "@/lib/auth/session";
import { formatDate, todayISO } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import {
  getCurrentSubscription,
  getSubscriptionHistory,
  listActivePlatformPlans,
} from "@/modules/platform/queries";
import { AssignSubscriptionForm } from "./assign-subscription-form";

export const metadata: Metadata = { title: "Gestión de Suscripción — Plataforma AdminFit" };

export default async function OrgSubscriptionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requireSuperadmin();
  const { orgId } = await params;

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
  });

  if (!org) notFound();

  const [activePlans, currentSub, history] = await Promise.all([
    listActivePlatformPlans(),
    getCurrentSubscription(orgId),
    getSubscriptionHistory(orgId),
  ]);

  const today = todayISO();
  const isExpired = currentSub ? currentSub.endDate < today : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/admin/gyms" />}
        >
          <ArrowLeft data-icon="inline-start" className="size-4" />
          Volver a gimnasios
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
          <p className="text-muted-foreground text-sm">
            Control de suscripción, asignación de planes e historial de renovaciones SaaS.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">
              Estado actual del servicio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentSub ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Plan:</span>
                  <span className="font-semibold">{currentSub.plan?.name ?? "Personalizado"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Tarifa asignada:</span>
                  <span className="font-medium tabular-nums">
                    {formatCOP(currentSub.priceCentsSnapshot)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Modalidad:</span>
                  <Badge variant={currentSub.status === "trial" ? "outline" : "default"}>
                    {currentSub.status === "trial" ? "Prueba gratuita (Trial)" : "Activo"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Fecha inicio:</span>
                  <span className="text-sm">{formatDate(currentSub.startDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Fecha vencimiento:</span>
                  <span className="text-sm font-medium">{formatDate(currentSub.endDate)}</span>
                </div>
                <div className="border-t pt-2">
                  {isExpired ? (
                    <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-2.5 text-xs font-medium">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>Suscripción vencida desde el {formatDate(currentSub.endDate)}.</span>
                    </div>
                  ) : (
                    <div className="bg-primary/10 text-primary flex items-center gap-2 rounded-md p-2.5 text-xs font-medium">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>Servicio activo y vigente.</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground py-4 text-center text-sm">
                <Clock className="mx-auto mb-2 size-6 opacity-40" />
                Este gimnasio no tiene ninguna suscripción activa ni registrada.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <AssignSubscriptionForm orgId={org.id} plans={activePlans} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Historial de renovaciones
          </CardTitle>
          <CardDescription>
            Registro de todas las activaciones y extensiones otorgadas a este gimnasio.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Fecha asignación</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Tarifa</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Asignado por</TableHead>
                  <TableHead className="pr-6">Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground py-6 text-center text-sm"
                    >
                      Sin historial de suscripciones registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="pl-6 text-sm tabular-nums">
                        {formatDate(h.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {h.plan?.name ?? "Plan eliminado"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={h.status === "trial" ? "outline" : "secondary"}>
                          {h.status === "trial" ? "Trial" : "Activo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatCOP(h.priceCentsSnapshot)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatDate(h.startDate)} → {formatDate(h.endDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {h.assignedByUser?.name ?? "Superadmin"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate pr-6 text-xs">
                        {h.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

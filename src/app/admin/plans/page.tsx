import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
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
import { formatCOP } from "@/lib/money";
import { listPlatformPlans } from "@/modules/platform/queries";
import { PlanRowActions } from "./plan-actions";
import { PlatformPlanDialog } from "./plan-dialog";

export const metadata: Metadata = { title: "Planes SaaS — Plataforma AdminFit" };

export default async function AdminPlansPage() {
  await requireSuperadmin();
  const plans = await listPlatformPlans();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle role="heading" aria-level={2}>
            Planes SaaS
          </CardTitle>
          <CardDescription>
            Tarifas y límites disponibles para cobrar el uso de AdminFit a los gimnasios.
          </CardDescription>
        </div>
        <PlatformPlanDialog />
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Plan</TableHead>
                <TableHead>Precio mensual</TableHead>
                <TableHead>Límite Socios</TableHead>
                <TableHead>Límite Sedes</TableHead>
                <TableHead>Límite Equipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="pr-6 text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    No has creado ningún plan SaaS todavía. Haz clic en &quot;Nuevo plan SaaS&quot;
                    para comenzar.
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6">
                      <div className="flex flex-col">
                        <span className="font-medium">{p.name}</span>
                        {p.description && (
                          <span className="text-muted-foreground text-xs">{p.description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatCOP(p.priceCents)}
                    </TableCell>
                    <TableCell>
                      {p.maxMembers ? (
                        <span className="tabular-nums">{p.maxMembers}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Ilimitado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.maxBranches ? (
                        <span className="tabular-nums">{p.maxBranches}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Ilimitado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.maxStaff ? (
                        <span className="tabular-nums">{p.maxStaff}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Ilimitado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "default" : "secondary"}>
                        {p.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <PlanRowActions plan={p} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Archive, ArchiveRestore, ListChecks, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { archivePlan, restorePlan } from "@/modules/plans/actions";
import type { PlanWithUsage } from "@/modules/plans/queries";
import { PLAN_COLOR_DOT, durationLabel, type PlanColor } from "@/modules/plans/schema";
import { PlanDialog } from "./plan-dialog";

export function PlansTable({
  orgSlug,
  plans,
  canManage,
}: {
  orgSlug: string;
  plans: PlanWithUsage[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [archiveTarget, setArchiveTarget] = useState<PlanWithUsage | null>(null);

  async function confirmArchive() {
    if (!archiveTarget) return;
    const res = await archivePlan(orgSlug, archiveTarget.id);
    setArchiveTarget(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      archiveTarget.subscriptionCount > 0
        ? `"${archiveTarget.name}" archivado. Sus membresías vigentes no cambian.`
        : `"${archiveTarget.name}" eliminado.`,
    );
    startTransition(() => router.refresh());
  }

  async function restore(plan: PlanWithUsage) {
    const res = await restorePlan(orgSlug, plan.id);
    if (!res.ok) return toast.error(res.error);
    toast.success(`"${plan.name}" vuelve a estar disponible.`);
    startTransition(() => router.refresh());
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-xl">
            <ListChecks className="size-6" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-medium">Aún no tienes planes</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Crea tu primer plan (por ejemplo, Mensual a $120.000) para empezar a vender
              membresías.
            </p>
          </div>
          {canManage && <PlanDialog orgSlug={orgSlug} />}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Plan</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Visitas</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Membresías</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && (
                    <TableHead className="pr-6 text-right">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow
                    key={plan.id}
                    data-plan-id={plan.id}
                    className={cn(!plan.isActive && "text-muted-foreground")}
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "size-2.5 shrink-0 rounded-full",
                            PLAN_COLOR_DOT[plan.color as PlanColor] ?? PLAN_COLOR_DOT.slate,
                          )}
                          aria-hidden="true"
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{plan.name}</span>
                          {plan.description && (
                            <span className="text-muted-foreground line-clamp-1 text-xs">
                              {plan.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{durationLabel(plan.durationType, plan.durationValue)}</TableCell>
                    <TableCell className="tabular-nums">
                      {plan.visitLimit ?? "Ilimitadas"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCOP(plan.priceCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {plan.subscriptionCount}
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.isActive ? "secondary" : "outline"}>
                        {plan.isActive ? "Disponible" : "Archivado"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          <PlanDialog
                            orgSlug={orgSlug}
                            plan={plan}
                            trigger={(open) => (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                onClick={open}
                                aria-label={`Editar ${plan.name}`}
                              >
                                <Pencil />
                              </Button>
                            )}
                          />
                          {plan.isActive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive size-9"
                              onClick={() => setArchiveTarget(plan)}
                              disabled={pending}
                              aria-label={`Archivar ${plan.name}`}
                            >
                              <Archive />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              onClick={() => restore(plan)}
                              disabled={pending}
                              aria-label={`Reactivar ${plan.name}`}
                            >
                              <ArchiveRestore />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {archiveTarget && archiveTarget.subscriptionCount > 0 ? "Archivar" : "Eliminar"}{" "}
              {archiveTarget?.name}
            </DialogTitle>
            <DialogDescription>
              {archiveTarget && archiveTarget.subscriptionCount > 0
                ? `Tiene ${archiveTarget.subscriptionCount} membresía(s) asociada(s), así que no se elimina: dejará de aparecer al vender y podrás reactivarlo después.`
                : "No tiene membresías asociadas, así que se eliminará del catálogo."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmArchive}>
              {archiveTarget && archiveTarget.subscriptionCount > 0 ? "Archivar" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

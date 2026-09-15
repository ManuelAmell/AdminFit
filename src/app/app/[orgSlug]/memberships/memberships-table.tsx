"use client";

import {
  Ban,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  MoreHorizontal,
  RefreshCw,
  Snowflake,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, todayISO } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PLAN_COLOR_DOT, type PlanColor } from "@/modules/plans/schema";
import {
  cancelSubscription,
  freezeSubscription,
  renewSubscription,
  unfreezeSubscription,
} from "@/modules/subscriptions/actions";
import type { SubscriptionListResult, SubscriptionRow } from "@/modules/subscriptions/queries";
import { canCancel, canFreeze, canRenew, daysRemaining } from "@/modules/subscriptions/rules";
import { SubscriptionStatusBadge } from "@/modules/subscriptions/status-badge";

type Can = { sell: boolean; renew: boolean; freeze: boolean; cancel: boolean };
type PlanOpt = { id: string; name: string };
type Pending =
  | { kind: "renew"; sub: SubscriptionRow; planId: string }
  | { kind: "freeze"; sub: SubscriptionRow; frozenUntil: string }
  | { kind: "cancel"; sub: SubscriptionRow; reason: string };

export function MembershipsTable({
  orgSlug,
  result,
  plans,
  can,
}: {
  orgSlug: string;
  result: SubscriptionListResult;
  plans: PlanOpt[];
  can: Can;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [refreshing, startTransition] = useTransition();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function unfreeze(sub: SubscriptionRow) {
    const res = await unfreezeSubscription(orgSlug, { subscriptionId: sub.id });
    if (!res.ok) return toast.error(res.error);
    toast.success(`Membresía reactivada. Nueva fecha fin: ${formatDate(res.data.endDate)}.`);
    refresh();
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === "renew") {
        const res = await renewSubscription(orgSlug, {
          subscriptionId: pending.sub.id,
          planId: pending.planId,
        });
        if (!res.ok) return setError(res.error);
        toast.success(
          `Renovada: ${formatDate(res.data.startDate)} → ${formatDate(res.data.endDate)} · ${formatCOP(res.data.priceCents)}.`,
        );
      } else if (pending.kind === "freeze") {
        const res = await freezeSubscription(orgSlug, {
          subscriptionId: pending.sub.id,
          frozenUntil: pending.frozenUntil || undefined,
        });
        if (!res.ok) return setError(res.error);
        toast.success("Membresía congelada. Los días se recuperan al reactivarla.");
      } else {
        if (pending.reason.trim().length < 3)
          return setError("Cuéntanos el motivo (mínimo 3 caracteres).");
        const res = await cancelSubscription(orgSlug, {
          subscriptionId: pending.sub.id,
          reason: pending.reason.trim(),
        });
        if (!res.ok) return setError(res.error);
        toast.success("Membresía cancelada.");
      }
      setPending(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (result.rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-xl">
            <CreditCard className="size-6" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-medium">No hay membresías con este filtro</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              {result.total === 0 && can.sell
                ? "Vende la primera desde el botón de arriba: eliges socio, plan y fecha de inicio."
                : "Prueba con otro estado, plan o búsqueda."}
            </p>
          </div>
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
                  <TableHead className="pl-6">Socio</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="pr-6 text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((sub) => {
                  const days = daysRemaining(sub.endDate, today);
                  const showRenew = can.renew && canRenew(sub);
                  const showFreeze = can.freeze && canFreeze(sub, today);
                  const showUnfreeze = can.freeze && sub.status === "frozen";
                  const showCancel = can.cancel && canCancel(sub);
                  const hasActions = showRenew || showFreeze || showUnfreeze || showCancel;
                  return (
                    <TableRow key={sub.id} data-subscription-id={sub.id}>
                      <TableCell className="pl-6">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {sub.member.firstName} {sub.member.lastName}
                          </span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {sub.member.documentNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2.5 shrink-0 rounded-full",
                              PLAN_COLOR_DOT[sub.plan.color as PlanColor] ?? PLAN_COLOR_DOT.slate,
                            )}
                            aria-hidden="true"
                          />
                          {sub.plan.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <SubscriptionStatusBadge status={sub.derived} />
                          {(sub.derived === "al_dia" || sub.derived === "por_vencer") && (
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {days === 0 ? "Vence hoy" : `${days} día${days === 1 ? "" : "s"}`}
                            </span>
                          )}
                          {sub.derived === "congelado" && sub.frozenUntil && (
                            <span className="text-muted-foreground text-xs">
                              hasta {formatDate(sub.frozenUntil)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDate(sub.startDate)}</TableCell>
                      <TableCell className="tabular-nums">{formatDate(sub.endDate)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCOP(sub.priceCentsSnapshot)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        {hasActions && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-9"
                                  aria-label={`Acciones para ${sub.member.firstName} ${sub.member.lastName}`}
                                  disabled={refreshing}
                                />
                              }
                            >
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {showRenew && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setError(null);
                                    setPending({ kind: "renew", sub, planId: sub.plan.id });
                                  }}
                                >
                                  <RefreshCw />
                                  Renovar
                                </DropdownMenuItem>
                              )}
                              {showFreeze && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setError(null);
                                    setPending({ kind: "freeze", sub, frozenUntil: "" });
                                  }}
                                >
                                  <Snowflake />
                                  Congelar
                                </DropdownMenuItem>
                              )}
                              {showUnfreeze && (
                                <DropdownMenuItem onClick={() => unfreeze(sub)}>
                                  <Sun />
                                  Reactivar
                                </DropdownMenuItem>
                              )}
                              {showCancel && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => {
                                      setError(null);
                                      setPending({ kind: "cancel", sub, reason: "" });
                                    }}
                                  >
                                    <Ban />
                                    Cancelar membresía
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm tabular-nums">
            Página {result.page} de {totalPages} · {result.total} membresías
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={result.page <= 1}
              nativeButton={false}
              render={<Link href={pageHref(result.page - 1)} />}
            >
              <ChevronLeft data-icon="inline-start" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={result.page >= totalPages}
              nativeButton={false}
              render={<Link href={pageHref(result.page + 1)} />}
            >
              Siguiente
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </nav>
      )}

      <Dialog open={!!pending} onOpenChange={(open) => !open && !busy && setPending(null)}>
        <DialogContent>
          {pending?.kind === "renew" && (
            <>
              <DialogHeader>
                <DialogTitle>Renovar membresía</DialogTitle>
                <DialogDescription>
                  {pending.sub.member.firstName} {pending.sub.member.lastName}. La nueva membresía
                  empieza cuando termine la actual ({formatDate(pending.sub.endDate)}) o hoy si ya
                  venció. El pago se registra aparte.
                </DialogDescription>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="renew-plan">Plan</FieldLabel>
                <Select
                  items={plans.map((p) => ({ value: p.id, label: p.name }))}
                  value={pending.planId}
                  onValueChange={(v) => v && setPending({ ...pending, planId: v })}
                >
                  <SelectTrigger id="renew-plan" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
          {pending?.kind === "freeze" && (
            <>
              <DialogHeader>
                <DialogTitle>Congelar membresía</DialogTitle>
                <DialogDescription>
                  Mientras esté congelada no cuenta los días. Al reactivarla, la fecha de fin se
                  extiende por los días congelados.
                </DialogDescription>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="freeze-until">Reactivar el (opcional)</FieldLabel>
                <Input
                  id="freeze-until"
                  type="date"
                  min={today}
                  className="h-10"
                  value={pending.frozenUntil}
                  onChange={(e) => setPending({ ...pending, frozenUntil: e.target.value })}
                />
                <FieldDescription>Solo informativo: la reactivación es manual.</FieldDescription>
              </Field>
            </>
          )}
          {pending?.kind === "cancel" && (
            <>
              <DialogHeader>
                <DialogTitle>Cancelar membresía</DialogTitle>
                <DialogDescription>
                  Esta acción no se puede deshacer. El socio pierde el acceso desde hoy; los pagos
                  ya registrados no se modifican.
                </DialogDescription>
              </DialogHeader>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="cancel-reason">Motivo</FieldLabel>
                <Input
                  id="cancel-reason"
                  className="h-10"
                  placeholder="Se mudó de ciudad, lesión, insatisfacción…"
                  value={pending.reason}
                  onChange={(e) => setPending({ ...pending, reason: e.target.value })}
                  aria-invalid={!!error}
                />
              </Field>
            </>
          )}
          {error && <FieldError>{error}</FieldError>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
              Volver
            </Button>
            <Button
              variant={pending?.kind === "cancel" ? "destructive" : "default"}
              onClick={confirm}
              disabled={busy}
            >
              {busy && <Spinner />}
              {pending?.kind === "renew" && "Renovar"}
              {pending?.kind === "freeze" && "Congelar"}
              {pending?.kind === "cancel" && "Cancelar membresía"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  function pageHref(page: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(page));
    return `/app/${orgSlug}/memberships?${sp.toString()}`;
  }
}

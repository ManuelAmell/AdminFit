"use client";

import { ArrowLeft, CalendarCheck, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PLAN_COLOR_DOT, durationLabel, type PlanColor } from "@/modules/plans/schema";
import { sellSubscription } from "@/modules/subscriptions/actions";
import { MemberPicker, memberLabel, type PickedMember } from "@/components/forms/member-picker";
import { computeEndDate } from "@/modules/subscriptions/rules";

type PlanOpt = {
  id: string;
  name: string;
  priceCents: number;
  durationType: "days" | "months";
  durationValue: number;
  visitLimit: number | null;
  color: string;
};

export function SellForm({
  orgSlug,
  plans,
  preselectedMember,
  today,
}: {
  orgSlug: string;
  plans: PlanOpt[];
  preselectedMember: PickedMember | null;
  today: string;
}) {
  const router = useRouter();
  const [member, setMember] = useState<PickedMember | null>(preselectedMember);
  const [planId, setPlanId] = useState<string>(plans[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const endDate =
    plan && startDate ? computeEndDate(startDate, plan.durationType, plan.durationValue) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!member) next.memberId = "Selecciona un socio.";
    if (!plan) next.planId = "Selecciona un plan.";
    if (!startDate) next.startDate = "Ingresa la fecha de inicio.";
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length > 0 || !member || !plan) return;

    setSubmitting(true);
    try {
      const res = await sellSubscription(orgSlug, {
        memberId: member.id,
        planId: plan.id,
        startDate,
        notes,
      });
      if (!res.ok) {
        if (res.fieldErrors) {
          setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, v[0]])));
        }
        setServerError(res.fieldErrors ? null : res.error);
        return;
      }
      toast.success(
        `Membresía vendida a ${memberLabel(member)}: ${formatDate(res.data.startDate)} → ${formatDate(res.data.endDate)}.`,
      );
      router.push(`/app/${orgSlug}/memberships`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (plans.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No tienes planes disponibles. Crea uno en{" "}
          <Link href={`/app/${orgSlug}/plans`} className="font-medium underline underline-offset-4">
            Planes
          </Link>{" "}
          antes de vender una membresía.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              1. Socio
            </CardTitle>
            <CardDescription>Busca por nombre o número de documento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field data-invalid={!!errors.memberId}>
              <FieldLabel htmlFor="sell-member">Socio</FieldLabel>
              <MemberPicker
                inputId="sell-member"
                orgSlug={orgSlug}
                value={member}
                onChange={(m) => {
                  setMember(m);
                  setErrors((e) => ({ ...e, memberId: "" }));
                }}
                invalid={!!errors.memberId}
              />
              {errors.memberId && <FieldError>{errors.memberId}</FieldError>}
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              2. Plan
            </CardTitle>
            <CardDescription>
              El precio queda fijo en la membresía aunque cambie el plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Plan</legend>
              {plans.map((p) => {
                const selected = p.id === planId;
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "has-focus-visible:ring-ring/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-focus-visible:ring-3",
                      selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={p.id}
                      checked={selected}
                      onChange={() => setPlanId(p.id)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "mt-1 size-2.5 shrink-0 rounded-full",
                        PLAN_COLOR_DOT[p.color as PlanColor] ?? PLAN_COLOR_DOT.slate,
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{p.name}</span>
                        {selected && (
                          <Check className="text-primary size-4 shrink-0" aria-hidden="true" />
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {durationLabel(p.durationType, p.durationValue)}
                        {p.visitLimit ? ` · ${p.visitLimit} visitas` : ""}
                      </span>
                      <span className="mt-1 font-medium tabular-nums">
                        {formatCOP(p.priceCents)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {errors.planId && <FieldError className="mt-2">{errors.planId}</FieldError>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              3. Inicio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.startDate} className="max-w-xs">
                <FieldLabel htmlFor="sell-start">Fecha de inicio</FieldLabel>
                <Input
                  id="sell-start"
                  type="date"
                  className="h-10"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-invalid={!!errors.startDate}
                />
                <FieldDescription>
                  Si el socio ya tiene una membresía vigente, puedes poner el día siguiente a su
                  fin.
                </FieldDescription>
                {errors.startDate && <FieldError>{errors.startDate}</FieldError>}
              </Field>
              <Field className="max-w-lg">
                <FieldLabel htmlFor="sell-notes">Notas (opcional)</FieldLabel>
                <Input
                  id="sell-notes"
                  className="h-10"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={300}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Socio</dt>
            <dd className="truncate text-right font-medium">
              {member ? memberLabel(member) : "—"}
            </dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="truncate text-right font-medium">{plan?.name ?? "—"}</dd>
            <dt className="text-muted-foreground">Inicio</dt>
            <dd className="text-right tabular-nums">{startDate ? formatDate(startDate) : "—"}</dd>
            <dt className="text-muted-foreground">Fin</dt>
            <dd className="text-right font-medium tabular-nums" data-testid="sell-end-date">
              {endDate ? formatDate(endDate) : "—"}
            </dd>
          </dl>
          <div className="flex items-baseline justify-between border-t pt-4">
            <span className="text-muted-foreground text-sm">Total</span>
            <span className="text-2xl font-semibold tabular-nums">
              {plan ? formatCOP(plan.priceCents) : "—"}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            El pago se registra después en Pagos. La membresía queda activa desde la fecha de
            inicio.
          </p>
          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" className="h-11" disabled={submitting}>
              {submitting ? <Spinner /> : <CalendarCheck data-icon="inline-start" />}
              Vender membresía
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11"
              nativeButton={false}
              render={<Link href={`/app/${orgSlug}/memberships`} />}
            >
              <ArrowLeft data-icon="inline-start" />
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

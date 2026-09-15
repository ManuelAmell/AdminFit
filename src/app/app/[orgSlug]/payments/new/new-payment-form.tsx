"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/dates";
import { formatCOP, parsePesosInput } from "@/lib/money";
import { getMemberBillingContextAction, registerPayment } from "@/modules/payments/actions";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  REFERENCE_REQUIRED_METHODS,
  type PaymentMethod,
} from "@/modules/payments/constants";
import { MemberPicker, type PickedMember } from "@/components/forms/member-picker";
import { registerPaymentSchema, type RegisterPaymentInput } from "@/modules/payments/schema";

type Billing = Awaited<ReturnType<typeof getMemberBillingContextAction>>;

const methodItems = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

function formatPesosLive(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("es-CO").format(Number(digits));
}

function toLocalDatetimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewPaymentForm({
  orgSlug,
  initialMember,
}: {
  orgSlug: string;
  initialMember: PickedMember | null;
}) {
  const router = useRouter();
  const [member, setMember] = useState<PickedMember | null>(initialMember);
  const [billing, setBilling] = useState<Billing>(null);
  const [loadingBilling, startBilling] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterPaymentInput>({
    resolver: zodResolver(registerPaymentSchema),
    defaultValues: {
      memberId: initialMember?.id ?? "",
      subscriptionId: null,
      amount: "",
      method: "cash",
      reference: "",
      paidAt: "",
      notes: "",
    },
    mode: "onBlur",
  });
  const { errors, isSubmitting } = form.formState;
  const method = useWatch({ control: form.control, name: "method" }) as PaymentMethod;
  const subscriptionId = useWatch({ control: form.control, name: "subscriptionId" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const referenceRequired = REFERENCE_REQUIRED_METHODS.includes(method);

  const loadBilling = useCallback(
    (m: PickedMember) => {
      startBilling(async () => {
        const ctx = await getMemberBillingContextAction(orgSlug, m.id);
        setBilling(ctx);
        const first = ctx?.subscriptions[0];
        if (first) {
          form.setValue("subscriptionId", first.id);
          if (first.balance && first.balance.balanceCents > 0 && !form.getValues("amount")) {
            form.setValue(
              "amount",
              formatPesosLive(String(Math.round(first.balance.balanceCents / 100))),
            );
          }
        }
      });
    },
    [orgSlug, form],
  );

  function handleMemberChange(m: PickedMember | null) {
    setMember(m);
    setBilling(null);
    form.setValue("memberId", m?.id ?? "", { shouldValidate: !!m });
    form.setValue("subscriptionId", null);
    if (m) loadBilling(m);
  }

  // La hora se fija en el cliente para no desalinear SSR/hidratación.
  useEffect(() => {
    if (!form.getValues("paidAt")) form.setValue("paidAt", toLocalDatetimeValue(new Date()));
  }, [form]);

  // Socio precargado por URL (?memberId=): carga su contexto una sola vez.
  const initialLoaded = useRef(false);
  useEffect(() => {
    if (initialMember && !initialLoaded.current) {
      initialLoaded.current = true;
      loadBilling(initialMember);
    }
  }, [initialMember, loadBilling]);

  const selectedSub = billing?.subscriptions.find((s) => s.id === subscriptionId) ?? null;
  const amountCents = parsePesosInput(amount ?? "") ?? 0;
  const remainingAfter = selectedSub?.balance
    ? selectedSub.balance.balanceCents - amountCents
    : null;

  async function onSubmit(values: RegisterPaymentInput) {
    setServerError(null);
    const res = await registerPayment(orgSlug, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [key, message] of Object.entries(res.fieldErrors)) {
          form.setError(key as keyof RegisterPaymentInput, { message });
        }
      }
      setServerError(res.error);
      return;
    }
    toast.success(`Pago registrado. Recibo N.º ${res.data.receiptNumber}.`);
    router.push(`/app/${orgSlug}/payments/${res.data.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Field data-invalid={!!errors.memberId}>
          <FieldLabel htmlFor="member">Socio</FieldLabel>
          <MemberPicker
            orgSlug={orgSlug}
            inputId="member"
            value={member}
            onChange={handleMemberChange}
            invalid={!!errors.memberId}
          />
          <FieldError errors={[errors.memberId]} />
        </Field>

        {member && (
          <Field>
            <FieldLabel htmlFor="subscription">Membresía</FieldLabel>
            {loadingBilling ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Spinner /> Buscando membresías…
              </div>
            ) : billing && billing.subscriptions.length > 0 ? (
              <Controller
                control={form.control}
                name="subscriptionId"
                render={({ field }) => (
                  <Select
                    items={[
                      { value: "__none__", label: "Abono sin membresía" },
                      ...billing.subscriptions.map((s) => ({
                        value: s.id,
                        label: `${s.planName} · ${formatDate(s.startDate)} → ${formatDate(s.endDate)}`,
                      })),
                    ]}
                    value={field.value ?? "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                  >
                    <SelectTrigger id="subscription" className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Abono sin membresía</SelectItem>
                      {billing.subscriptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.planName} · {formatDate(s.startDate)} → {formatDate(s.endDate)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <FieldDescription>
                Este socio no tiene membresía vigente. El pago quedará como abono a su cuenta.
              </FieldDescription>
            )}
            {selectedSub?.balance && (
              <div className="bg-muted/50 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-sm">
                <span>
                  Precio:{" "}
                  <strong className="tabular-nums">
                    {formatCOP(selectedSub.balance.priceCents)}
                  </strong>
                </span>
                <span>
                  Pagado:{" "}
                  <strong className="tabular-nums">
                    {formatCOP(selectedSub.balance.paidCents)}
                  </strong>
                </span>
                <span className="flex items-center gap-1.5">
                  Saldo:
                  <Badge
                    variant={selectedSub.balance.balanceCents > 0 ? "destructive" : "secondary"}
                  >
                    <span className="tabular-nums">
                      {formatCOP(selectedSub.balance.balanceCents)}
                    </span>
                  </Badge>
                </span>
              </div>
            )}
          </Field>
        )}

        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="amount">Monto (COP)</FieldLabel>
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  $
                </span>
                <Input
                  id="amount"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-11 pl-7 text-lg font-medium tabular-nums"
                  aria-invalid={!!errors.amount}
                  aria-describedby="amount-help"
                  value={field.value}
                  onChange={(e) => field.onChange(formatPesosLive(e.target.value))}
                  onBlur={field.onBlur}
                />
              </div>
            )}
          />
          {remainingAfter !== null && amountCents > 0 && (
            <FieldDescription id="amount-help">
              {remainingAfter > 0
                ? `Quedará un saldo pendiente de ${formatCOP(remainingAfter)}.`
                : remainingAfter === 0
                  ? "Con este pago la membresía queda al día."
                  : `El pago supera el saldo por ${formatCOP(-remainingAfter)}.`}
            </FieldDescription>
          )}
          <FieldError errors={[errors.amount]} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="method">Método</FieldLabel>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <Select
                  items={methodItems}
                  value={field.value}
                  onValueChange={(v) => v && field.onChange(v)}
                >
                  <SelectTrigger id="method" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methodItems.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field data-invalid={!!errors.reference}>
            <FieldLabel htmlFor="reference">
              Referencia{" "}
              {referenceRequired ? (
                ""
              ) : (
                <span className="text-muted-foreground font-normal">(opcional)</span>
              )}
            </FieldLabel>
            <Input
              id="reference"
              autoComplete="off"
              className="h-11"
              placeholder={referenceRequired ? "N.º de aprobación / comprobante" : ""}
              aria-invalid={!!errors.reference}
              {...form.register("reference")}
            />
            <FieldError errors={[errors.reference]} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.paidAt}>
            <FieldLabel htmlFor="paidAt">Fecha y hora del pago</FieldLabel>
            <Input
              id="paidAt"
              type="datetime-local"
              className="h-11"
              {...form.register("paidAt")}
            />
            <FieldError errors={[errors.paidAt]} />
          </Field>
          <Field data-invalid={!!errors.notes}>
            <FieldLabel htmlFor="notes">
              Notas <span className="text-muted-foreground font-normal">(opcional)</span>
            </FieldLabel>
            <Input id="notes" className="h-11" {...form.register("notes")} />
            <FieldError errors={[errors.notes]} />
          </Field>
        </div>
      </FieldGroup>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="lg"
          className="h-11 sm:min-w-44"
          disabled={isSubmitting || !member}
        >
          {isSubmitting && <Spinner />}
          Registrar pago{amountCents > 0 ? ` · ${formatCOP(amountCents)}` : ""}
        </Button>
      </div>
    </form>
  );
}

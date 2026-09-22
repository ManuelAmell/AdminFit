"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AnimatedTabs from "@/components/smoothui/animated-tabs";
import { SubmitButton, useSubmitFlash } from "@/components/motion/submit-button";
import { MemberPicker, type PickedMember } from "@/components/forms/member-picker";
import { formatCOP, formatPesosLive, parsePesosInput } from "@/lib/money";
import { registerQuickSale } from "@/modules/payments/actions";
import {
  PAYMENT_CONCEPT_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  REFERENCE_REQUIRED_METHODS,
  SELLABLE_CONCEPTS,
  type PaymentMethod,
  type SellableConcept,
} from "@/modules/payments/constants";
import { quickSaleSchema, type QuickSaleInput } from "@/modules/payments/schema";

const CONCEPT_TABS = SELLABLE_CONCEPTS.map((id) => ({ id, label: PAYMENT_CONCEPT_LABELS[id] }));
const methodItems = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

export function QuickSaleForm({
  orgSlug,
  dayPassPriceFormatted,
}: {
  orgSlug: string;
  /** Precio del pase del día ya formateado ("15.000") o "" si no hay precio configurado. */
  dayPassPriceFormatted: string;
}) {
  const router = useRouter();
  const [member, setMember] = useState<PickedMember | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { success, flashSuccess } = useSubmitFlash();

  const form = useForm<QuickSaleInput>({
    resolver: zodResolver(quickSaleSchema),
    defaultValues: {
      concept: "day_pass",
      payerName: "",
      amount: dayPassPriceFormatted,
      method: "cash",
      reference: "",
      notes: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const concept = useWatch({ control: form.control, name: "concept" });
  const method = useWatch({ control: form.control, name: "method" }) as PaymentMethod;
  const amount = useWatch({ control: form.control, name: "amount" });
  const amountCents = parsePesosInput(amount ?? "") ?? 0;
  const referenceRequired = REFERENCE_REQUIRED_METHODS.includes(method as PaymentMethod);

  function handleConceptChange(next: string) {
    const nextConcept = next as SellableConcept;
    form.setValue("concept", nextConcept);
    // El precio del pase del día se precarga solo al entrar a esa pestaña, y solo si el
    // usuario no había escrito otro monto — para producto/otro se limpia porque no hay
    // un precio por defecto que tenga sentido.
    if (nextConcept === "day_pass" && !form.getValues("amount")) {
      form.setValue("amount", dayPassPriceFormatted);
    }
  }

  function handleMemberChange(m: PickedMember | null) {
    setMember(m);
    form.setValue("memberId", m?.id ?? null, { shouldValidate: true });
    if (m) form.setValue("payerName", "", { shouldValidate: true });
  }

  async function onSubmit(values: QuickSaleInput) {
    setServerError(null);
    const res = await registerQuickSale(orgSlug, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [key, message] of Object.entries(res.fieldErrors)) {
          form.setError(key as keyof QuickSaleInput, { message });
        }
      }
      setServerError(res.error);
      return;
    }
    toast.success(`Venta registrada. Recibo N.º ${res.data.receiptNumber}.`);
    await flashSuccess();
    router.push(`/app/${orgSlug}/payments/${res.data.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <AnimatedTabs
        activeTab={concept}
        onChange={handleConceptChange}
        variant="segment"
        tabs={CONCEPT_TABS}
      />

      <FieldGroup>
        <Field data-invalid={!!errors.payerName}>
          <FieldLabel htmlFor="member">Socio (opcional)</FieldLabel>
          <MemberPicker
            orgSlug={orgSlug}
            inputId="member"
            value={member}
            onChange={handleMemberChange}
          />
          {!member && (
            <>
              <FieldDescription>O ingresa el nombre de quien paga:</FieldDescription>
              <Input
                id="payerName"
                autoComplete="off"
                className="h-11"
                placeholder="Nombre de quien paga"
                aria-invalid={!!errors.payerName}
                {...form.register("payerName")}
              />
            </>
          )}
          <FieldError errors={[errors.payerName]} />
        </Field>

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
                  value={field.value}
                  onChange={(e) => field.onChange(formatPesosLive(e.target.value))}
                  onBlur={field.onBlur}
                />
              </div>
            )}
          />
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
              {!referenceRequired && (
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

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="notes">
            Notas <span className="text-muted-foreground font-normal">(opcional)</span>
          </FieldLabel>
          <Input id="notes" className="h-11" {...form.register("notes")} />
          <FieldError errors={[errors.notes]} />
        </Field>
      </FieldGroup>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <SubmitButton
          type="submit"
          size="lg"
          className="h-11 sm:min-w-44"
          disabled={isSubmitting}
          loading={isSubmitting}
          success={success}
          color="accent"
        >
          Registrar venta{amountCents > 0 ? ` · ${formatCOP(amountCents)}` : ""}
        </SubmitButton>
      </div>
    </form>
  );
}

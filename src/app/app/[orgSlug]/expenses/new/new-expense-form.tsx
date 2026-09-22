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
import { SubmitButton, useSubmitFlash } from "@/components/motion/submit-button";
import { formatCOP, formatPesosLive, parsePesosInput } from "@/lib/money";
import { createExpense } from "@/modules/expenses/actions";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/modules/expenses/constants";
import { createExpenseSchema, type CreateExpenseInput } from "@/modules/expenses/schema";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/modules/payments/constants";

type Branch = { id: string; name: string };

const methodItems = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

export function NewExpenseForm({
  orgSlug,
  branches,
  canRecordPayroll,
}: {
  orgSlug: string;
  branches: Branch[];
  canRecordPayroll: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { success, flashSuccess } = useSubmitFlash();

  const categoryItems = EXPENSE_CATEGORIES.filter((c) => c !== "payroll" || canRecordPayroll).map(
    (c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] }),
  );

  const form = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      category: "supplies",
      description: "",
      amount: "",
      method: "cash",
      notes: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const amount = useWatch({ control: form.control, name: "amount" });
  const amountCents = parsePesosInput(amount ?? "") ?? 0;

  async function onSubmit(values: CreateExpenseInput) {
    setServerError(null);
    const res = await createExpense(orgSlug, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [key, message] of Object.entries(res.fieldErrors)) {
          form.setError(key as keyof CreateExpenseInput, { message });
        }
      }
      setServerError(res.error);
      return;
    }
    toast.success("Gasto registrado.");
    await flashSuccess();
    router.push(`/app/${orgSlug}/expenses/${res.data.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Field data-invalid={!!errors.category}>
          <FieldLabel htmlFor="category">Categoría</FieldLabel>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select
                items={categoryItems}
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
              >
                <SelectTrigger id="category" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryItems.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">Descripción</FieldLabel>
          <Input
            id="description"
            autoComplete="off"
            className="h-11"
            placeholder="Ej: recibo de luz de septiembre"
            aria-invalid={!!errors.description}
            {...form.register("description")}
          />
          <FieldError errors={[errors.description]} />
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
          <Field data-invalid={!!errors.spentAt}>
            <FieldLabel htmlFor="spentAt">
              Fecha{" "}
              <span className="text-muted-foreground font-normal">(hoy si se deja vacío)</span>
            </FieldLabel>
            <Input
              id="spentAt"
              type="datetime-local"
              className="h-11"
              {...form.register("spentAt")}
            />
            <FieldError errors={[errors.spentAt]} />
          </Field>
        </div>

        {branches.length > 0 && (
          <Field>
            <FieldLabel htmlFor="branchId">Sede</FieldLabel>
            <Controller
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <Select
                  items={[
                    { value: "__none__", label: "Sin sede" },
                    ...branches.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <SelectTrigger id="branchId" className="h-11 w-full sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin sede</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="notes">
            Notas <span className="text-muted-foreground font-normal">(opcional)</span>
          </FieldLabel>
          <Input id="notes" className="h-11" {...form.register("notes")} />
          <FieldDescription>Ej: proveedor, número de factura.</FieldDescription>
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
        >
          Registrar gasto{amountCents > 0 ? ` · ${formatCOP(amountCents)}` : ""}
        </SubmitButton>
      </div>
    </form>
  );
}

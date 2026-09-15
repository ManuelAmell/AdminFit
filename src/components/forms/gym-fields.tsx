"use client";

import { useEffect } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { slugify, type GymStepInput } from "@/lib/validators/auth";

// Campos del gimnasio compartidos entre el registro (paso 2) y /onboarding.
export function GymFields({ form }: { form: UseFormReturn<GymStepInput> }) {
  const { errors } = form.formState;
  const gymName = useWatch({ control: form.control, name: "gymName" });
  const slugTouched = form.getFieldState("slug").isDirty;

  useEffect(() => {
    if (!slugTouched) form.setValue("slug", slugify(gymName ?? ""), { shouldValidate: false });
  }, [gymName, slugTouched, form]);

  return (
    <FieldGroup>
      <Field data-invalid={!!errors.gymName}>
        <FieldLabel htmlFor="gymName">Nombre del gimnasio</FieldLabel>
        <Input
          id="gymName"
          autoComplete="organization"
          className="h-11"
          aria-invalid={!!errors.gymName}
          {...form.register("gymName")}
        />
        <FieldError errors={[errors.gymName]} />
      </Field>
      <Field data-invalid={!!errors.slug}>
        <FieldLabel htmlFor="slug">Identificador (URL)</FieldLabel>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground shrink-0 text-sm">adminfit.app/</span>
          <Input
            id="slug"
            autoComplete="off"
            className="h-11 font-mono"
            aria-invalid={!!errors.slug}
            aria-describedby="slug-help"
            {...form.register("slug")}
          />
        </div>
        <FieldDescription id="slug-help">
          Se genera desde el nombre. Solo minúsculas, números y guiones.
        </FieldDescription>
        <FieldError errors={[errors.slug]} />
      </Field>
      <Field data-invalid={!!errors.city}>
        <FieldLabel htmlFor="city">Ciudad</FieldLabel>
        <Input
          id="city"
          autoComplete="address-level2"
          className="h-11"
          aria-invalid={!!errors.city}
          {...form.register("city")}
        />
        <FieldError errors={[errors.city]} />
      </Field>
    </FieldGroup>
  );
}

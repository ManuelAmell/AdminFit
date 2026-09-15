"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { GymFields } from "@/components/forms/gym-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { gymStepSchema, type GymStepInput } from "@/lib/validators/auth";

export function OnboardingForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<GymStepInput>({
    resolver: zodResolver(gymStepSchema),
    defaultValues: { gymName: "", slug: "", city: "" },
    mode: "onBlur",
  });

  async function onSubmit(values: GymStepInput) {
    setServerError(null);
    const res = await authClient.organization.create({
      name: values.gymName,
      slug: values.slug,
      city: values.city,
      timezone: "America/Bogota",
      currency: "COP",
    });
    if (res.error) {
      if (res.error.code === "ORGANIZATION_ALREADY_EXISTS") {
        form.setError("slug", { message: "Ese identificador ya está en uso. Elige otro." });
        form.setFocus("slug");
        return;
      }
      setServerError(res.error.message ?? "No pudimos crear el gimnasio. Intenta de nuevo.");
      return;
    }
    await authClient.organization.setActive({ organizationId: res.data.id });
    router.replace(`/app/${res.data.slug}/dashboard`);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <GymFields form={form} />
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting && <Spinner />}
        Crear gimnasio
      </Button>
    </form>
  );
}

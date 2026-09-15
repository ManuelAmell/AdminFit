"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { GymFields } from "@/components/forms/gym-fields";
import { PasswordInput } from "@/components/forms/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient, signUp } from "@/lib/auth/client";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import {
  accountStepSchema,
  gymStepSchema,
  type AccountStepInput,
  type GymStepInput,
} from "@/lib/validators/auth";

const STEPS = ["Tu cuenta", "Tu gimnasio"] as const;

export function RegisterWizard({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  // Si viene de una invitación, no debe crear un gimnasio: solo la cuenta.
  const inviteMode = !!nextPath && nextPath.startsWith("/invite/");
  const [step, setStep] = useState<0 | 1>(0);
  const [account, setAccount] = useState<AccountStepInput | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const accountForm = useForm<AccountStepInput>({
    resolver: zodResolver(accountStepSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onBlur",
  });
  const gymForm = useForm<GymStepInput>({
    resolver: zodResolver(gymStepSchema),
    defaultValues: { gymName: "", slug: "", city: "" },
    mode: "onBlur",
  });

  async function onAccountSubmit(values: AccountStepInput) {
    setServerError(null);
    if (!inviteMode) {
      setAccount(values);
      setStep(1);
      return;
    }
    const res = await signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    if (res.error) {
      setServerError(
        res.error.code === "USER_ALREADY_EXISTS"
          ? "Ya existe una cuenta con ese correo. Inicia sesión para aceptar la invitación."
          : (res.error.message ?? "No pudimos crear tu cuenta. Intenta de nuevo."),
      );
      return;
    }
    router.replace(sanitizeNextPath(nextPath));
    router.refresh();
  }

  async function onGymSubmit(values: GymStepInput) {
    if (!account) return setStep(0);
    setServerError(null);

    const signUpRes = await signUp.email({
      name: account.name,
      email: account.email,
      password: account.password,
    });
    if (signUpRes.error) {
      const isDuplicate = signUpRes.error.code === "USER_ALREADY_EXISTS";
      setServerError(
        isDuplicate
          ? "Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo."
          : (signUpRes.error.message ?? "No pudimos crear tu cuenta. Intenta de nuevo."),
      );
      if (isDuplicate) setStep(0);
      return;
    }

    const orgRes = await authClient.organization.create({
      name: values.gymName,
      slug: values.slug,
      city: values.city,
      timezone: "America/Bogota",
      currency: "COP",
    });
    if (orgRes.error) {
      const slugTaken = orgRes.error.code === "ORGANIZATION_ALREADY_EXISTS";
      if (slugTaken) {
        gymForm.setError("slug", { message: "Ese identificador ya está en uso. Elige otro." });
        gymForm.setFocus("slug");
        return;
      }
      setServerError(
        orgRes.error.message ?? "Tu cuenta se creó, pero no pudimos crear el gimnasio.",
      );
      return;
    }

    await authClient.organization.setActive({ organizationId: orgRes.data.id });
    router.replace(`/app/${orgRes.data.slug}/dashboard`);
    router.refresh();
  }

  const accountErrors = accountForm.formState.errors;
  const submitting = accountForm.formState.isSubmitting || gymForm.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        {!inviteMode && (
          <ol
            className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium"
            aria-label="Progreso"
          >
            {STEPS.map((label, i) => (
              <li
                key={label}
                className="flex items-center gap-2"
                aria-current={i === step ? "step" : undefined}
              >
                <span
                  className={
                    i <= step
                      ? "bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full"
                      : "bg-muted flex size-5 items-center justify-center rounded-full"
                  }
                >
                  {i + 1}
                </span>
                <span className={i === step ? "text-foreground" : undefined}>{label}</span>
                {i < STEPS.length - 1 && <span className="bg-border h-px w-6" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        )}
        <CardTitle role="heading" aria-level={1} className="text-xl">
          {step === 0 ? "Crea tu cuenta" : "Registra tu gimnasio"}
        </CardTitle>
        <CardDescription>
          {inviteMode
            ? "Crea tu cuenta con el correo al que te invitaron para unirte al gimnasio."
            : step === 0
              ? "Serás el propietario del gimnasio y podrás invitar a tu equipo."
              : "Estos datos se pueden cambiar después en Configuración."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {step === 0 ? (
          <form
            onSubmit={accountForm.handleSubmit(onAccountSubmit)}
            noValidate
            className="flex flex-col gap-6"
          >
            <FieldGroup>
              <Field data-invalid={!!accountErrors.name}>
                <FieldLabel htmlFor="name">Tu nombre</FieldLabel>
                <Input
                  id="name"
                  autoComplete="name"
                  className="h-11"
                  aria-invalid={!!accountErrors.name}
                  {...accountForm.register("name")}
                />
                <FieldError errors={[accountErrors.name]} />
              </Field>
              <Field data-invalid={!!accountErrors.email}>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className="h-11"
                  aria-invalid={!!accountErrors.email}
                  {...accountForm.register("email")}
                />
                <FieldError errors={[accountErrors.email]} />
              </Field>
              <Field data-invalid={!!accountErrors.password}>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  className="h-11"
                  aria-invalid={!!accountErrors.password}
                  aria-describedby="password-help"
                  {...accountForm.register("password")}
                />
                <FieldDescription id="password-help">Mínimo 8 caracteres.</FieldDescription>
                <FieldError errors={[accountErrors.password]} />
              </Field>
            </FieldGroup>
            <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
              {submitting && <Spinner />}
              {inviteMode ? "Crear cuenta" : "Continuar"}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={gymForm.handleSubmit(onGymSubmit)}
            noValidate
            className="flex flex-col gap-6"
          >
            <GymFields form={gymForm} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 sm:flex-1"
                onClick={() => setStep(0)}
                disabled={submitting}
              >
                <ArrowLeft data-icon="inline-start" />
                Atrás
              </Button>
              <Button type="submit" size="lg" className="h-11 sm:flex-1" disabled={submitting}>
                {submitting && <Spinner />}
                Crear gimnasio
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

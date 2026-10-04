"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { Trainer } from "@/db/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createTrainer, updateTrainer } from "@/modules/classes/actions";
import { trainerInputSchema, type TrainerInput } from "@/modules/classes/schema";

function toInput(trainer?: Trainer): TrainerInput {
  return {
    firstName: trainer?.firstName ?? "",
    lastName: trainer?.lastName ?? "",
    specialty: trainer?.specialty ?? "",
    phone: trainer?.phone ?? "",
    email: trainer?.email ?? "",
    photoUrl: trainer?.photoUrl ?? "",
    bio: trainer?.bio ?? "",
    isActive: trainer?.isActive ?? true,
  };
}

export function TrainerDialog({
  orgSlug,
  trainer,
  trigger,
}: {
  orgSlug: string;
  trainer?: Trainer;
  trigger?: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!trainer;

  const form = useForm<TrainerInput>({
    resolver: zodResolver(trainerInputSchema),
    defaultValues: toInput(trainer),
    mode: "onBlur",
  });
  const { errors, isSubmitting } = form.formState;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      form.reset(toInput(trainer));
      setServerError(null);
    }
  }

  async function onSubmit(values: TrainerInput) {
    setServerError(null);
    const res = isEdit
      ? await updateTrainer(orgSlug, trainer.id, values)
      : await createTrainer(orgSlug, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [k, msg] of Object.entries(res.fieldErrors)) {
          form.setError(k as keyof TrainerInput, { message: msg });
        }
      } else {
        setServerError(res.error);
      }
      return;
    }
    toast.success(isEdit ? "Entrenador actualizado." : "Entrenador creado con éxito.");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      {trigger ? (
        trigger(() => handleOpenChange(true))
      ) : (
        <Button size="sm" onClick={() => handleOpenChange(true)}>
          <Plus className="size-4" />
          Nuevo entrenador
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar entrenador" : "Nuevo entrenador"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Actualiza la información profesional y datos de contacto."
                : "Agrega un instructor o coach a la plantilla del gimnasio."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={!!errors.firstName}>
                  <FieldLabel htmlFor="trainer-first-name">Nombre</FieldLabel>
                  <Input
                    id="trainer-first-name"
                    placeholder="ej. Daniel"
                    autoFocus
                    aria-invalid={!!errors.firstName}
                    {...form.register("firstName")}
                  />
                  <FieldError errors={[errors.firstName]} />
                </Field>

                <Field data-invalid={!!errors.lastName}>
                  <FieldLabel htmlFor="trainer-last-name">Apellido</FieldLabel>
                  <Input
                    id="trainer-last-name"
                    placeholder="ej. Ospina"
                    aria-invalid={!!errors.lastName}
                    {...form.register("lastName")}
                  />
                  <FieldError errors={[errors.lastName]} />
                </Field>
              </div>

              <Field data-invalid={!!errors.specialty}>
                <FieldLabel htmlFor="trainer-specialty">Especialidad (opcional)</FieldLabel>
                <Input
                  id="trainer-specialty"
                  placeholder="ej. Spinning, CrossFit, Yoga, Hiit"
                  aria-invalid={!!errors.specialty}
                  {...form.register("specialty")}
                />
                <FieldError errors={[errors.specialty]} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={!!errors.phone}>
                  <FieldLabel htmlFor="trainer-phone">Teléfono (opcional)</FieldLabel>
                  <Input
                    id="trainer-phone"
                    type="tel"
                    placeholder="ej. 310 123 4567"
                    aria-invalid={!!errors.phone}
                    {...form.register("phone")}
                  />
                  <FieldError errors={[errors.phone]} />
                </Field>

                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="trainer-email">Correo (opcional)</FieldLabel>
                  <Input
                    id="trainer-email"
                    type="email"
                    placeholder="ej. coach@adminfit.co"
                    aria-invalid={!!errors.email}
                    {...form.register("email")}
                  />
                  <FieldError errors={[errors.email]} />
                </Field>
              </div>

              <Field data-invalid={!!errors.bio}>
                <FieldLabel htmlFor="trainer-bio">Biografía / Perfil (opcional)</FieldLabel>
                <Input
                  id="trainer-bio"
                  placeholder="ej. Certificado en acondicionamiento físico funcional..."
                  aria-invalid={!!errors.bio}
                  {...form.register("bio")}
                />
                <FieldError errors={[errors.bio]} />
              </Field>

              <Field data-invalid={!!errors.photoUrl}>
                <FieldLabel htmlFor="trainer-photo">URL de Foto (opcional)</FieldLabel>
                <Input
                  id="trainer-photo"
                  placeholder="https://..."
                  aria-invalid={!!errors.photoUrl}
                  {...form.register("photoUrl")}
                />
                <FieldError errors={[errors.photoUrl]} />
              </Field>
            </FieldGroup>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || pending}>
                {(isSubmitting || pending) && <Spinner />}
                {isEdit ? "Guardar cambios" : "Crear entrenador"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

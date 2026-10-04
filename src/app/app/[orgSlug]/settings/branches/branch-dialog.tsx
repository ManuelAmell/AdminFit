"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { Branch } from "@/db/schema";
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
import { createBranch, updateBranch } from "@/modules/branches/actions";
import { branchInputSchema, type BranchInput } from "@/modules/branches/schema";

function toInput(branch?: Branch): BranchInput {
  return {
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
  };
}

export function BranchDialog({
  orgSlug,
  branch,
  trigger,
}: {
  orgSlug: string;
  branch?: Branch;
  trigger?: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!branch;

  const form = useForm<BranchInput>({
    resolver: zodResolver(branchInputSchema),
    defaultValues: toInput(branch),
    mode: "onBlur",
  });
  const { errors, isSubmitting } = form.formState;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      form.reset(toInput(branch));
      setServerError(null);
    }
  }

  async function onSubmit(values: BranchInput) {
    setServerError(null);
    const res = isEdit
      ? await updateBranch(orgSlug, branch.id, values)
      : await createBranch(orgSlug, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [k, msg] of Object.entries(res.fieldErrors)) {
          form.setError(k as keyof BranchInput, { message: msg });
        }
      } else {
        setServerError(res.error);
      }
      return;
    }
    toast.success(isEdit ? "Sede actualizada." : "Sede creada.");
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
          Nueva sede
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar sede" : "Nueva sede"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Actualiza los datos de contacto y ubicación de la sede."
                : "Agrega una nueva ubicación física para tu gimnasio."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="branch-name">Nombre de la sede</FieldLabel>
                <Input
                  id="branch-name"
                  placeholder="ej. Sede Poblado, Principal, Norte"
                  autoFocus
                  aria-invalid={!!errors.name}
                  {...form.register("name")}
                />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field data-invalid={!!errors.address}>
                <FieldLabel htmlFor="branch-address">Dirección (opcional)</FieldLabel>
                <Input
                  id="branch-address"
                  placeholder="ej. Calle 10 # 43E-20"
                  aria-invalid={!!errors.address}
                  {...form.register("address")}
                />
                <FieldError errors={[errors.address]} />
              </Field>

              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="branch-phone">Teléfono (opcional)</FieldLabel>
                <Input
                  id="branch-phone"
                  type="tel"
                  placeholder="ej. 300 123 4567"
                  aria-invalid={!!errors.phone}
                  {...form.register("phone")}
                />
                <FieldError errors={[errors.phone]} />
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
                {isEdit ? "Guardar cambios" : "Crear sede"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

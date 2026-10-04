"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DOCUMENT_TYPE_LABELS, GENDER_LABELS } from "@/lib/members/labels";
import { createMember, updateMember } from "@/modules/members/actions";
import {
  DOCUMENT_TYPES,
  GENDERS,
  memberInputSchema,
  type MemberInput,
} from "@/modules/members/schema";

type Branch = { id: string; name: string };

const DOC_ITEMS = DOCUMENT_TYPES.map((v) => ({
  value: v,
  label: `${v} — ${DOCUMENT_TYPE_LABELS[v]}`,
}));
const GENDER_ITEMS = GENDERS.map((v) => ({ value: v, label: GENDER_LABELS[v] }));
const NO_BRANCH = "__none__";

export function MemberForm({
  orgSlug,
  memberId,
  defaultValues,
  branches,
}: {
  orgSlug: string;
  memberId?: string;
  defaultValues?: Partial<MemberInput>;
  branches: Branch[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<MemberInput>({
    resolver: zodResolver(memberInputSchema),
    defaultValues: {
      documentType: "CC",
      documentNumber: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      birthDate: "",
      gender: "unspecified",
      emergencyContactName: "",
      emergencyContactPhone: "",
      notes: "",
      branchId: null,
      photoUrl: null,
      ...defaultValues,
    },
    mode: "onBlur",
  });
  const { errors, isSubmitting } = form.formState;
  const base = `/app/${orgSlug}/members`;

  const currentPhoto = useWatch({ control: form.control, name: "photoUrl" });
  const firstName = useWatch({ control: form.control, name: "firstName" });
  const lastName = useWatch({ control: form.control, name: "lastName" });
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "SO";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen válido.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, startX, startY, size, size, 0, 0, 256, 256);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          form.setValue("photoUrl", dataUrl, { shouldDirty: true });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function onSubmit(values: MemberInput) {
    setServerError(null);
    const res = memberId
      ? await updateMember(orgSlug, memberId, values)
      : await createMember(orgSlug, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [k, msg] of Object.entries(res.fieldErrors)) {
          form.setError(k as keyof MemberInput, { message: msg });
        }
        const first = Object.keys(res.fieldErrors)[0] as keyof MemberInput | undefined;
        if (first) form.setFocus(first);
      } else {
        setServerError(res.error);
      }
      return;
    }
    toast.success(memberId ? "Socio actualizado." : "Socio registrado.");
    const id = memberId ?? (res.ok && "data" in res && res.data ? res.data.id : undefined);
    router.push(id ? `${base}/${id}` : base);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Identificación
          </CardTitle>
          <CardDescription>
            El documento identifica al socio dentro de este gimnasio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {/* Foto del socio */}
            <div className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center">
              <Avatar className="size-20 shrink-0 border text-xl">
                <AvatarImage src={currentPhoto ?? undefined} alt="Foto del socio" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="size-4" />
                    {currentPhoto ? "Cambiar foto" : "Subir foto"}
                  </Button>
                  {currentPhoto && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => form.setValue("photoUrl", null, { shouldDirty: true })}
                    >
                      <Trash2 className="size-4" />
                      Quitar
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  Foto frontal en JPG, PNG o WebP. Se ajustará automáticamente a formato cuadrado.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_1fr]">
              <Field data-invalid={!!errors.documentType}>
                <FieldLabel htmlFor="documentType">Tipo de documento</FieldLabel>
                <Controller
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <Select
                      items={DOC_ITEMS}
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                    >
                      <SelectTrigger id="documentType" className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_ITEMS.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.documentType]} />
              </Field>
              <Field data-invalid={!!errors.documentNumber}>
                <FieldLabel htmlFor="documentNumber">Número de documento</FieldLabel>
                <Input
                  id="documentNumber"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-10 tabular-nums"
                  aria-invalid={!!errors.documentNumber}
                  {...form.register("documentNumber")}
                />
                <FieldError errors={[errors.documentNumber]} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.firstName}>
                <FieldLabel htmlFor="firstName">Nombres</FieldLabel>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  className="h-10"
                  aria-invalid={!!errors.firstName}
                  {...form.register("firstName")}
                />
                <FieldError errors={[errors.firstName]} />
              </Field>
              <Field data-invalid={!!errors.lastName}>
                <FieldLabel htmlFor="lastName">Apellidos</FieldLabel>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  className="h-10"
                  aria-invalid={!!errors.lastName}
                  {...form.register("lastName")}
                />
                <FieldError errors={[errors.lastName]} />
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Contacto y datos personales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="h-10"
                  aria-invalid={!!errors.phone}
                  {...form.register("phone")}
                />
                <FieldError errors={[errors.phone]} />
              </Field>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="h-10"
                  aria-invalid={!!errors.email}
                  {...form.register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.birthDate}>
                <FieldLabel htmlFor="birthDate">Fecha de nacimiento</FieldLabel>
                <Input
                  id="birthDate"
                  type="date"
                  autoComplete="bday"
                  className="h-10"
                  aria-invalid={!!errors.birthDate}
                  {...form.register("birthDate")}
                />
                <FieldError errors={[errors.birthDate]} />
              </Field>
              <Field data-invalid={!!errors.gender}>
                <FieldLabel htmlFor="gender">Género</FieldLabel>
                <Controller
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <Select
                      items={GENDER_ITEMS}
                      value={field.value ?? "unspecified"}
                      onValueChange={(v) => v && field.onChange(v)}
                    >
                      <SelectTrigger id="gender" className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_ITEMS.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.gender]} />
              </Field>
            </div>
            {branches.length > 0 && (
              <Field data-invalid={!!errors.branchId}>
                <FieldLabel htmlFor="branchId">Sede</FieldLabel>
                <Controller
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <Select
                      items={[
                        { value: NO_BRANCH, label: "Sin sede" },
                        ...branches.map((b) => ({ value: b.id, label: b.name })),
                      ]}
                      value={field.value ?? NO_BRANCH}
                      onValueChange={(v) => field.onChange(v === NO_BRANCH ? null : v)}
                    >
                      <SelectTrigger id="branchId" className="h-10 w-full sm:max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_BRANCH}>Sin sede</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.branchId]} />
              </Field>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Contacto de emergencia y notas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.emergencyContactName}>
                <FieldLabel htmlFor="emergencyContactName">Nombre del contacto</FieldLabel>
                <Input
                  id="emergencyContactName"
                  autoComplete="off"
                  className="h-10"
                  aria-invalid={!!errors.emergencyContactName}
                  {...form.register("emergencyContactName")}
                />
                <FieldError errors={[errors.emergencyContactName]} />
              </Field>
              <Field data-invalid={!!errors.emergencyContactPhone}>
                <FieldLabel htmlFor="emergencyContactPhone">Teléfono del contacto</FieldLabel>
                <Input
                  id="emergencyContactPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  className="h-10"
                  aria-invalid={!!errors.emergencyContactPhone}
                  {...form.register("emergencyContactPhone")}
                />
                <FieldError errors={[errors.emergencyContactPhone]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.notes}>
              <FieldLabel htmlFor="notes">Notas internas</FieldLabel>
              <textarea
                id="notes"
                rows={3}
                aria-invalid={!!errors.notes}
                aria-describedby="notes-help"
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 min-h-20 w-full rounded-lg border bg-transparent px-2.5 py-2 text-base outline-none focus-visible:ring-3 md:text-sm"
                {...form.register("notes")}
              />
              <FieldDescription id="notes-help">
                Solo las ve el equipo del gimnasio (lesiones, restricciones, preferencias).
              </FieldDescription>
              <FieldError errors={[errors.notes]} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          nativeButton={false}
          render={<Link href={memberId ? `${base}/${memberId}` : base} />}
        >
          Cancelar
        </Button>
        <Button type="submit" className="h-10" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {memberId ? "Guardar cambios" : "Registrar socio"}
        </Button>
      </div>
    </form>
  );
}

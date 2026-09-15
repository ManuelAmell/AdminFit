"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, MailPlus, Trash2, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { RoleSelect } from "@/components/forms/role-select";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth/client";
import type { OrgRole } from "@/lib/auth/permissions";
import { emailSchema } from "@/lib/validators/auth";

type Member = { id: string; userId: string; name: string; email: string; role: string };
type Invitation = { id: string; email: string; role: string; expiresAt: string; link: string };

const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["admin", "staff"]),
});
type InviteInput = z.infer<typeof inviteSchema>;

export function TeamView({
  orgId,
  currentUserId,
  currentRole,
  canManage,
  members,
  invitations,
}: {
  orgId: string;
  currentUserId: string;
  currentRole: OrgRole;
  canManage: boolean;
  members: Member[];
  invitations: Invitation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "staff" },
    mode: "onBlur",
  });
  const { errors, isSubmitting } = form.formState;
  const inviteRole = useWatch({ control: form.control, name: "role" });

  async function onInvite(values: InviteInput) {
    const { data, error } = await authClient.organization.inviteMember({
      organizationId: orgId,
      email: values.email,
      role: values.role,
    });
    if (error) {
      toast.error(
        error.code === "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION"
          ? "Esa persona ya es parte del equipo."
          : (error.message ?? "No pudimos crear la invitación."),
      );
      return;
    }
    form.reset();
    toast.success(`Invitación creada para ${data.email}. Copia el enlace y envíaselo.`);
    startTransition(() => router.refresh());
  }

  async function changeRole(m: Member, role: OrgRole) {
    const { error } = await authClient.organization.updateMemberRole({
      organizationId: orgId,
      memberId: m.id,
      role,
    });
    if (error) return toast.error(error.message ?? "No pudimos cambiar el rol.");
    toast.success(`${m.name} ahora es ${ROLE_LABELS[role].toLowerCase()}.`);
    startTransition(() => router.refresh());
  }

  async function removeMember() {
    if (!removeTarget) return;
    const { error } = await authClient.organization.removeMember({
      organizationId: orgId,
      memberIdOrEmail: removeTarget.id,
    });
    setRemoveTarget(null);
    if (error) return toast.error(error.message ?? "No pudimos quitar a esta persona.");
    toast.success(`${removeTarget.name} ya no tiene acceso.`);
    startTransition(() => router.refresh());
  }

  async function cancelInvitation(inv: Invitation) {
    const { error } = await authClient.organization.cancelInvitation({ invitationId: inv.id });
    if (error) return toast.error(error.message ?? "No pudimos cancelar la invitación.");
    toast.success("Invitación cancelada.");
    startTransition(() => router.refresh());
  }

  async function copyLink(inv: Invitation) {
    try {
      await navigator.clipboard.writeText(inv.link);
      toast.success("Enlace copiado.");
    } catch {
      toast.error("No pudimos copiar. Selecciona el enlace manualmente.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Miembros
            </CardTitle>
            <CardDescription>
              {members.length} {members.length === 1 ? "persona" : "personas"} con acceso.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Persona</TableHead>
                    <TableHead>Rol</TableHead>
                    {canManage && (
                      <TableHead className="pr-6 text-right">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const isSelf = m.userId === currentUserId;
                    const isOwner = m.role === "owner";
                    const editable = canManage && !isSelf && !(isOwner && currentRole !== "owner");
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {m.name}
                              {isSelf && (
                                <span className="text-muted-foreground font-normal"> (tú)</span>
                              )}
                            </span>
                            <span className="text-muted-foreground text-xs">{m.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {editable && !isOwner ? (
                            <RoleSelect
                              value={m.role as OrgRole}
                              onValueChange={(r) => changeRole(m, r)}
                              disabled={pending}
                              className="w-40"
                            />
                          ) : (
                            <Badge variant={isOwner ? "default" : "secondary"}>
                              {ROLE_LABELS[m.role as OrgRole] ?? m.role}
                            </Badge>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="pr-6 text-right">
                            {editable && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive size-9"
                                onClick={() => setRemoveTarget(m)}
                                aria-label={`Quitar a ${m.name}`}
                              >
                                <UserMinus />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                Invitaciones pendientes
              </CardTitle>
              <CardDescription>
                Aún no enviamos correos: copia el enlace y compártelo. Vence en 7 días.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {invitations.length === 0 ? (
                <p className="text-muted-foreground px-6 text-sm">
                  No hay invitaciones pendientes.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Correo</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead className="pr-6 text-right">
                          <span className="sr-only">Acciones</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((inv) => (
                        <TableRow key={inv.id} data-invitation-id={inv.id}>
                          <TableCell className="pl-6 font-medium">{inv.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {ROLE_LABELS[inv.role as OrgRole] ?? inv.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
                              new Date(inv.expiresAt),
                            )}
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                onClick={() => copyLink(inv)}
                                aria-label={`Copiar enlace de invitación para ${inv.email}`}
                              >
                                <Copy />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive size-9"
                                onClick={() => cancelInvitation(inv)}
                                aria-label={`Cancelar invitación de ${inv.email}`}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {canManage && (
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Invitar a alguien
            </CardTitle>
            <CardDescription>Se creará un enlace de invitación para ese correo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onInvite)} noValidate className="flex flex-col gap-5">
              <FieldGroup>
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="invite-email">Correo electrónico</FieldLabel>
                  <Input
                    id="invite-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    className="h-10"
                    aria-invalid={!!errors.email}
                    {...form.register("email")}
                  />
                  <FieldError errors={[errors.email]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-role">Rol</FieldLabel>
                  <RoleSelect
                    id="invite-role"
                    value={inviteRole}
                    onValueChange={(r) => form.setValue("role", r as "admin" | "staff")}
                    className="h-10 w-full"
                  />
                  <FieldDescription>{ROLE_DESCRIPTIONS[inviteRole]}</FieldDescription>
                </Field>
              </FieldGroup>
              <Button type="submit" className="h-10" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : <MailPlus data-icon="inline-start" />}
                Crear invitación
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar a {removeTarget?.name}</DialogTitle>
            <DialogDescription>
              Perderá el acceso a este gimnasio de inmediato. Podrás invitarle de nuevo más tarde.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={removeMember}>
              Quitar acceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

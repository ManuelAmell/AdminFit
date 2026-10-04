"use client";

import { Edit2, Phone, Mail, Trash2, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { Trainer } from "@/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteTrainer } from "@/modules/classes/actions";
import { TrainerDialog } from "./trainer-dialog";

export function TrainersTable({
  orgSlug,
  trainers,
  canManage,
}: {
  orgSlug: string;
  trainers: Trainer[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleDelete(trainer: Trainer) {
    if (
      !confirm(
        `¿Estás seguro de eliminar al entrenador "${trainer.firstName} ${trainer.lastName}"?`,
      )
    ) {
      return;
    }
    const res = await deleteTrainer(orgSlug, trainer.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Entrenador eliminado.");
    startTransition(() => router.refresh());
  }

  if (trainers.length === 0) {
    return (
      <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <UserCheck className="text-muted-foreground mb-3 size-10" />
        <h3 className="text-foreground text-base font-medium">No hay entrenadores registrados</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Registra instructores y entrenadores para asignarlos a las clases y horarios del gimnasio.
        </p>
        {canManage && (
          <div className="mt-4">
            <TrainerDialog orgSlug={orgSlug} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entrenador</TableHead>
            <TableHead>Especialidad</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Estado</TableHead>
            {canManage && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trainers.map((t) => {
            const initials = `${t.firstName.charAt(0)}${t.lastName.charAt(0)}`.toUpperCase();
            return (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      {t.photoUrl && (
                        <AvatarImage src={t.photoUrl} alt={`${t.firstName} ${t.lastName}`} />
                      )}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-foreground font-medium">
                        {t.firstName} {t.lastName}
                      </div>
                      {t.bio && (
                        <div className="text-muted-foreground line-clamp-1 max-w-xs text-xs">
                          {t.bio}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {t.specialty ? (
                    <span className="text-foreground text-sm">{t.specialty}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                    {t.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="text-muted-foreground size-3" />
                        <span>{t.phone}</span>
                      </div>
                    )}
                    {t.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="text-muted-foreground size-3" />
                        <span>{t.email}</span>
                      </div>
                    )}
                    {!t.phone && !t.email && <span>—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {t.isActive ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    >
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrainerDialog
                        orgSlug={orgSlug}
                        trainer={t}
                        trigger={(open) => (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={open}
                            title="Editar entrenador"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                        )}
                      />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={pending}
                        onClick={() => handleDelete(t)}
                        title="Eliminar entrenador"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

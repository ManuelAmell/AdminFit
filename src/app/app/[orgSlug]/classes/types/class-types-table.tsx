"use client";

import { Edit2, Layers, Trash2, Users, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ClassType } from "@/db/schema";
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
import { deleteClassType } from "@/modules/classes/actions";
import { ClassTypeDialog } from "./class-type-dialog";

export function ClassTypesTable({
  orgSlug,
  classTypes,
  canManage,
}: {
  orgSlug: string;
  classTypes: ClassType[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleDelete(type: ClassType) {
    if (!confirm(`¿Estás seguro de eliminar la modalidad "${type.name}"?`)) {
      return;
    }
    const res = await deleteClassType(orgSlug, type.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Modalidad de clase eliminada.");
    startTransition(() => router.refresh());
  }

  if (classTypes.length === 0) {
    return (
      <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <Layers className="text-muted-foreground mb-3 size-10" />
        <h3 className="text-foreground text-base font-medium">No hay modalidades de clase</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Define las actividades y disciplinas de tu gimnasio (Spinning, Yoga, Pilates,
          Funcional...) para programar horarios.
        </p>
        {canManage && (
          <div className="mt-4">
            <ClassTypeDialog orgSlug={orgSlug} />
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
            <TableHead>Modalidad</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Aforo sugerido</TableHead>
            <TableHead>Estado</TableHead>
            {canManage && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {classTypes.map((type) => (
            <TableRow key={type.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className="size-4 shrink-0 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: type.color }}
                  />
                  <div>
                    <div className="text-foreground font-medium">{type.name}</div>
                    {type.description && (
                      <div className="text-muted-foreground line-clamp-1 max-w-sm text-xs">
                        {type.description}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-foreground flex items-center gap-1.5 text-sm">
                  <Clock className="text-muted-foreground size-3.5" />
                  <span>{type.durationMinutes} min</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-foreground flex items-center gap-1.5 text-sm">
                  <Users className="text-muted-foreground size-3.5" />
                  <span>{type.defaultCapacity} cupos</span>
                </div>
              </TableCell>
              <TableCell>
                {type.isActive ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    Activa
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Inactiva
                  </Badge>
                )}
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <ClassTypeDialog
                      orgSlug={orgSlug}
                      classType={type}
                      trigger={(open) => (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={open}
                          title="Editar modalidad"
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
                      onClick={() => handleDelete(type)}
                      title="Eliminar modalidad"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, Clock, MapPin, User, Users, UserX, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth/session";
import { getSessionWithDetails } from "@/modules/classes/queries";
import { AttendanceTable } from "./attendance-table";
import { BookingDialog } from "./booking-dialog";

export const metadata: Metadata = { title: "Detalle de Clase y Reservas — AdminFit" };

export default async function ClassSessionDetailPage({
  params,
}: PageProps<"/app/[orgSlug]/classes/[id]">) {
  const { orgSlug, id } = await params;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);

  const session = await getSessionWithDetails(org.id, id);
  if (!session) {
    notFound();
  }

  const canManage = isSuperadmin || role === "owner" || role === "admin" || role === "staff";
  const isFull = session.bookedCount >= session.capacity;
  const isCancelled = session.status === "cancelled";

  const attendedCount = session.bookings.filter((b) => b.status === "attended").length;
  const confirmedCount = session.bookings.filter((b) => b.status === "confirmed").length;
  const noShowCount = session.bookings.filter((b) => b.status === "no_show").length;
  const cancelledBookingsCount = session.bookings.filter((b) => b.status === "cancelled").length;

  const dateObj = new Date(`${session.date}T12:00:00Z`);
  const formattedDate = dateObj.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        title={session.classType.name}
        description={`${formattedDate} • ${session.startTime} – ${session.endTime}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={
                <Link href={`/app/${orgSlug}/classes`}>
                  <ArrowLeft className="size-4" />
                  <span>Volver a la agenda</span>
                </Link>
              }
            />
            {canManage && !isCancelled && (
              <BookingDialog orgSlug={org.slug} sessionId={session.id} isFull={isFull} />
            )}
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Banner de cancelación si aplica */}
        {isCancelled && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-3 rounded-lg border p-4">
            <XCircle className="size-5 shrink-0" />
            <div>
              <div className="text-sm font-semibold">Esta clase ha sido cancelada</div>
              <div className="text-xs opacity-90">
                Motivo: {session.cancelReason || "Cancelada por administración."}
              </div>
            </div>
          </div>
        )}

        {/* Tarjetas de métricas de la sesión */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-muted-foreground text-xs font-medium">Aforo & Reservas</div>
                <div className="text-foreground mt-1 text-2xl font-bold">
                  {session.bookedCount} / {session.capacity}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {session.capacity - session.bookedCount} cupos disponibles
                </div>
              </div>
              <div
                className="flex size-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${session.classType.color}20`,
                  color: session.classType.color,
                }}
              >
                <Users className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-muted-foreground text-xs font-medium">Asistieron</div>
                <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {attendedCount}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">Confirmaron ingreso</div>
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-muted-foreground text-xs font-medium">Pendientes</div>
                <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {confirmedCount}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  Reservas activas por verificar
                </div>
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-muted-foreground text-xs font-medium">Inasistencias</div>
                <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {noShowCount}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {cancelledBookingsCount} reservas canceladas
                </div>
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <UserX className="size-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ficha técnica del instructor y sede */}
        <div className="bg-muted/30 border-border/80 text-muted-foreground flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 text-xs">
          <div className="flex items-center gap-2">
            <User className="text-foreground size-4" />
            <span className="text-foreground font-medium">Entrenador:</span>
            <span>
              {session.trainer
                ? `${session.trainer.firstName} ${session.trainer.lastName} ${session.trainer.specialty ? `(${session.trainer.specialty})` : ""}`
                : "Sin entrenador asignado"}
            </span>
          </div>

          {session.branchName && (
            <div className="flex items-center gap-2">
              <MapPin className="text-foreground size-4" />
              <span className="text-foreground font-medium">Sede:</span>
              <span>{session.branchName}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-foreground font-medium">Duración:</span>
            <span>{session.classType.durationMinutes} minutos</span>
          </div>
        </div>

        {/* Tabla de inscritos y asistencia */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground text-base font-semibold">
              Lista de Reservas y Asistencia ({session.bookings.length})
            </h3>
          </div>

          <AttendanceTable
            orgSlug={org.slug}
            session={session}
            canManage={canManage && !isCancelled}
          />
        </div>
      </div>
    </>
  );
}

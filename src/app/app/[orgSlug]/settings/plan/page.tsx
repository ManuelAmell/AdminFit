import type { Metadata } from "next";
import { AlertCircle, Building2, CheckCircle2, Clock, CreditCard, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/authorize";
import { formatDate, todayISO } from "@/lib/dates";
import { formatCOP } from "@/lib/money";
import { getCurrentSubscription, getPlatformSettings } from "@/modules/platform/queries";
import { BANK_ACCOUNT_TYPE_LABELS } from "@/modules/platform/schema";
import { SettingsTabs } from "../settings-tabs";

export const metadata: Metadata = { title: "Mi Plan — AdminFit" };

export default async function OwnerPlanPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { org, role, isSuperadmin } = await requirePermission(orgSlug, { settings: ["read"] });

  if (role !== "owner" && !isSuperadmin) {
    notFound();
  }

  const [currentSub, bankSettings] = await Promise.all([
    getCurrentSubscription(org.id),
    getPlatformSettings(),
  ]);

  const today = todayISO();
  const isExpired = currentSub ? currentSub.endDate < today : false;

  return (
    <>
      <PageHeader title="Configuración" description="Membresía y facturación de tu gimnasio" />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <SettingsTabs orgSlug={org.slug} isOwner={true} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Card: Plan actual */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
                  <ShieldCheck className="text-primary size-5" />
                  Tu plan en AdminFit
                </CardTitle>
                {currentSub && (
                  <Badge
                    variant={
                      isExpired
                        ? "destructive"
                        : currentSub.status === "trial"
                          ? "outline"
                          : "default"
                    }
                  >
                    {isExpired
                      ? "Vencido"
                      : currentSub.status === "trial"
                        ? "Periodo de prueba"
                        : "Suscripción activa"}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Detalles del servicio contratado para la administración de {org.name}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentSub ? (
                <>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-lg font-bold">
                      {currentSub.plan?.name ?? "Plan AdminFit"}
                    </div>
                    {currentSub.plan?.description && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {currentSub.plan.description}
                      </p>
                    )}
                    <div className="text-primary mt-2 text-2xl font-extrabold tabular-nums">
                      {formatCOP(currentSub.priceCentsSnapshot)}
                      <span className="text-muted-foreground text-xs font-normal"> / mes</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Fecha de inicio:</span>
                      <span>{formatDate(currentSub.startDate)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Fecha de vencimiento:</span>
                      <span className="font-semibold">{formatDate(currentSub.endDate)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Límite de socios:</span>
                      <span className="font-medium">
                        {currentSub.plan?.maxMembers
                          ? `${currentSub.plan.maxMembers} socios`
                          : "Ilimitado"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Límite de sedes:</span>
                      <span className="font-medium">
                        {currentSub.plan?.maxBranches
                          ? `${currentSub.plan.maxBranches} sedes`
                          : "Ilimitado"}
                      </span>
                    </div>
                    <div className="flex justify-between pb-2">
                      <span className="text-muted-foreground">Límite de equipo:</span>
                      <span className="font-medium">
                        {currentSub.plan?.maxStaff
                          ? `${currentSub.plan.maxStaff} usuarios`
                          : "Ilimitado"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    {isExpired ? (
                      <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-xs font-medium">
                        <AlertCircle className="size-4 shrink-0" />
                        <span>
                          Tu plan venció el {formatDate(currentSub.endDate)}. Realiza la
                          transferencia utilizando los datos bancarios para renovar tu acceso.
                        </span>
                      </div>
                    ) : (
                      <div className="bg-primary/10 text-primary flex items-center gap-2 rounded-md p-3 text-xs font-medium">
                        <CheckCircle2 className="size-4 shrink-0" />
                        <span>Tu servicio se encuentra al día y en funcionamiento.</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  <Clock className="mx-auto mb-2 size-8 opacity-40" />
                  <p className="font-medium">Sin plan asignado</p>
                  <p className="mt-1 text-xs">
                    Tu gimnasio aún no tiene una suscripción configurada. Comunícate con el equipo
                    de AdminFit para activar tu plan.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Datos para pagar */}
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
                <CreditCard className="text-primary size-5" />
                Cómo renovar tu plan
              </CardTitle>
              <CardDescription>
                Transfiere el valor de tu mensualidad a las siguientes cuentas oficiales de
                AdminFit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bankSettings ? (
                <>
                  <div className="border-border/60 divide-border/60 divide-y rounded-lg border text-sm">
                    {bankSettings.bankHolderName && (
                      <div className="flex justify-between p-3">
                        <span className="text-muted-foreground">Titular:</span>
                        <span className="font-medium">{bankSettings.bankHolderName}</span>
                      </div>
                    )}
                    {bankSettings.bankName && (
                      <div className="flex justify-between p-3">
                        <span className="text-muted-foreground">Banco:</span>
                        <span className="font-medium">{bankSettings.bankName}</span>
                      </div>
                    )}
                    {bankSettings.bankAccountType && (
                      <div className="flex justify-between p-3">
                        <span className="text-muted-foreground">Tipo de cuenta:</span>
                        <span className="font-medium">
                          {BANK_ACCOUNT_TYPE_LABELS[bankSettings.bankAccountType] ??
                            bankSettings.bankAccountType}
                        </span>
                      </div>
                    )}
                    {bankSettings.bankAccountNumber && (
                      <div className="flex justify-between p-3">
                        <span className="text-muted-foreground">Número de cuenta:</span>
                        <span className="font-mono font-bold">
                          {bankSettings.bankAccountNumber}
                        </span>
                      </div>
                    )}
                    {bankSettings.nequiNumber && (
                      <div className="flex justify-between p-3">
                        <span className="text-muted-foreground">Nequi / Daviplata:</span>
                        <span className="font-mono font-bold">{bankSettings.nequiNumber}</span>
                      </div>
                    )}
                  </div>

                  {bankSettings.additionalInfo && (
                    <div className="bg-muted/40 rounded-lg p-3 text-xs leading-relaxed">
                      <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                        Instrucciones de confirmación
                      </div>
                      <p>{bankSettings.additionalInfo}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  <Building2 className="mx-auto mb-2 size-8 opacity-40" />
                  <p>Información bancaria no configurada</p>
                  <p className="mt-1 text-xs">
                    Contacta a soporte técnico de AdminFit para coordinar la renovación de tu plan.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

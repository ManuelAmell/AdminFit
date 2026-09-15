import type { Metadata } from "next";
import { CreditCard, Receipt } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { MembershipBadge } from "@/components/members/membership-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { roleCan } from "@/lib/auth/authorize";
import { requireOrg } from "@/lib/auth/session";
import { dateTimeFmt, daysUntil, formatDate } from "@/lib/dates";
import { DOCUMENT_TYPE_LABELS, GENDER_LABELS, MEMBER_STATUS_LABELS } from "@/lib/members/labels";
import { formatCOP } from "@/lib/money";
import { getMember } from "@/modules/members/queries";
import { MemberActions } from "./member-actions";

export const metadata: Metadata = { title: "Socio — AdminFit" };

const SUB_STATUS: Record<string, string> = {
  active: "Activa",
  expired: "Vencida",
  frozen: "Congelada",
  cancelled: "Cancelada",
};
const PAY_METHOD: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children ?? "—"}</dd>
    </div>
  );
}

export default async function MemberPage({ params }: PageProps<"/app/[orgSlug]/members/[id]">) {
  const { orgSlug, id } = await params;
  const { org, role, isSuperadmin } = await requireOrg(orgSlug);
  const result = await getMember(org.id, id);
  if (!result) notFound();
  const { member: m, subscriptions, payments, membership, latestSubscription } = result;

  const canUpdate = isSuperadmin || roleCan(role, { gymMember: ["update"] });
  const canDelete = isSuperadmin || roleCan(role, { gymMember: ["delete"] });
  const fullName = `${m.firstName} ${m.lastName}`;
  const remaining = latestSubscription ? daysUntil(latestSubscription.endDate) : null;

  return (
    <>
      <PageHeader
        title={fullName}
        description={`${m.documentType} ${m.documentNumber}`}
        actions={
          <MemberActions
            orgSlug={org.slug}
            memberId={m.id}
            name={fullName}
            status={m.status}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16 text-lg">
            <AvatarFallback>{initials(m.firstName, m.lastName)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">{fullName}</h2>
              <MembershipBadge state={membership} />
              {m.status !== "active" && (
                <Badge variant="secondary">{MEMBER_STATUS_LABELS[m.status]}</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {latestSubscription
                ? membership === "frozen"
                  ? `Congelada hasta ${latestSubscription.frozenUntil ? formatDate(latestSubscription.frozenUntil) : "nuevo aviso"}`
                  : remaining !== null && remaining >= 0
                    ? `${latestSubscription.planName ?? "Plan"} · vence ${formatDate(latestSubscription.endDate)} (${remaining === 0 ? "hoy" : `en ${remaining} día${remaining === 1 ? "" : "s"}`})`
                    : `${latestSubscription.planName ?? "Plan"} · venció ${formatDate(latestSubscription.endDate)} (hace ${Math.abs(remaining ?? 0)} día${Math.abs(remaining ?? 0) === 1 ? "" : "s"})`
                : "Este socio aún no tiene una membresía."}
            </p>
          </div>
        </section>

        <Tabs defaultValue="summary">
          <TabsList aria-label="Secciones del socio">
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="memberships">Membresías</TabsTrigger>
            <TabsTrigger value="payments">Pagos</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={3}>
                    Datos personales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Detail label="Documento">
                      {DOCUMENT_TYPE_LABELS[m.documentType]}{" "}
                      <span className="tabular-nums">{m.documentNumber}</span>
                    </Detail>
                    <Detail label="Género">{GENDER_LABELS[m.gender]}</Detail>
                    <Detail label="Fecha de nacimiento">
                      {m.birthDate ? formatDate(m.birthDate) : null}
                    </Detail>
                    <Detail label="Registrado">{formatDate(m.createdAt)}</Detail>
                  </dl>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={3}>
                    Contacto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Detail label="Teléfono">
                      {m.phone ? (
                        <a href={`tel:${m.phone}`} className="underline-offset-4 hover:underline">
                          {m.phone}
                        </a>
                      ) : null}
                    </Detail>
                    <Detail label="Correo">
                      {m.email ? (
                        <a
                          href={`mailto:${m.email}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {m.email}
                        </a>
                      ) : null}
                    </Detail>
                    <Detail label="Contacto de emergencia">{m.emergencyContactName}</Detail>
                    <Detail label="Teléfono de emergencia">{m.emergencyContactPhone}</Detail>
                  </dl>
                </CardContent>
              </Card>
              {m.notes && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle role="heading" aria-level={3}>
                      Notas internas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{m.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="memberships" className="mt-4">
            <Card>
              <CardContent className="px-0">
                {subscriptions.length === 0 ? (
                  <EmptyTab
                    icon={
                      <CreditCard className="text-muted-foreground size-5" aria-hidden="true" />
                    }
                    title="Sin membresías"
                    text="Cuando vendas un plan a este socio aparecerá aquí."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Plan</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead>Fin</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="pr-6 text-right">Precio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="pl-6 font-medium">{s.planName ?? "—"}</TableCell>
                          <TableCell className="tabular-nums">{formatDate(s.startDate)}</TableCell>
                          <TableCell className="tabular-nums">{formatDate(s.endDate)}</TableCell>
                          <TableCell>
                            <Badge variant={s.status === "active" ? "outline" : "secondary"}>
                              {SUB_STATUS[s.status] ?? s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-6 text-right tabular-nums">
                            {formatCOP(s.priceCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardContent className="px-0">
                {payments.length === 0 ? (
                  <EmptyTab
                    icon={<Receipt className="text-muted-foreground size-5" aria-hidden="true" />}
                    title="Sin pagos"
                    text="Los pagos registrados a este socio aparecerán aquí con su recibo."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Recibo</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="pr-6 text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="pl-6 font-medium tabular-nums">
                            #{p.receiptNumber}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {dateTimeFmt.format(p.paidAt)}
                          </TableCell>
                          <TableCell>{PAY_METHOD[p.method] ?? p.method}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === "voided" ? "destructive" : "outline"}>
                              {p.status === "voided" ? "Anulado" : "Pagado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-6 text-right tabular-nums">
                            {formatCOP(p.amountCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function EmptyTab({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="bg-muted flex size-11 items-center justify-center rounded-full">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}

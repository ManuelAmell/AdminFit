import type { Metadata } from "next";
import { asc, count, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { member, organization } from "@/db/schema";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSuperadmin } from "@/lib/auth/session";
import { AdminOrgActions } from "./org-actions";

export const metadata: Metadata = { title: "Plataforma — AdminFit" };

export default async function AdminPage() {
  await requireSuperadmin();

  const [orgs, owners] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        city: organization.city,
        status: organization.status,
        createdAt: organization.createdAt,
        members: count(member.id),
      })
      .from(organization)
      .leftJoin(member, eq(member.organizationId, organization.id))
      .groupBy(organization.id)
      .orderBy(sql`${organization.createdAt} desc`),
    db
      .select({ orgId: member.organizationId, userId: member.userId })
      .from(member)
      .where(eq(member.role, "owner"))
      .orderBy(asc(member.createdAt)),
  ]);
  // En el raro caso de varios "owner" por org, nos quedamos con el primero (más antiguo).
  const ownerByOrg = new Map<string, string>();
  for (const o of owners) {
    if (!ownerByOrg.has(o.orgId)) ownerByOrg.set(o.orgId, o.userId);
  }

  const dateFmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Logo className="text-lg" />
        <Badge>Superadmin</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Gimnasios
          </CardTitle>
          <CardDescription>{orgs.length} tenants registrados.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Gimnasio</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="pr-6 text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="pl-6">
                      <div className="flex flex-col">
                        <span className="font-medium">{o.name}</span>
                        <span className="text-muted-foreground font-mono text-xs">{o.slug}</span>
                      </div>
                    </TableCell>
                    <TableCell>{o.city ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{o.members}</TableCell>
                    <TableCell>
                      <Badge variant={o.status === "suspended" ? "destructive" : "secondary"}>
                        {o.status === "suspended" ? "Suspendido" : "Activo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {dateFmt.format(o.createdAt)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/app/${o.slug}/dashboard`} />}
                        >
                          Abrir
                        </Button>
                        <AdminOrgActions
                          orgId={o.id}
                          orgSlug={o.slug}
                          orgName={o.name}
                          status={o.status ?? "active"}
                          ownerUserId={ownerByOrg.get(o.id) ?? null}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invitation, member } from "@/db/schema";
import { PageHeader } from "@/components/layout/page-header";
import { requireOrg } from "@/lib/auth/session";
import { TeamView } from "./team-view";

export const metadata: Metadata = { title: "Equipo — AdminFit" };

export default async function TeamPage({ params }: PageProps<"/app/[orgSlug]/settings/team">) {
  const { orgSlug } = await params;
  const { org, role, userId } = await requireOrg(orgSlug);

  const [members, invitations] = await Promise.all([
    db.query.member.findMany({
      where: eq(member.organizationId, org.id),
      with: { user: { columns: { id: true, name: true, email: true } } },
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    }),
    db.query.invitation.findMany({
      where: and(eq(invitation.organizationId, org.id), eq(invitation.status, "pending")),
      orderBy: (i, { desc }) => [desc(i.createdAt)],
    }),
  ]);

  const canManage = role === "owner" || role === "admin";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <>
      <PageHeader title="Equipo" description="Personas con acceso a este gimnasio" />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <TeamView
          orgId={org.id}
          currentUserId={userId}
          currentRole={role}
          canManage={canManage}
          members={members.map((m) => ({
            id: m.id,
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
          }))}
          invitations={invitations.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role ?? "staff",
            expiresAt: i.expiresAt.toISOString(),
            link: `${appUrl}/invite/${i.id}`,
          }))}
        />
      </div>
    </>
  );
}

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { member } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

// Punto de entrada tras login: manda al gym activo (o al primero) o al onboarding si no tiene ninguno.
export default async function AppEntryPage() {
  const session = await requireUser();

  const memberships = await db.query.member.findMany({
    where: eq(member.userId, session.user.id),
    with: { organization: { columns: { slug: true, id: true } } },
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });

  if (memberships.length === 0) {
    if (session.user.role === "superadmin") redirect("/admin");
    redirect("/onboarding");
  }

  const activeId = session.session.activeOrganizationId;
  const target = memberships.find((m) => m.organizationId === activeId) ?? memberships[0];
  redirect(`/app/${target.organization.slug}/dashboard`);
}

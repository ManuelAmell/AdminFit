import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { member } from "@/db/schema";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentSession, requireOrg } from "@/lib/auth/session";

export default async function OrgLayout({ children, params }: LayoutProps<"/app/[orgSlug]">) {
  const { orgSlug } = await params;
  const [{ org, role, userId, isSuperadmin }, session, cookieStore] = await Promise.all([
    requireOrg(orgSlug),
    getCurrentSession(),
    cookies(),
  ]);

  const memberships = await db.query.member.findMany({
    where: eq(member.userId, userId),
    with: { organization: { columns: { id: true, name: true, slug: true } } },
  });
  const orgs = memberships.map((m) => m.organization);
  if (isSuperadmin && !orgs.some((o) => o.id === org.id)) {
    orgs.unshift({ id: org.id, name: org.name, slug: org.slug });
  }

  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        org={{ id: org.id, name: org.name, slug: org.slug }}
        orgs={orgs}
        role={role}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          isSuperadmin,
        }}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}

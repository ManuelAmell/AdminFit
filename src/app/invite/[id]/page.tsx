import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitation } from "@/db/schema";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { OrgRole } from "@/lib/auth/permissions";
import { AcceptInvitation } from "./accept-invitation";

export const metadata: Metadata = { title: "Invitación — AdminFit" };

export default async function InvitePage({ params }: PageProps<"/invite/[id]">) {
  const { id } = await params;
  const session = await requireUser();

  const inv = await db.query.invitation.findFirst({
    where: eq(invitation.id, id),
    with: { organization: { columns: { name: true, slug: true } } },
  });

  const now = new Date();
  const state = !inv
    ? "missing"
    : inv.status !== "pending"
      ? "used"
      : inv.expiresAt < now
        ? "expired"
        : inv.email.toLowerCase() !== session.user.email.toLowerCase()
          ? "wrong-account"
          : "ok";

  return (
    <div className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Logo className="self-center text-lg" />
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={1} className="text-xl">
              {state === "ok" ? `Únete a ${inv!.organization.name}` : "Invitación no disponible"}
            </CardTitle>
            <CardDescription>
              {state === "ok" &&
                `Te invitaron como ${ROLE_LABELS[(inv!.role ?? "staff") as OrgRole].toLowerCase()}.`}
              {state === "missing" && "Este enlace no corresponde a ninguna invitación."}
              {state === "used" && "Esta invitación ya fue usada o cancelada."}
              {state === "expired" && "Esta invitación venció. Pide a tu administrador una nueva."}
              {state === "wrong-account" &&
                `La invitación es para ${inv!.email}, pero iniciaste sesión como ${session.user.email}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AcceptInvitation
              invitationId={id}
              orgSlug={inv?.organization.slug ?? null}
              state={state}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

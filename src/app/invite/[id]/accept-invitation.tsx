"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient, signOut } from "@/lib/auth/client";

type State = "ok" | "missing" | "used" | "expired" | "wrong-account";

export function AcceptInvitation({
  invitationId,
  orgSlug,
  state,
}: {
  invitationId: string;
  orgSlug: string | null;
  state: State;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading(true);
    setError(null);
    const res = await authClient.organization.acceptInvitation({ invitationId });
    if (res.error) {
      setLoading(false);
      setError(res.error.message ?? "No pudimos aceptar la invitación.");
      return;
    }
    await authClient.organization.setActive({ organizationId: res.data.member.organizationId });
    router.replace(`/app/${orgSlug}/dashboard`);
    router.refresh();
  }

  async function switchAccount() {
    await signOut();
    router.replace(`/login?next=/invite/${invitationId}`);
    router.refresh();
  }

  if (state === "wrong-account") {
    return (
      <Button variant="outline" size="lg" className="h-11 w-full" onClick={switchAccount}>
        Cambiar de cuenta
      </Button>
    );
  }

  if (state !== "ok") {
    return (
      <Button
        variant="outline"
        size="lg"
        className="h-11 w-full"
        nativeButton={false}
        render={<Link href="/app" />}
      >
        Ir a mi cuenta
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button size="lg" className="h-11 w-full" onClick={accept} disabled={loading}>
        {loading && <Spinner />}
        Aceptar invitación
      </Button>
    </div>
  );
}

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { requireSuperadmin } from "@/lib/auth/session";
import { AdminTabs } from "./admin-tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Logo className="text-lg" />
        <Badge>Superadmin</Badge>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}

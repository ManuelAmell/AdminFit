import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="bg-background/95 sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b px-4 py-2 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1 size-9" aria-label="Abrir menú" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{title}</h1>
        {description && (
          <p className="text-muted-foreground truncate text-xs md:text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";

// Reemplazo de <PageHeader> para loading.tsx: ahí no hay datos todavía (org, título), así
// que solo se sugiere la forma de la barra en vez de repetir el título real.
export function PageHeaderSkeleton() {
  return (
    <header className="bg-background/95 sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b px-4 py-2 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1 size-9" aria-label="Abrir menú" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </header>
  );
}

import { DataTableSkeleton } from "@/components/data-table/data-table";
import { PageHeaderSkeleton } from "@/components/layout/page-header-skeleton";

export default function MembersLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <DataTableSkeleton columns={5} />
      </div>
    </>
  );
}

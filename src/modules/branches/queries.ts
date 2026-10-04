import { and, asc, count, eq, isNull } from "drizzle-orm";
import { branches, members } from "@/db/schema";
import { withTenant } from "@/lib/tenant";

export type BranchWithStats = typeof branches.$inferSelect & {
  memberCount: number;
};

export async function listBranchesWithStats(orgId: string): Promise<BranchWithStats[]> {
  return withTenant(orgId, async (tx) => {
    const branchList = await tx
      .select()
      .from(branches)
      .where(and(eq(branches.orgId, orgId), isNull(branches.deletedAt)))
      .orderBy(asc(branches.name));

    const memberCounts = await tx
      .select({
        branchId: members.branchId,
        count: count(members.id),
      })
      .from(members)
      .where(and(eq(members.orgId, orgId), isNull(members.deletedAt)))
      .groupBy(members.branchId);

    const countsMap = new Map<string, number>();
    for (const mc of memberCounts) {
      if (mc.branchId) countsMap.set(mc.branchId, Number(mc.count));
    }

    return branchList.map((b) => ({
      ...b,
      memberCount: countsMap.get(b.id) ?? 0,
    }));
  });
}

export async function getBranch(orgId: string, id: string) {
  return withTenant(orgId, async (tx) => {
    const [b] = await tx
      .select()
      .from(branches)
      .where(and(eq(branches.id, id), eq(branches.orgId, orgId), isNull(branches.deletedAt)));
    return b ?? null;
  });
}

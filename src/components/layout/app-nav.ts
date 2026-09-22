import {
  BarChart3,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
// Desde permissions.ts, no authorize.ts: este archivo lo importa AppSidebar, un Client
// Component, y authorize.ts arrastra ./auth (Better Auth server + DB) al bundle del navegador.
import { can, type OrgRole, type Permissions } from "@/lib/auth/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  requires?: Permissions;
  badge?: number;
};

const MAIN_ITEMS = (base: string): NavItem[] => [
  { label: "Dashboard", href: `${base}/dashboard`, icon: LayoutDashboard },
  { label: "Socios", href: `${base}/members`, icon: Users, requires: { gymMember: ["read"] } },
  {
    label: "Membresías",
    href: `${base}/memberships`,
    icon: CreditCard,
    requires: { subscription: ["read"] },
  },
  { label: "Pagos", href: `${base}/payments`, icon: Receipt, requires: { payment: ["read"] } },
  {
    label: "Cartera",
    href: `${base}/payments/debts`,
    icon: HandCoins,
    requires: { debt: ["read"] },
  },
  { label: "Gastos", href: `${base}/expenses`, icon: Wallet, requires: { expense: ["read"] } },
  { label: "Planes", href: `${base}/plans`, icon: ListChecks, requires: { plan: ["read"] } },
];

const SECONDARY_ITEMS = (base: string): NavItem[] => [
  {
    label: "Reportes",
    href: `${base}/reports`,
    icon: BarChart3,
    requires: { report: ["read"] },
  },
  {
    label: "Configuración",
    href: `${base}/settings`,
    icon: Settings,
    requires: { settings: ["read"] },
  },
];

// Filtra por permiso: un ítem sin `requires` siempre se muestra (p. ej. Dashboard, que
// adapta su propio contenido por rol). Recepción nunca ve rutas que su rol no puede abrir.
function visible(items: NavItem[], ctx: { role: OrgRole; isSuperadmin: boolean }) {
  return items.filter((item) => !item.requires || can(ctx, item.requires));
}

export function orgNav(
  slug: string,
  ctx: { role: OrgRole; isSuperadmin: boolean },
  extra: { debtorsCount?: number } = {},
): { main: NavItem[]; secondary: NavItem[] } {
  const base = `/app/${slug}`;
  const main = visible(MAIN_ITEMS(base), ctx).map((item) =>
    item.href === `${base}/payments/debts` && extra.debtorsCount
      ? { ...item, badge: extra.debtorsCount }
      : item,
  );
  return {
    main,
    secondary: visible(SECONDARY_ITEMS(base), ctx),
  };
}

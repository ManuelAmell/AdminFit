import {
  CreditCard,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

export function orgNav(slug: string): { main: NavItem[]; secondary: NavItem[] } {
  const base = `/app/${slug}`;
  return {
    main: [
      { label: "Dashboard", href: `${base}/dashboard`, icon: LayoutDashboard },
      { label: "Socios", href: `${base}/members`, icon: Users },
      { label: "Membresías", href: `${base}/memberships`, icon: CreditCard },
      { label: "Pagos", href: `${base}/payments`, icon: Receipt },
      { label: "Planes", href: `${base}/plans`, icon: ListChecks },
    ],
    secondary: [{ label: "Configuración", href: `${base}/settings`, icon: Settings }],
  };
}

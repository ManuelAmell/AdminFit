import {
  BarChart3,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  Receipt,
  ScanLine,
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
      { label: "Check-in", href: `${base}/checkin`, icon: ScanLine },
      { label: "Socios", href: `${base}/members`, icon: Users },
      { label: "Clases", href: `${base}/classes`, icon: CalendarDays },
      { label: "Membresías", href: `${base}/memberships`, icon: CreditCard },
      { label: "Pagos", href: `${base}/payments`, icon: Receipt },
      { label: "Planes", href: `${base}/plans`, icon: ListChecks },
      { label: "Reportes", href: `${base}/reports`, icon: BarChart3 },
    ],
    secondary: [{ label: "Configuración", href: `${base}/settings`, icon: Settings }],
  };
}

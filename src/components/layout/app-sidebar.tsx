"use client";

import { Building2, Check, ChevronsUpDown, LogOut, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient, signOut } from "@/lib/auth/client";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { OrgRole } from "@/lib/auth/permissions";
import { orgNav } from "./app-nav";

export type SidebarOrg = { id: string; name: string; slug: string };
export type SidebarUser = { name: string; email: string; isSuperadmin: boolean };

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AppSidebar({
  org,
  orgs,
  role,
  user,
}: {
  org: SidebarOrg;
  orgs: SidebarOrg[];
  role: string;
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const nav = orgNav(org.slug);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function switchOrg(target: SidebarOrg) {
    if (target.id === org.id) return;
    await authClient.organization.setActive({ organizationId: target.id });
    router.push(`/app/${target.slug}/dashboard`);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-10 items-center px-2 group-data-[collapsible=icon]:px-0">
          <Logo
            href={`/app/${org.slug}/dashboard`}
            className="text-sm group-data-[collapsible=icon]:[&>span:last-child]:hidden"
          />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={org.name}
                    aria-label={`Gimnasio actual: ${org.name}. Cambiar gimnasio`}
                  />
                }
              >
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Building2 className="size-4" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                  <span className="truncate font-medium">{org.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {ROLE_LABELS[role as OrgRole] ?? role}
                  </span>
                </span>
                <ChevronsUpDown
                  className="text-muted-foreground ml-auto size-4"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Tus gimnasios</DropdownMenuLabel>
                {orgs.map((o) => (
                  <DropdownMenuItem key={o.id} onClick={() => switchOrg(o)}>
                    <Building2 />
                    <span className="flex-1 truncate">{o.name}</span>
                    {o.id === org.id && <Check className="text-primary" aria-label="Actual" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/onboarding" />}>
                  <Plus />
                  Nuevo gimnasio
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.main.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.secondary.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {user.isSuperadmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Plataforma" render={<Link href="/admin" />}>
                    <ShieldCheck aria-hidden="true" />
                    <span>Plataforma</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={user.name}
                    aria-label={`Cuenta: ${user.name}`}
                  />
                }
              >
                <Avatar className="size-8">
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </span>
                <ChevronsUpDown
                  className="text-muted-foreground ml-auto size-4"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

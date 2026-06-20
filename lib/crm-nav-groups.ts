import type { LucideIcon } from "lucide-react";
import type { CrmPermissionKey } from "@/lib/crm/access-permissions";
import {
  Users,
  Briefcase,
  MessageSquare,
  MessageCircle,
  LayoutTemplate,
  Zap,
  Wrench,
  Sparkles,
  Settings,
  BookOpen,
  LayoutDashboard,
} from "lucide-react";

export type CrmNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  extra?: { href: string; label: string };
  /** Badge opcional ao lado do rótulo (ex.: Copiloto em breve). */
  navBadge?: string;
  /** Ocultar para utilizadores sem papel admin (owner/admin). */
  adminOnly?: boolean;
  /** Só para equipe Waje (coluna users.owner = true). */
  wajeOwnerOnly?: boolean;
  /** Módulo exigido em `hub_acesso_cargos.permissoes` (utilizadores com cargo). */
  permission?: CrmPermissionKey;
};

export type CrmNavGroup = {
  id: string;
  label: string;
  sectionIcon: LucideIcon;
  items: CrmNavItem[];
};

/** Fonte de verdade do menu lateral — ver docs/menu-navegacao-consolidado.md */
export const CRM_NAV_GROUPS: CrmNavGroup[] = [
  {
    id: "insights",
    label: "Insights",
    sectionIcon: LayoutDashboard,
    items: [
      {
        href: "/crm/painel",
        label: "Dashboard & Relatórios",
        icon: LayoutDashboard,
        permission: "dashboard",
      },
    ],
  },
  {
    id: "ia",
    label: "IA",
    sectionIcon: Sparkles,
    items: [
      {
        href: "/crm/agentes",
        label: "Agentes IA",
        icon: LayoutTemplate,
        extra: { href: "/crm/agentes/novo", label: "Novo agente" },
        permission: "automacoes",
      },
      { href: "/crm/ciclos", label: "Ciclos de agentes", icon: Zap, permission: "automacoes" },
      { href: "/crm/conhecimento", label: "Conhecimento", icon: BookOpen, permission: "automacoes" },
      { href: "/crm/ferramentas", label: "Ferramentas", icon: Wrench, permission: "automacoes" },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    sectionIcon: Briefcase,
    items: [
      { href: "/crm/leads", label: "Leads", icon: Users, permission: "leads" },
      { href: "/crm/negocios", label: "Negócios", icon: Briefcase, permission: "negocios" },
    ],
  },
  {
    id: "atendimento",
    label: "Operação",
    sectionIcon: MessageSquare,
    items: [
      { href: "/crm/canais", label: "Canais", icon: MessageCircle, permission: "atendimento" },
      { href: "/crm/atendimento/equipe", label: "Equipe", icon: Users, permission: "atendimento" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    sectionIcon: Settings,
    items: [{ href: "/crm/configuracoes", label: "Conta", icon: Settings, permission: "configuracoes" }],
  },
];

export function isCrmAdminRole(role: string): boolean {
  const r = role.trim().toLowerCase();
  return r === "owner" || r === "admin" || r === "commercial";
}

export function filterCrmNavGroupsForRole(groups: CrmNavGroup[], role: string): CrmNavGroup[] {
  const admin = isCrmAdminRole(role);
  return groups
    .map(g => ({
      ...g,
      items: g.items.filter(item => !item.adminOnly || admin),
    }))
    .filter(g => g.items.length > 0);
}

export function findCrmNavGroupIdForPath(groups: CrmNavGroup[], pathname: string): string {
  for (const g of groups) {
    if (g.items.some(item => isCrmNavPathActive(pathname, item.href))) return g.id;
  }
  return groups[0]?.id ?? "ia";
}

export function isCrmNavPathActive(pathname: string, href: string): boolean {
  if (href === "/crm") return pathname === "/crm";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

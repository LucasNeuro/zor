import type { LucideIcon } from "lucide-react";
import {
  Users,
  Briefcase,
  User,
  Handshake,
  MessageSquare,
  MessageCircle,
  ClipboardCheck,
  LayoutTemplate,
  Zap,
  Wrench,
  Sparkles,
  Settings,
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
    id: "ia",
    label: "IA",
    sectionIcon: Sparkles,
    items: [
      {
        href: "/crm/agentes",
        label: "Agentes IA",
        icon: LayoutTemplate,
        extra: { href: "/crm/agentes/novo", label: "Novo agente" },
      },
      { href: "/crm/ciclos", label: "Automações", icon: Zap },
      { href: "/crm/ferramentas", label: "Ferramentas", icon: Wrench },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    sectionIcon: Briefcase,
    items: [
      { href: "/crm/leads", label: "Leads", icon: Users },
      { href: "/crm/negocios", label: "Negócios", icon: Briefcase },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    sectionIcon: User,
    items: [
      { href: "/crm/cadastro", label: "Cadastro", icon: User },
      { href: "/crm/parceiros", label: "Parceiros", icon: Handshake },
    ],
  },
  {
    id: "atendimento",
    label: "Atendimento",
    sectionIcon: MessageSquare,
    items: [
      { href: "/crm/atendimento", label: "Atendimento", icon: MessageSquare },
      { href: "/crm/canais", label: "Canais", icon: MessageCircle },
      { href: "/crm/aprovacoes", label: "Aprovações", icon: ClipboardCheck },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    sectionIcon: Settings,
    items: [{ href: "/crm/configuracoes", label: "Conta", icon: Settings }],
  },
];

export function isCrmAdminRole(role: string): boolean {
  const r = role.trim().toLowerCase();
  return r === "owner" || r === "admin";
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

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  LineChart,
  ClipboardList,
  Wallet,
  Users,
  Briefcase,
  User,
  Building2,
  Handshake,
  Package,
  Home,
  HardHat,
  Truck,
  MessageSquare,
  MessageCircle,
  ClipboardCheck,
  Radio,
  LayoutTemplate,
  Zap,
  Wrench,
  Sparkles,
  Settings,
  Plug,
  Bell,
  UserCog,
  Shield,
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
    id: "visao",
    label: "Visão Geral",
    sectionIcon: LayoutDashboard,
    items: [
      { href: "/crm", label: "Dashboard", icon: LayoutDashboard },
      { href: "/crm/analytics", label: "Analytics", icon: LineChart },
      { href: "/crm/relatorios", label: "Relatórios", icon: ClipboardList },
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
      { href: "/crm/pessoas", label: "Pessoas", icon: User },
      { href: "/crm/empresas", label: "Empresas", icon: Building2 },
      { href: "/crm/parceiros", label: "Parceiros", icon: Handshake },
    ],
  },
  {
    id: "produtos",
    label: "Produtos",
    sectionIcon: Package,
    items: [{ href: "/crm/imoveis", label: "Imóveis", icon: Home }],
  },
  {
    id: "obras",
    label: "Obras",
    sectionIcon: HardHat,
    items: [
      { href: "/crm/obras", label: "Obras", icon: HardHat },
      { href: "/crm/pedidos", label: "Pedidos", icon: Truck },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    sectionIcon: ClipboardList,
    items: [
      { href: "/crm/financeiro", label: "Visão financeira", icon: Wallet },
      { href: "/crm/financeiro/pagar", label: "Contas a pagar", icon: ClipboardList },
      { href: "/crm/financeiro/receber", label: "Contas a receber", icon: LineChart },
    ],
  },
  {
    id: "projetos",
    label: "Projetos",
    sectionIcon: Package,
    items: [{ href: "/crm/projetos", label: "Projetos", icon: LayoutTemplate }],
  },
  {
    id: "atendimento",
    label: "Atendimento",
    sectionIcon: MessageSquare,
    items: [
      { href: "/crm/atendimento", label: "Inbox", icon: MessageSquare },
      { href: "/crm/canais", label: "Canais", icon: MessageCircle },
      { href: "/crm/aprovacoes", label: "Aprovações", icon: ClipboardCheck },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    sectionIcon: Radio,
    items: [{ href: "/crm/trafego", label: "Campanhas", icon: Radio }],
  },
  {
    id: "ia",
    label: "IA & Automação",
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
      {
        href: "/crm/agentes-reais",
        label: "Copiloto",
        icon: Sparkles,
        navBadge: "Em breve",
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    sectionIcon: Settings,
    items: [
      { href: "/crm/configuracoes", label: "Configurações", icon: Settings },
      { href: "/crm/integracoes", label: "Integrações", icon: Plug },
      { href: "/crm/contatos", label: "Contatos de notificação", icon: Bell },
      { href: "/crm/usuarios", label: "Usuários & Permissões", icon: UserCog },
      {
        href: "/crm/onboarding-tenant",
        label: "Onboarding",
        icon: Shield,
        adminOnly: true,
      },
    ],
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
  return groups[0]?.id ?? "visao";
}

export function isCrmNavPathActive(pathname: string, href: string): boolean {
  if (href === "/crm") return pathname === "/crm";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

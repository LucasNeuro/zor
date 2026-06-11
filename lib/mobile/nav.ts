import type { LucideIcon } from "lucide-react";
import { Activity, Building2, MessageSquare, Megaphone, MoreHorizontal } from "lucide-react";

export type MobileTabId = "pulso" | "escritorio" | "atendimento" | "marketing" | "mais";

export type MobileTabDef = {
  id: MobileTabId;
  label: string;
  icon: LucideIcon;
  rota?: string;
  opensSheet?: boolean;
};

export const MOBILE_TABS: MobileTabDef[] = [
  { id: "pulso", label: "Pulso", icon: Activity, rota: "/crm" },
  { id: "escritorio", label: "CRM", icon: Building2, rota: "/crm" },
  { id: "atendimento", label: "Leads", icon: MessageSquare, rota: "/crm/leads?tab=chat" },
  { id: "marketing", label: "Marketing", icon: Megaphone, rota: "/crm/trafego" },
  { id: "mais", label: "Mais", icon: MoreHorizontal, opensSheet: true },
];

export type MobileMoreItem = {
  label: string;
  href: string;
  badgeKey?: "leads" | "aprovacoes" | "chat";
};

export const MOBILE_MORE_ITEMS: MobileMoreItem[] = [
  { label: "Leads", href: "/crm/leads", badgeKey: "leads" },
  { label: "Aprovações", href: "/crm/aprovacoes", badgeKey: "aprovacoes" },
  { label: "Agentes IA", href: "/crm/agentes" },
  { label: "Analytics", href: "/crm/analytics" },
  { label: "Negócios", href: "/crm/negocios" },
  { label: "Parceiros", href: "/crm/parceiros" },
  { label: "Financeiro", href: "/crm/financeiro" },
  { label: "Relatórios", href: "/crm/relatorios" },
  { label: "Conta", href: "/crm/configuracoes" },
];

const SHEET_PREFIXES = [
  "/crm/leads",
  "/crm/aprovacoes",
  "/crm/agentes",
  "/crm/analytics",
  "/crm/kpis",
  "/crm/negocios",
  "/crm/parceiros",
  "/crm/financeiro",
  "/crm/relatorios",
  "/crm/configuracoes",
  "/crm/pessoas",
  "/crm/empresas",
  "/crm/imoveis",
  "/crm/obras",
  "/crm/pedidos",
  "/crm/projetos",
  "/crm/ciclos",
  "/crm/conhecimento",
  "/crm/canais",
  "/crm/ferramentas",
  "/crm/contatos",
  "/crm/usuarios",
  "/crm/conteudo",
  "/crm/agentes-reais",
];

/** Aba inferior ativa para a rota atual. */
export function mobileTabIdFromPath(pathname: string): MobileTabId {
  if (pathname.startsWith("/crm/atendimento/equipe")) return "atendimento";
  if (pathname.startsWith("/crm/leads")) return "atendimento";
  if (pathname.startsWith("/crm/trafego")) return "marketing";
  if (pathname === "/crm" || pathname === "/crm/") return "pulso";
  if (SHEET_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return "mais";
  if (pathname.startsWith("/crm")) return "pulso";
  return "pulso";
}

export function isMobileShellRoute(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/cadastro")) return false;
  if (pathname.startsWith("/parceiro/")) return false;
  if (pathname.startsWith("/fornecedor/")) return false;
  if (pathname.startsWith("/agentes/") || pathname === "/agentes") return false;
  if (pathname.startsWith("/comando/") || pathname === "/comando") return false;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  return pathname.startsWith("/crm");
}

export function mobilePageTitle(pathname: string): string {
  if (pathname === "/crm") return "Pulso";
  if (pathname === "/crm/leads" || pathname.startsWith("/crm/leads/")) return "Leads";
  if (pathname === "/crm/atendimento/equipe") return "Equipe";
  if (pathname === "/crm/aprovacoes") return "Aprovações";
  if (pathname === "/crm/agentes") return "Agentes IA";
  if (pathname.startsWith("/crm/agentes/")) return "Agente IA";
  if (pathname === "/crm/analytics" || pathname === "/crm/kpis") return "Analytics";
  if (pathname === "/crm/trafego") return "Marketing";
  if (pathname === "/crm/financeiro" || pathname.startsWith("/crm/financeiro/")) return "Financeiro";
  if (pathname.startsWith("/crm/negocios")) return "Negócios";
  if (pathname.startsWith("/crm/parceiros")) return "Parceiros";
  if (pathname === "/crm/configuracoes") return "Conta";
  return "Waje";
}

/** Rotas secundárias (sheet): exibir header com voltar. */
export function needsMobileSubHeader(pathname: string): boolean {
  return SHEET_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

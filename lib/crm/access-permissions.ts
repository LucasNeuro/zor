import type { CrmNavGroup } from "@/lib/crm-nav-groups";
import { CRM_NAV_GROUPS, isCrmAdminRole } from "@/lib/crm-nav-groups";
import { appendWajeOwnerNav, isWajeOwnerPath } from "@/lib/crm/waje-owner-nav";

export type CrmAccessContext = {
  baseRole: string;
  permissoes: Record<string, boolean> | null;
  wajeOwner?: boolean;
};

export type CrmPermissionKey =
  | "dashboard"
  | "leads"
  | "negocios"
  | "atendimento"
  | "cadastros"
  | "automacoes"
  | "configuracoes";

/** Prefixos de rota CRM → chave em `hub_acesso_cargos.permissoes`. */
const PATH_PERMISSION_RULES: Array<{ prefix: string; key: CrmPermissionKey }> = [
  { prefix: "/crm/configuracoes", key: "configuracoes" },
  { prefix: "/crm/leads", key: "leads" },
  { prefix: "/crm/negocios", key: "negocios" },
  { prefix: "/crm/cadastro", key: "leads" },
  { prefix: "/crm/parceiros", key: "leads" },
  { prefix: "/crm/pessoas", key: "leads" },
  { prefix: "/crm/empresas", key: "leads" },
  { prefix: "/crm/atendimento", key: "atendimento" },
  { prefix: "/crm/canais", key: "atendimento" },
  { prefix: "/crm/aprovacoes", key: "atendimento" },
  { prefix: "/crm/agentes", key: "automacoes" },
  { prefix: "/crm/ciclos", key: "automacoes" },
  { prefix: "/crm/conhecimento", key: "automacoes" },
  { prefix: "/crm/ferramentas", key: "automacoes" },
  { prefix: "/crm/trafego", key: "leads" },
  { prefix: "/crm/waje", key: "dashboard" },
  { prefix: "/crm/painel", key: "dashboard" },
  { prefix: "/crm/relatorios", key: "dashboard" },
  { prefix: "/crm/analytics", key: "dashboard" },
  { prefix: "/crm", key: "dashboard" },
];

export function permissionKeyForPath(pathname: string): CrmPermissionKey | null {
  const path = pathname.split("?")[0] || "/crm";
  const sorted = [...PATH_PERMISSION_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule.key;
    }
  }
  return null;
}

/** Acesso total ao CRM (menu + rotas): admin do tenant ou equipe plataforma Waje. */
export function hasFullCrmAccess(ctx: CrmAccessContext): boolean {
  return Boolean(ctx.wajeOwner) || isCrmAdminRole(ctx.baseRole);
}

export function canAccessCrmPath(pathname: string, ctx: CrmAccessContext): boolean {
  if (isWajeOwnerPath(pathname)) {
    return Boolean(ctx.wajeOwner);
  }

  if (hasFullCrmAccess(ctx)) return true;

  const key = permissionKeyForPath(pathname);
  if (!key) return true;

  const perms = ctx.permissoes;
  if (!perms) return key === "dashboard";

  if (!(key in perms)) return false;

  return Boolean(perms[key]);
}

/** Primeira rota permitida — evita loop /crm ↔ /crm/painel após login. */
export function defaultCrmLandingPath(ctx: CrmAccessContext): string {
  const painel = "/crm/painel?tab=visao-geral&view=paineis";

  if (ctx.wajeOwner) return "/crm/waje/tenants";
  if (isCrmAdminRole(ctx.baseRole)) return painel;
  if (canAccessCrmPath("/crm/painel", ctx)) return painel;

  const groups = filterCrmNavGroupsForAccess(
    appendWajeOwnerNav(CRM_NAV_GROUPS, Boolean(ctx.wajeOwner)),
    ctx,
  );
  const first = groups.flatMap((g) => g.items)[0]?.href;
  if (first && first !== "/crm") return first;

  return "/crm/configuracoes";
}

export function filterCrmNavGroupsForAccess(
  groups: CrmNavGroup[],
  ctx: CrmAccessContext,
): CrmNavGroup[] {
  const filtered = (() => {
  if (hasFullCrmAccess(ctx)) {
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => {
          if (item.wajeOwnerOnly) return Boolean(ctx.wajeOwner);
          return !item.adminOnly || hasFullCrmAccess(ctx);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }

  const perms = ctx.permissoes;

  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.wajeOwnerOnly) return Boolean(ctx.wajeOwner);
        if (item.adminOnly) return false;
        const key = item.permission;
        if (!key) return true;
        if (!perms) return false;
        return Boolean(perms[key]);
      }),
    }))
    .filter((g) => g.items.length > 0);
  })();

  return filtered;
}

export function buildWajeAccessCopyText(
  email: string,
  password: string,
  origin?: string,
  cargoNome?: string,
): string {
  const base = (origin ?? "").replace(/\/$/, "") || "https://app.waje.com.br";
  const lines = [
    "Acesso Waje",
    "",
    `URL: ${base}/login`,
    `E-mail: ${email.trim()}`,
    `Senha: ${password}`,
  ];
  if (cargoNome?.trim()) lines.push(`Cargo: ${cargoNome.trim()}`);
  lines.push("", "Guarde estas credenciais em local seguro.");
  return lines.join("\n");
}

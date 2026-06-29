import type { CrmNavGroup } from "@/lib/crm-nav-groups";
import { CRM_NAV_GROUPS, isCrmAdminRole } from "@/lib/crm-nav-groups";
import { appendWajeOwnerNav, isWajeOwnerPath } from "@/lib/crm/waje-owner-nav";
import { isPlatformTeamRole } from "@/lib/auth/verify-ops-user";

export type CrmAccessContext = {
  baseRole: string;
  permissoes: Record<string, boolean> | null;
  wajeOwner?: boolean;
  tenantId?: string | null;
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
  { prefix: "/crm/atendimentos", key: "atendimento" },
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

/** Cadastro / owner do tenant: ligado a um tenant sem cargo customizado. */
export function isTenantRegistrantFullAccess(ctx: CrmAccessContext): boolean {
  return Boolean(ctx.tenantId) && ctx.permissoes == null;
}

/** Acesso total ao CRM: admin do tenant, cadastro público ou equipe plataforma. */
export function hasFullCrmAccess(ctx: CrmAccessContext): boolean {
  return (
    Boolean(ctx.wajeOwner) ||
    isCrmAdminRole(ctx.baseRole) ||
    isPlatformTeamRole(ctx.baseRole) ||
    isTenantRegistrantFullAccess(ctx)
  );
}

/** Equipe plataforma — uma flag unificada (não confundir com role CRM owner do tenant). */
export function isPlatformTeamAccess(ctx: CrmAccessContext): boolean {
  return Boolean(ctx.wajeOwner) || isPlatformTeamRole(ctx.baseRole);
}

export function canAccessCrmPath(pathname: string, ctx: CrmAccessContext): boolean {
  if (isWajeOwnerPath(pathname)) {
    return isPlatformTeamAccess(ctx);
  }

  if (hasFullCrmAccess(ctx)) return true;

  const key = permissionKeyForPath(pathname);
  if (!key) return true;

  const perms = ctx.permissoes;
  if (!perms) return key === "dashboard";

  if (!(key in perms)) return false;

  return Boolean(perms[key]);
}

/** Primeira rota após login — equipe plataforma usa o mesmo painel que admin. */
export function defaultCrmLandingPath(ctx: CrmAccessContext): string {
  const painel = "/crm/painel?tab=visao-geral&view=paineis";

  if (hasFullCrmAccess(ctx)) return painel;
  if (canAccessCrmPath("/crm/painel", ctx)) return painel;

  const groups = filterCrmNavGroupsForAccess(
    appendWajeOwnerNav(CRM_NAV_GROUPS, isPlatformTeamAccess(ctx)),
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
          if (item.wajeOwnerOnly) return isPlatformTeamAccess(ctx);
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
        if (item.wajeOwnerOnly) return isPlatformTeamAccess(ctx);
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

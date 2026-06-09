import type { CrmNavGroup } from "@/lib/crm-nav-groups";
import { isCrmAdminRole } from "@/lib/crm-nav-groups";

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
  { prefix: "/crm/relatorios", key: "dashboard" },
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

export function canAccessCrmPath(
  pathname: string,
  ctx: { baseRole: string; permissoes: Record<string, boolean> | null }
): boolean {
  if (isCrmAdminRole(ctx.baseRole)) return true;

  const key = permissionKeyForPath(pathname);
  if (!key) return true;

  const perms = ctx.permissoes;
  if (!perms) return key === "dashboard";

  return Boolean(perms[key]);
}

export function filterCrmNavGroupsForAccess(
  groups: CrmNavGroup[],
  ctx: { baseRole: string; permissoes: Record<string, boolean> | null }
): CrmNavGroup[] {
  if (isCrmAdminRole(ctx.baseRole)) {
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => !item.adminOnly || isCrmAdminRole(ctx.baseRole)),
      }))
      .filter((g) => g.items.length > 0);
  }

  const perms = ctx.permissoes;

  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.adminOnly) return false;
        const key = item.permission;
        if (!key) return true;
        if (!perms) return false;
        return Boolean(perms[key]);
      }),
    }))
    .filter((g) => g.items.length > 0);
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

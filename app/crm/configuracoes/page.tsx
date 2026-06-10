"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutDashboard,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Trash2,
  CheckCircle2,
  Copy,
  EyeOff,
  UserPlus,
  Users,
  UserSearch,
  Zap,
} from "lucide-react";
import { buildWajeAccessCopyText } from "@/lib/crm/access-permissions";
import { ContaSectionTabs } from "@/components/crm/ContaSectionTabs";
import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import { sparklineFromCounts, sparklineFromSeed } from "@/lib/crm/metric-visuals";
import {
  CrmResizableDataTable,
  type CrmResizableColumn,
} from "@/components/crm/CrmResizableDataTable";
import { PermissionToggleRow } from "@/components/crm/PermissionToggleRow";
import {
  RF_ACCENT,
  RF_BG_DEEP,
  RF_BG_PANEL,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_OVERLAY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfAsideFooterStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { isCrmAdminRole } from "@/lib/crm-nav-groups";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { normalizeUserRow } from "@/lib/crm/users-row";
import { supabase } from "@/lib/supabase/client";
import { useCrmConfirm, useCrmToast } from "@/lib/crm/crm-feedback";

type MeProfile = {
  id: string;
  auth_id: string | null;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  tenant_id: string | null;
  access_role_id?: string | null;
  criado_em?: string;
  atualizado_em?: string;
};

type AccessRole = {
  id: string;
  tenant_id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  permissoes: Record<string, boolean>;
  ativo: boolean;
};

type AuditoriaLog = {
  id: string;
  actor_nome: string | null;
  actor_email: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  resumo: string;
  metadata: Record<string, unknown> | null;
  criado_em: string;
};

type TenantUser = {
  id: string;
  auth_id: string | null;
  email: string | null;
  name: string | null;
  phone?: string | null;
  role: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  tenant_id: string | null;
  access_role_id: string | null;
};

function roleLabel(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "owner") return "Owner";
  if (r === "admin") return "Admin";
  if (r === "vendedor") return "Vendedor";
  if (r === "atendente") return "Atendente";
  if (r === "parceiro") return "Parceiro";
  return role || "Membro";
}

function isOwner(role: string): boolean {
  return role.trim().toLowerCase() === "owner";
}

type PermissionFlags = {
  pDashboard: boolean;
  pLeads: boolean;
  pNegocios: boolean;
  pAtendimento: boolean;
  pCadastros: boolean;
  pAutomacoes: boolean;
  pConfiguracoes: boolean;
};

const ALL_PERMISSIONS_ON: PermissionFlags = {
  pDashboard: true,
  pLeads: true,
  pNegocios: true,
  pAtendimento: true,
  pCadastros: true,
  pAutomacoes: true,
  pConfiguracoes: true,
};

function permissoesFromFlags(flags: PermissionFlags): Record<string, boolean> {
  return {
    dashboard: flags.pDashboard,
    leads: flags.pLeads,
    negocios: flags.pNegocios,
    atendimento: flags.pAtendimento,
    cadastros: flags.pCadastros,
    automacoes: flags.pAutomacoes,
    configuracoes: flags.pConfiguracoes,
  };
}

function flagsFromPermissoes(p?: Record<string, boolean> | null): PermissionFlags {
  const src = p ?? {};
  return {
    pDashboard: Boolean(src.dashboard),
    pLeads: Boolean(src.leads),
    pNegocios: Boolean(src.negocios),
    pAtendimento: Boolean(src.atendimento),
    pCadastros: Boolean(src.cadastros),
    pAutomacoes: Boolean(src.automacoes),
    pConfiguracoes: Boolean(src.configuracoes),
  };
}

const MODULO_LABELS: { key: keyof PermissionFlags; label: string }[] = [
  { key: "pDashboard", label: "Dashboard" },
  { key: "pLeads", label: "Leads" },
  { key: "pNegocios", label: "Negócios" },
  { key: "pAtendimento", label: "Atendimento" },
  { key: "pAutomacoes", label: "Automações" },
  { key: "pConfiguracoes", label: "Configurações" },
];

function modulosAtivosResumo(p?: Record<string, boolean> | null): string {
  const flags = flagsFromPermissoes(p);
  const labels = MODULO_LABELS.filter((m) => flags[m.key]).map((m) => m.label);
  return labels.length ? labels.join(" · ") : "Nenhum módulo";
}

function modulosAtivosCount(p?: Record<string, boolean> | null): number {
  const flags = flagsFromPermissoes(p);
  return MODULO_LABELS.filter((m) => flags[m.key]).length;
}

function flagsFromBaseRole(role: string): PermissionFlags {
  const r = role.trim().toLowerCase();
  if (r === "owner" || r === "admin") return { ...ALL_PERMISSIONS_ON };
  if (r === "atendente") {
    return {
      ...ALL_PERMISSIONS_ON,
      pLeads: false,
      pNegocios: false,
      pCadastros: false,
      pAutomacoes: false,
      pConfiguracoes: false,
    };
  }
  if (r === "parceiro") {
    return {
      ...ALL_PERMISSIONS_ON,
      pLeads: false,
      pNegocios: false,
      pAtendimento: false,
      pAutomacoes: false,
      pConfiguracoes: false,
    };
  }
  return {
    pDashboard: true,
    pLeads: true,
    pNegocios: true,
    pAtendimento: true,
    pCadastros: false,
    pAutomacoes: false,
    pConfiguracoes: false,
  };
}

function acaoAuditoriaLabel(acao: string): string {
  const map: Record<string, string> = {
    cargo_criado: "Cargo criado",
    cargo_atualizado: "Cargo atualizado",
    cargo_excluido: "Cargo excluído",
    usuario_atualizado: "Usuário atualizado",
    usuario_excluido: "Usuário excluído",
    usuario_convidado: "Usuário convidado",
    usuario_cadastrado: "Usuário cadastrado",
    usuario_vinculado: "Usuário vinculado",
  };
  return map[acao] ?? acao.replaceAll("_", " ");
}

function permissionFlagsEqual(a: PermissionFlags, b: PermissionFlags): boolean {
  return (
    a.pDashboard === b.pDashboard &&
    a.pLeads === b.pLeads &&
    a.pNegocios === b.pNegocios &&
    a.pAtendimento === b.pAtendimento &&
    a.pCadastros === b.pCadastros &&
    a.pAutomacoes === b.pAutomacoes &&
    a.pConfiguracoes === b.pConfiguracoes
  );
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatShortId(value?: string | null): string {
  if (!value) return "—";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function IdBadge({ value, tone = "blue" }: { value?: string | null; tone?: "blue" | "green" | "gray" }) {
  const color =
    tone === "green"
      ? { bg: "#eefbf1", border: "#cdecd5", text: "#2f7a43" }
      : tone === "gray"
        ? { bg: "#f4f6f8", border: "#dbe1e7", text: "#4e657f" }
        : { bg: "#eef6ff", border: "#cbe1ff", text: "#2e67b1" };
  return (
    <span
      className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
      title={value ?? undefined}
    >
      {formatShortId(value)}
    </span>
  );
}

function TableActionGroup({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-stretch overflow-hidden rounded-lg border border-[#d4ecd0] bg-white shadow-[0_1px_2px_rgba(11,31,16,0.04)]"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      </div>
  );
}

function TableActionBtn({
  onClick,
  title,
  ariaLabel,
  children,
  variant = "default",
  disabled,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: ReactNode;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
}) {
  const tone =
    variant === "danger"
      ? "text-[#c0392b] hover:bg-[#fff2f1]"
      : variant === "primary"
        ? "text-[#3f9848] hover:bg-[#f0f9ee]"
        : "text-[#1e4a24] hover:bg-[#f0f9ee]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center border-l border-[#d4ecd0] first:border-l-0 disabled:cursor-not-allowed disabled:opacity-45 ${tone}`}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
}

export default function ContaPage() {
  const { confirmDialog, setConfirmLoading, closeConfirmDialog } = useCrmConfirm();
  const { success: toastSuccess } = useCrmToast();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [erro, setErro] = useState("");

  const [me, setMe] = useState<MeProfile | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);

  const [nameDraft, setNameDraft] = useState("");
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [userDrawerMode, setUserDrawerMode] = useState<"view" | "edit">("view");
  const [savingUserDrawer, setSavingUserDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [selectedUserStatus, setSelectedUserStatus] = useState("");
  const [selectedUserRole, setSelectedUserRole] = useState("");
  const [selectedUserAccessRole, setSelectedUserAccessRole] = useState("");
  const [userDrawerPerms, setUserDrawerPerms] = useState<PermissionFlags>(ALL_PERMISSIONS_ON);
  const [userDrawerPermsReadOnly, setUserDrawerPermsReadOnly] = useState(true);
  const [contaSectionTab, setContaSectionTab] = useState<"equipe" | "cargos" | "auditoria">("equipe");
  const [auditLogs, setAuditLogs] = useState<AuditoriaLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditWarning, setAuditWarning] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBaseRole, setFilterBaseRole] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterAccessRole, setFilterAccessRole] = useState("todos");
  const [roleForm, setRoleForm] = useState({
    nome: "",
    slug: "",
    descricao: "",
    ativo: true,
    pDashboard: true,
    pLeads: true,
    pNegocios: true,
    pAtendimento: true,
    pCadastros: false,
    pAutomacoes: false,
    pConfiguracoes: false,
  });
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    password: "",
    passwordConfirm: "",
    access_role_id: "",
  });
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [showInvitePasswordConfirm, setShowInvitePasswordConfirm] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<{
    email: string;
    password: string;
    cargoNome: string;
    linked: boolean;
  } | null>(null);
  const [showSuccessPassword, setShowSuccessPassword] = useState(false);

  function resetInviteForm() {
    setInviteForm({
      email: "",
      name: "",
      password: "",
      passwordConfirm: "",
      access_role_id: "",
    });
    setShowInvitePassword(false);
    setShowInvitePasswordConfirm(false);
  }

  function abrirInviteDrawer() {
    setInviteSuccess(null);
    setShowSuccessPassword(false);
    resetInviteForm();
    setInviteDrawerOpen(true);
  }

  function fecharInviteDrawer() {
    setInviteDrawerOpen(false);
    setInviteSuccess(null);
    setShowSuccessPassword(false);
    resetInviteForm();
  }

  const loadPage = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      let foundProfile = false;

      // 1) Fallback robusto: sempre tenta carregar o usuário logado direto do browser client.
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (authUser?.id) {
        const meLocal = await supabase.from("users").select("*").eq("auth_id", authUser.id).maybeSingle();

        if (meLocal.data) {
          const localRow = normalizeUserRow(meLocal.data as Record<string, unknown>) as MeProfile;
          setMe(localRow);
          setNameDraft(localRow.name ?? "");
          foundProfile = true;
        }
      }

      // 2) Enriquecimento por API (team + cargos + perfil canônico)
      const headers = await crmApiHeaders();
      const [meRes, accessRes] = await Promise.all([
        fetch("/api/crm/conta", { headers }),
        fetch("/api/crm/acessos", { headers }),
      ]);

      const meJson = (await meRes.json().catch(() => ({}))) as { data?: MeProfile; error?: string };
      if (meRes.ok && meJson.data) {
        setMe(meJson.data);
        setNameDraft(meJson.data.name ?? "");
        foundProfile = true;
      }

      const accessJson = (await accessRes.json().catch(() => ({}))) as {
        data?: { users?: TenantUser[]; roles?: AccessRole[]; me?: MeProfile | null };
        error?: string;
      };
      if (accessRes.ok) {
        setUsers(accessJson.data?.users ?? []);
        setRoles(accessJson.data?.roles ?? []);
        if (accessJson.data?.me && !foundProfile) {
          setMe(accessJson.data.me);
          setNameDraft(accessJson.data.me.name ?? "");
          foundProfile = true;
        }
      } else if (!foundProfile) {
        setErro(accessJson.error || "Falha ao carregar acessos.");
      }

      // 3) Se ainda não há perfil, mostrar erro explícito
      if (!foundProfile) {
        setMe(null);
        setErro((curr) => curr || "Perfil do usuário logado não encontrado em public.users.");
      }
    } catch {
      setErro("Erro de rede ao carregar conta e acessos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const owner = isOwner(me?.role ?? "");
  const canManageTeam = isCrmAdminRole(me?.role ?? "");
  const canAudit = canManageTeam;

  const loadAuditoria = useCallback(async () => {
    if (!canAudit) return;
    setAuditLoading(true);
    setAuditWarning("");
    try {
      const res = await fetch("/api/crm/acessos/auditoria?limit=200", { headers: await crmApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as {
        data?: AuditoriaLog[];
        error?: string;
        warning?: string;
      };
      if (!res.ok) {
        setAuditLogs([]);
        setErro(json.error || "Falha ao carregar auditoria.");
        return;
      }
      setAuditLogs(json.data ?? []);
      setAuditWarning(json.warning ?? "");
    } catch {
      setAuditLogs([]);
      setErro("Erro de rede ao carregar auditoria.");
    } finally {
      setAuditLoading(false);
    }
  }, [canAudit]);

  useEffect(() => {
    if (contaSectionTab === "auditoria" && canAudit) {
      void loadAuditoria();
    }
  }, [contaSectionTab, canAudit, loadAuditoria]);

  useEffect(() => {
    if (!canAudit && (contaSectionTab === "auditoria" || contaSectionTab === "cargos")) {
      setContaSectionTab("equipe");
    }
  }, [canAudit, contaSectionTab]);

  useEffect(() => {
    if (!userDrawerOpen) return;
    if (selectedUserAccessRole) {
      const role = roles.find((r) => r.id === selectedUserAccessRole);
      setUserDrawerPerms(flagsFromPermissoes(role?.permissoes));
      setUserDrawerPermsReadOnly(!owner || !role);
      return;
    }
    if (isOwner(selectedUserRole)) {
      setUserDrawerPerms({ ...ALL_PERMISSIONS_ON });
      setUserDrawerPermsReadOnly(true);
      return;
    }
    setUserDrawerPerms(flagsFromBaseRole(selectedUserRole));
    setUserDrawerPermsReadOnly(true);
  }, [userDrawerOpen, selectedUserAccessRole, selectedUserRole, roles, owner]);
  const activeUsers = users.filter((u) => String(u.status ?? "").toLowerCase() === "ativo");
  const inactiveUsers = users.filter((u) => String(u.status ?? "").toLowerCase() !== "ativo");
  const rolesActive = roles.filter((r) => r.ativo);
  const roleNameById = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((r) => map.set(r.id, r.nome));
    return map;
  }, [roles]);

  const userCountByRoleId = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u) => {
      if (!u.access_role_id) return;
      map.set(u.access_role_id, (map.get(u.access_role_id) ?? 0) + 1);
    });
    return map;
  }, [users]);

  const filteredCargos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roles
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .filter((r) => {
        if (!q) return true;
        const nome = String(r.nome ?? "").toLowerCase();
        const slug = String(r.slug ?? "").toLowerCase();
        const desc = String(r.descricao ?? "").toLowerCase();
        return nome.includes(q) || slug.includes(q) || desc.includes(q);
      });
  }, [roles, searchQuery]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      const name = String(u.name ?? "").toLowerCase();
      const email = String(u.email ?? "").toLowerCase();
      const status = String(u.status ?? "").toLowerCase();
      const baseRole = String(u.role ?? "").toLowerCase();
      const accessRole = u.access_role_id ?? "";

      if (q && !name.includes(q) && !email.includes(q)) return false;
      if (filterStatus !== "todos" && status !== filterStatus) return false;
      if (filterBaseRole !== "todos" && baseRole !== filterBaseRole) return false;
      if (filterAccessRole === "sem-cargo" && accessRole) return false;
      if (
        filterAccessRole !== "todos" &&
        filterAccessRole !== "sem-cargo" &&
        accessRole !== filterAccessRole
      ) {
        return false;
      }
      return true;
    });
  }, [users, searchQuery, filterStatus, filterBaseRole, filterAccessRole]);

  const colunasEquipe = useMemo((): CrmResizableColumn<TenantUser>[] => {
    return [
      {
        id: "usuario",
        label: "Usuário",
        defaultWidth: 260,
        minWidth: 160,
        render: (u) => (
          <>
            <div className="text-sm font-semibold text-[#0b2210]" title={u.name ?? undefined}>
              {u.name || "—"}
            </div>
            <div className="text-xs text-[#6f86a6]" title={u.email ?? undefined}>
              {u.email || "—"}
            </div>
          </>
        ),
      },
      {
        id: "cargo",
        label: "Cargo",
        defaultWidth: 170,
        minWidth: 120,
        truncate: false,
        render: (u) => {
          const cargoNome = u.access_role_id ? roleNameById.get(u.access_role_id) : null;

          if (!canManageTeam) {
            return cargoNome ? (
              <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-semibold text-[#1e4a24]">
                <Shield size={12} className="shrink-0 text-[#3f9848]" />
                <span className="truncate">{cargoNome}</span>
              </span>
            ) : (
              <span className="text-xs text-[#8aa195]">Sem cargo</span>
            );
          }

          if (cargoNome) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openUserDrawer(u, "edit");
                }}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#d4ecd0] bg-[#f0f9ee] px-3 py-1 text-xs font-semibold text-[#1e4a24] transition-colors hover:bg-[#e4f5df]"
                title="Alterar cargo do usuário"
              >
                <Shield size={12} className="shrink-0 text-[#3f9848]" />
                <span className="truncate">{cargoNome}</span>
              </button>
            );
          }

          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openUserDrawer(u, "edit");
              }}
              className="text-xs font-medium text-[#8aa195] underline-offset-2 transition-colors hover:text-[#1e4a24] hover:underline"
              title="Atribuir cargo ao usuário"
            >
              Atribuir cargo
            </button>
          );
        },
      },
      {
        id: "status",
        label: "Status",
        defaultWidth: 110,
        minWidth: 90,
        truncate: false,
        render: (u) => (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background:
                String(u.status).toLowerCase() === "ativo" ? "rgba(146,255,0,0.12)" : "rgba(0,0,0,0.05)",
              color: String(u.status).toLowerCase() === "ativo" ? "#1e4a24" : "#6b8a76",
              border:
                String(u.status).toLowerCase() === "ativo"
                  ? "1px solid rgba(146,255,0,0.3)"
                  : "1px solid #d9d9d9",
            }}
          >
            {u.status || "—"}
          </span>
        ),
      },
      {
        id: "perfil",
        label: "Perfil Base",
        defaultWidth: 110,
        minWidth: 90,
        render: (u) => <span className="text-sm text-[#1e4a24]">{roleLabel(u.role)}</span>,
      },
      {
        id: "telefone",
        label: "Telefone",
        defaultWidth: 130,
        minWidth: 100,
        render: (u) => <span className="text-sm text-[#4e657f]">{u.phone || "—"}</span>,
      },
      {
        id: "criado",
        label: "Criado em",
        defaultWidth: 150,
        minWidth: 110,
        render: (u) => <span className="text-xs text-[#4e657f]">{formatDateTime(u.created_at)}</span>,
      },
      {
        id: "atualizado",
        label: "Atualizado em",
        defaultWidth: 150,
        minWidth: 110,
        render: (u) => <span className="text-xs text-[#4e657f]">{formatDateTime(u.updated_at)}</span>,
      },
      {
        id: "id",
        label: "ID",
        defaultWidth: 130,
        minWidth: 90,
        render: (u) => <IdBadge value={u.id} tone="blue" />,
      },
      {
        id: "auth_id",
        label: "AUTH_ID",
        defaultWidth: 130,
        minWidth: 90,
        render: (u) => <IdBadge value={u.auth_id} tone="gray" />,
      },
      {
        id: "tenant",
        label: "TENANT_ID",
        defaultWidth: 140,
        minWidth: 100,
        render: (u) => <IdBadge value={u.tenant_id} tone="green" />,
      },
      {
        id: "access_role_id",
        label: "ACCESS_ROLE_ID",
        defaultWidth: 150,
        minWidth: 110,
        render: (u) => <IdBadge value={u.access_role_id} tone="gray" />,
      },
      {
        id: "acoes",
        label: "Ações",
        defaultWidth: 130,
        minWidth: 112,
        truncate: false,
        align: "center",
        render: (u) => (
          <TableActionGroup>
            <TableActionBtn
              onClick={() => openUserDrawer(u, "view")}
              ariaLabel="Ver detalhes"
              title="Ver detalhes"
            >
              <Eye size={15} />
            </TableActionBtn>
            {canManageTeam ? (
              <TableActionBtn
                onClick={() => openUserDrawer(u, "edit")}
                ariaLabel="Editar usuário"
                title="Editar usuário"
                variant="primary"
              >
                <Pencil size={15} />
              </TableActionBtn>
            ) : null}
          </TableActionGroup>
        ),
      },
    ];
  }, [canManageTeam, roleNameById]);

  const colunasCargos = useMemo((): CrmResizableColumn<AccessRole>[] => {
    return [
      {
        id: "cargo",
        label: "Cargo",
        defaultWidth: 260,
        minWidth: 180,
        render: (r) => (
          <>
            <div className="text-sm font-semibold text-[#0b2210]" title={r.nome}>
              {r.nome}
            </div>
            <div className="mt-0.5 line-clamp-2 text-xs text-[#6f86a6]" title={r.descricao ?? undefined}>
              {r.descricao?.trim() || "Sem descrição"}
            </div>
          </>
        ),
      },
      {
        id: "slug",
        label: "Slug",
        defaultWidth: 150,
        minWidth: 110,
        render: (r) => (
          <span className="rounded-md bg-[#f0f9ee] px-2 py-1 font-mono text-xs text-[#1e4a24]">{r.slug}</span>
        ),
      },
      {
        id: "usuarios",
        label: "Usuários",
        defaultWidth: 100,
        minWidth: 80,
        align: "center",
        render: (r) => (
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#eef5ec] px-2 text-xs font-bold text-[#1e4a24]">
            {userCountByRoleId.get(r.id) ?? 0}
          </span>
        ),
      },
      {
        id: "modulos",
        label: "Módulos",
        defaultWidth: 280,
        minWidth: 160,
        render: (r) => (
          <div>
            <span className="text-xs font-semibold text-[#1e4a24]">
              {modulosAtivosCount(r.permissoes)}/{MODULO_LABELS.length} ativos
            </span>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[#6f86a6]" title={modulosAtivosResumo(r.permissoes)}>
              {modulosAtivosResumo(r.permissoes)}
            </p>
          </div>
        ),
      },
      {
        id: "status",
        label: "Status",
        defaultWidth: 110,
        minWidth: 90,
        truncate: false,
        render: (r) => (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: r.ativo ? "rgba(146,255,0,0.12)" : "rgba(0,0,0,0.05)",
              color: r.ativo ? "#1e4a24" : "#6b8a76",
              border: r.ativo ? "1px solid rgba(146,255,0,0.3)" : "1px solid #d9d9d9",
            }}
          >
            {r.ativo ? "Ativo" : "Inativo"}
          </span>
        ),
      },
      {
        id: "acoes",
        label: "Ações",
        defaultWidth: 100,
        minWidth: 88,
        truncate: false,
        align: "center",
        render: (r) => (
          <TableActionGroup>
            <TableActionBtn
              onClick={() => openRoleDrawerForEdit(r.id)}
              ariaLabel="Editar cargo"
              title="Editar cargo"
              variant="primary"
            >
              <Pencil size={15} />
            </TableActionBtn>
            {owner ? (
              <TableActionBtn
                onClick={() => void deleteRole(r.id)}
                ariaLabel="Excluir cargo"
                title="Excluir cargo"
                variant="danger"
                disabled={savingRole}
              >
                <Trash2 size={15} />
              </TableActionBtn>
            ) : null}
          </TableActionGroup>
        ),
      },
    ];
  }, [owner, savingRole, userCountByRoleId]);

  const colunasAuditoria = useMemo((): CrmResizableColumn<AuditoriaLog>[] => {
    return [
      {
        id: "data",
        label: "Data",
        defaultWidth: 160,
        minWidth: 120,
        render: (log) => <span className="text-xs text-[#4e657f]">{formatDateTime(log.criado_em)}</span>,
      },
      {
        id: "quem",
        label: "Quem",
        defaultWidth: 200,
        minWidth: 140,
        render: (log) => (
          <>
            <div className="text-sm font-semibold text-[#0b2210]" title={log.actor_nome ?? undefined}>
              {log.actor_nome || "—"}
            </div>
            <div className="text-xs text-[#6f86a6]" title={log.actor_email ?? undefined}>
              {log.actor_email || "—"}
            </div>
          </>
        ),
      },
      {
        id: "acao",
        label: "Ação",
        defaultWidth: 140,
        minWidth: 100,
        render: (log) => <span className="text-sm text-[#1e4a24]">{acaoAuditoriaLabel(log.acao)}</span>,
      },
      {
        id: "entidade",
        label: "Entidade",
        defaultWidth: 120,
        minWidth: 90,
        render: (log) => <span className="text-xs text-[#4e657f]">{log.entidade}</span>,
      },
      {
        id: "resumo",
        label: "Resumo",
        defaultWidth: 320,
        minWidth: 160,
        render: (log) => <span className="text-sm text-[#0b2210]">{log.resumo}</span>,
      },
      {
        id: "id",
        label: "ID",
        defaultWidth: 120,
        minWidth: 90,
        render: (log) => <IdBadge value={log.entidade_id} tone="gray" />,
      },
    ];
  }, []);

  function exportFilteredCsv() {
    const header = ["nome", "email", "perfil_base", "cargo_acesso", "status"];
    const rows = filteredUsers.map((u) => [
      u.name ?? "",
      u.email ?? "",
      roleLabel(u.role),
      u.access_role_id ? roleNameById.get(u.access_role_id) ?? "—" : "Sem cargo customizado",
      u.status ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usuarios-acessos.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function saveMyName() {
    if (!me) return;
    const name = nameDraft.trim();
    if (!name) {
      setErro("Nome é obrigatório.");
      return;
    }

    setSavingProfile(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/conta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({ name }),
      });
      const json = (await res.json()) as { data?: MeProfile; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Não foi possível salvar o perfil.");
        return;
      }
      setMe(json.data);
      setUsers((prev) =>
        prev.map((u) => (u.auth_id && json.data?.auth_id && u.auth_id === json.data.auth_id ? { ...u, name: json.data.name } : u))
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function copiarCredenciais(
    email: string,
    password: string,
    cargoNome?: string,
  ) {
    if (!email || password.length < 8) {
      setErro("E-mail e senha são necessários para copiar o acesso.");
      return;
    }
    try {
      const text = buildWajeAccessCopyText(email, password, window.location.origin, cargoNome);
      await navigator.clipboard.writeText(text);
      toastSuccess("Credenciais copiadas para a área de transferência.");
    } catch {
      setErro("Não foi possível copiar. Verifique permissões do navegador.");
    }
  }

  async function copiarAcessoUsuario() {
    const cargoNome = rolesActive.find((r) => r.id === inviteForm.access_role_id)?.nome;
    await copiarCredenciais(inviteForm.email.trim(), inviteForm.password, cargoNome);
  }

  async function cadastrarUsuario() {
    if (!canManageTeam) {
      setErro("Apenas administradores podem cadastrar membros.");
      return;
    }
    const email = inviteForm.email.trim().toLowerCase();
    if (!email) {
      setErro("E-mail é obrigatório.");
      return;
    }
    if (inviteForm.password.length < 8) {
      setErro("Senha obrigatória (mínimo 8 caracteres).");
      return;
    }
    if (inviteForm.password !== inviteForm.passwordConfirm) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (!inviteForm.access_role_id) {
      setErro("Selecione um cargo de acesso.");
      return;
    }

    setInviteSaving(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({
          email,
          name: inviteForm.name.trim() || undefined,
          password: inviteForm.password,
          access_role_id: inviteForm.access_role_id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: TenantUser;
        error?: string;
        linked?: boolean;
        share?: { email?: string; cargo_nome?: string };
      };
      if (!res.ok || !json.data) {
        setErro(json.error || "Falha ao cadastrar membro.");
        return;
      }

      const cargoNome =
        json.share?.cargo_nome ??
        rolesActive.find((r) => r.id === inviteForm.access_role_id)?.nome ??
        "";

      setUsers((prev) => {
        const exists = prev.some((u) => u.id === json.data!.id);
        if (exists) {
          return prev.map((u) => (u.id === json.data!.id ? { ...u, ...json.data } : u));
        }
        return [...prev, json.data as TenantUser].sort((a, b) =>
          String(a.name ?? a.email ?? "").localeCompare(String(b.name ?? b.email ?? "")),
        );
      });

      setInviteSuccess({
        email: json.share?.email ?? email,
        password: inviteForm.password,
        cargoNome,
        linked: Boolean(json.linked) || res.status === 200,
      });
      setShowSuccessPassword(false);
      toastSuccess(
        json.linked || res.status === 200
          ? "Membro vinculado. Copie as credenciais abaixo."
          : "Usuário cadastrado. Copie as credenciais abaixo.",
      );
    } finally {
      setInviteSaving(false);
    }
  }

  async function saveNewRole() {
    if (!canManageTeam) {
      setErro("Apenas administradores podem criar cargos.");
      return;
    }
    const nome = roleForm.nome.trim();
    const slug = (roleForm.slug.trim() || nome).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!nome || !slug) {
      setErro("Preencha nome e slug válidos para o cargo.");
      return;
    }

    setSavingRole(true);
    setErro("");
    try {
      const permissoes = permissoesFromFlags(roleForm);

      const isEditing = Boolean(editingRoleId);
      const res = await fetch(isEditing ? `/api/crm/acessos/roles/${editingRoleId}` : "/api/crm/acessos", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({ nome, slug, descricao: roleForm.descricao.trim(), permissoes, ativo: roleForm.ativo }),
      });
      const json = (await res.json()) as { data?: AccessRole; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Falha ao criar cargo.");
        return;
      }

      setRoles((prev) => {
        const incoming = json.data as AccessRole;
        const exists = prev.some((r) => r.id === incoming.id);
        const merged = exists ? prev.map((r) => (r.id === incoming.id ? incoming : r)) : [...prev, incoming];
        return merged.sort((a, b) => a.nome.localeCompare(b.nome));
      });
      setRoleDrawerOpen(false);
      setEditingRoleId(null);
      setRoleForm({
        nome: "",
        slug: "",
        descricao: "",
        ativo: true,
        pDashboard: true,
        pLeads: true,
        pNegocios: true,
        pAtendimento: true,
        pCadastros: false,
        pAutomacoes: false,
        pConfiguracoes: false,
      });
    } finally {
      setSavingRole(false);
    }
  }

  function openRoleDrawerForCreate() {
    setEditingRoleId(null);
    setRoleForm({
      nome: "",
      slug: "",
      descricao: "",
      ativo: true,
      pDashboard: true,
      pLeads: true,
      pNegocios: true,
      pAtendimento: true,
      pCadastros: false,
      pAutomacoes: false,
      pConfiguracoes: false,
    });
    setRoleDrawerOpen(true);
  }

  function openRoleDrawerForEdit(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const p = role.permissoes ?? {};
    setEditingRoleId(role.id);
    setRoleForm({
      nome: role.nome ?? "",
      slug: role.slug ?? "",
      descricao: role.descricao ?? "",
      ativo: Boolean(role.ativo),
      pDashboard: Boolean(p.dashboard),
      pLeads: Boolean(p.leads),
      pNegocios: Boolean(p.negocios),
      pAtendimento: Boolean(p.atendimento),
      pCadastros: Boolean(p.cadastros),
      pAutomacoes: Boolean(p.automacoes),
      pConfiguracoes: Boolean(p.configuracoes),
    });
    setRoleDrawerOpen(true);
  }

  async function deleteRole(roleId: string) {
    if (!owner) {
      setErro("Somente owner pode excluir cargo.");
      return;
    }
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;

    const vinculados = userCountByRoleId.get(roleId) ?? 0;
    const confirmed = await confirmDialog({
      title: "Excluir cargo?",
      variant: "destructive",
      confirmLabel: "Excluir cargo",
      message: (
        <>
          <p style={{ margin: "0 0 10px" }}>
            O cargo <strong style={{ color: "#0b1f10" }}>«{role.nome}»</strong> será removido permanentemente.
          </p>
          {vinculados > 0 ? (
            <p style={{ margin: 0, color: "#b3261e", fontWeight: 600 }}>
              Existem {vinculados} usuário(s) vinculados. Reatribua-os antes de excluir.
            </p>
          ) : (
            <p style={{ margin: 0, color: "#b3261e", fontWeight: 600 }}>Esta operação não pode ser desfeita.</p>
          )}
        </>
      ),
    });
    if (!confirmed) return;

    setSavingRole(true);
    setConfirmLoading(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/acessos/roles/${roleId}`, {
        method: "DELETE",
        headers: await crmApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao excluir cargo.");
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (editingRoleId === roleId) {
        setRoleDrawerOpen(false);
        setEditingRoleId(null);
      }
      toastSuccess("Cargo excluído com sucesso.");
    } finally {
      setConfirmLoading(false);
      closeConfirmDialog();
      setSavingRole(false);
    }
  }

  function syncUserDrawerPerms(accessRoleId: string, baseRole: string) {
    if (accessRoleId) {
      const role = roles.find((r) => r.id === accessRoleId);
      setUserDrawerPerms(flagsFromPermissoes(role?.permissoes));
      setUserDrawerPermsReadOnly(!owner || !role);
      return;
    }
    if (isOwner(baseRole)) {
      setUserDrawerPerms({ ...ALL_PERMISSIONS_ON });
      setUserDrawerPermsReadOnly(true);
      return;
    }
    setUserDrawerPerms(flagsFromBaseRole(baseRole));
    setUserDrawerPermsReadOnly(true);
  }

  function openUserDrawer(user: TenantUser, mode: "view" | "edit" = "view") {
    setSelectedUser(user);
    setSelectedUserName(user.name ?? "");
    setSelectedUserStatus(user.status ?? "Ativo");
    setSelectedUserRole(user.role ?? "vendedor");
    setSelectedUserAccessRole(user.access_role_id ?? "");
    syncUserDrawerPerms(user.access_role_id ?? "", user.role ?? "vendedor");
    setUserDrawerMode(mode);
    setUserDrawerOpen(true);
  }

  function handleUserAccessRoleChange(accessRoleId: string) {
    setSelectedUserAccessRole(accessRoleId);
    syncUserDrawerPerms(accessRoleId, selectedUserRole);
  }

  function handleUserBaseRoleChange(baseRole: string) {
    setSelectedUserRole(baseRole);
    if (!selectedUserAccessRole) {
      syncUserDrawerPerms("", baseRole);
    }
  }

  async function saveUserDrawer() {
    if (!selectedUser) return;
    if (!owner) {
      setErro("Somente owner pode editar usuário.");
      return;
    }
    const name = selectedUserName.trim();
    if (!name) {
      setErro("Nome é obrigatório.");
      return;
    }
    setSavingUserDrawer(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/acessos/usuarios/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({
        name,
          status: selectedUserStatus,
          role: selectedUserRole,
          access_role_id: selectedUserAccessRole || null,
        }),
      });
      const json = (await res.json()) as { data?: TenantUser; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Falha ao salvar usuário.");
        return;
      }

      const accessRoleId = selectedUserAccessRole || null;
      if (accessRoleId && owner && !userDrawerPermsReadOnly) {
        const role = roles.find((r) => r.id === accessRoleId);
        const currentFlags = flagsFromPermissoes(role?.permissoes);
        if (role && !permissionFlagsEqual(currentFlags, userDrawerPerms)) {
          const roleRes = await fetch(`/api/crm/acessos/roles/${accessRoleId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
            body: JSON.stringify({
              nome: role.nome,
              slug: role.slug,
              descricao: role.descricao ?? "",
              ativo: role.ativo,
              permissoes: permissoesFromFlags(userDrawerPerms),
            }),
          });
          const roleJson = (await roleRes.json()) as { data?: AccessRole; error?: string };
          if (!roleRes.ok || !roleJson.data) {
            setErro(roleJson.error || "Usuário salvo, mas falha ao atualizar permissões do cargo.");
          } else {
            setRoles((prev) =>
              prev
                .map((r) => (r.id === accessRoleId ? (roleJson.data as AccessRole) : r))
                .sort((a, b) => a.nome.localeCompare(b.nome)),
            );
          }
        }
      }

      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? json.data! : u)));
      setSelectedUser(json.data);
      setUserDrawerOpen(false);
    } finally {
      setSavingUserDrawer(false);
    }
  }

  async function deleteSelectedUser() {
    if (!selectedUser) return;
    if (!owner) {
      setErro("Somente owner pode excluir usuário.");
      return;
    }

    const nome = selectedUser.name?.trim() || selectedUser.email || "este usuário";
    const confirmed = await confirmDialog({
      title: "Excluir usuário?",
      variant: "destructive",
      confirmLabel: "Excluir definitivamente",
      message: (
        <>
          <p style={{ margin: "0 0 10px" }}>
            O usuário <strong style={{ color: "#0b1f10" }}>«{nome}»</strong> perderá acesso ao CRM e será removido da
            equipe.
          </p>
          <p style={{ margin: 0, color: "#b3261e", fontWeight: 600 }}>Esta operação não pode ser desfeita.</p>
        </>
      ),
    });
    if (!confirmed) return;

    setSavingUserDrawer(true);
    setConfirmLoading(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/acessos/usuarios/${selectedUser.id}`, {
        method: "DELETE",
        headers: await crmApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao excluir usuário.");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setUserDrawerOpen(false);
      setSelectedUser(null);
      toastSuccess("Usuário excluído com sucesso.");
    } finally {
      setConfirmLoading(false);
      closeConfirmDialog();
      setSavingUserDrawer(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#92ff00] border-t-transparent" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex h-72 items-center justify-center px-4">
        <p className="text-sm text-[#5d7a67]">Perfil do usuário logado não encontrado em `public.users`.</p>
      </div>
    );
  }

  const userDrawerReadOnly = userDrawerMode === "view" || !owner;

  return (
    <div className="min-h-full w-full min-w-0 px-3 py-4 sm:px-5 lg:px-6 xl:px-8" style={{ background: "#f8fcf6" }}>
      <div className="w-full min-w-0">
        {erro ? (
          <p className="mb-4 rounded-xl border border-[#f0c0bd] bg-[#fff2f1] px-3 py-2 text-sm text-[#c0392b]">{erro}</p>
        ) : null}

        <CrmMetricsGrid cols={4} className="mb-4">
          <CrmMetricCard
            label="Total de usuários"
            valor={users.length}
            tone="brand"
            sparkline={sparklineFromCounts([activeUsers.length, inactiveUsers.length, users.length])}
          />
          <CrmMetricCard
            label="Ativos"
            valor={activeUsers.length}
            tone="success"
            sparkline={sparklineFromSeed(activeUsers.length + 1)}
          />
          <CrmMetricCard
            label="Inativos"
            valor={inactiveUsers.length}
            tone="muted"
            sparkline={sparklineFromSeed(inactiveUsers.length + 2)}
          />
          <CrmMetricCard
            label="Cargos ativos"
            valor={rolesActive.length}
            tone="success"
            progress={{
              value: rolesActive.length,
              max: Math.max(roles.length, 1),
              hint: `${rolesActive.length} de ${roles.length}`,
            }}
          />
        </CrmMetricsGrid>

        <div className="w-full min-w-0 rounded-2xl border border-[#dcebd8] bg-white shadow-[0_2px_8px_rgba(11,31,16,0.05)]">
          {canAudit ? (
            <ContaSectionTabs
              tabs={[
                { id: "equipe", label: "Equipe e acessos" },
                { id: "cargos", label: `Cargos (${roles.length})` },
                { id: "auditoria", label: "Auditoria do sistema" },
              ]}
              activeId={contaSectionTab}
              onSelect={(id) => {
                setContaSectionTab(id as "equipe" | "cargos" | "auditoria");
                setSearchQuery("");
                setShowAdvancedFilters(false);
              }}
            />
          ) : (
            <div className="flex items-center gap-2 border-b border-[#e7f1e4] px-4 py-3">
              <Users size={16} className="text-[#3f9848]" />
              <h2 className="text-sm font-bold text-[#0b2210]">Equipe, cargos e acessos</h2>
            </div>
          )}

          {contaSectionTab === "equipe" ? (
            <>
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[#eef5ec] px-4 py-2">
            {canManageTeam ? (
              <button
                type="button"
                onClick={() => abrirInviteDrawer()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold"
                style={{ borderColor: "#d4ecd0", color: "#1e4a24", background: "#fff" }}
              >
                <UserPlus size={13} /> Novo usuário
              </button>
            ) : null}
          </div>

          <div className="border-b border-[#eef5ec] px-4 py-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
              <div className="flex h-10 items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
                <Search size={14} className="text-[#6b8a76]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por usuário ou email..."
                  className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((v) => !v)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
                style={{ borderColor: "#d4ecd0", color: "#1e4a24", background: "#fff" }}
              >
                <SlidersHorizontal size={13} />
                Filtros avançados
              </button>
              <button
                type="button"
                onClick={exportFilteredCsv}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
                style={{ borderColor: "#d4ecd0", color: "#1e4a24", background: "#fff" }}
              >
                Exportar
              </button>
            </div>
            {showAdvancedFilters && (
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Perfil Base</span>
                  <select
                    value={filterBaseRole}
                    onChange={(e) => setFilterBaseRole(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                  >
                    <option value="todos">Todos</option>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="atendente">Atendente</option>
                    <option value="parceiro">Parceiro</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Status</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                  >
                    <option value="todos">Todos</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Cargo de Acesso</span>
                  <select
                    value={filterAccessRole}
                    onChange={(e) => setFilterAccessRole(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                  >
                    <option value="todos">Todos</option>
                    <option value="sem-cargo">Sem cargo customizado</option>
                    {rolesActive.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <CrmResizableDataTable
            tableId="crm-conta-equipe"
            columns={colunasEquipe}
            rows={filteredUsers}
            rowKey={(u) => u.id}
            rowCellClassName="px-4 py-3 align-top"
            getRowStyle={(_, idx) => ({ borderTop: idx > 0 ? "1px solid #edf3fb" : "none" })}
          />
          <div className="flex items-center justify-between border-t border-[#edf3fb] px-4 py-3">
            <p className="text-xs text-[#6f86a6]">
              {filteredUsers.length > 0
                ? `Exibindo 1-${filteredUsers.length} de ${users.length} usuários`
                : `Exibindo 0 de ${users.length} usuários`}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: "#d4e3f7", color: "#6a81a3", background: "#fff" }}
                aria-label="Página anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <span
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold"
                style={{ background: "#0f6b4f", color: "#fff" }}
              >
                1
              </span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: "#d4e3f7", color: "#6a81a3", background: "#fff" }}
                aria-label="Próxima página"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
            </>
          ) : contaSectionTab === "cargos" ? (
            <>
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[#eef5ec] px-4 py-2">
            {canManageTeam ? (
              <button
                type="button"
                onClick={() => openRoleDrawerForCreate()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                style={{ background: "#0b1f10", color: "#92ff00" }}
              >
                <Plus size={13} /> Novo cargo
              </button>
            ) : null}
          </div>

          <div className="border-b border-[#eef5ec] px-4 py-3">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
              <Search size={14} className="text-[#6b8a76]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cargo, slug ou descrição..."
                className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
              />
            </div>
          </div>

          {filteredCargos.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Shield className="mx-auto mb-3 h-8 w-8 text-[#3f9848]" />
              <p className="text-sm font-semibold text-[#0b2210]">Nenhum cargo cadastrado</p>
              <p className="mt-1 text-xs text-[#6b8a76]">
                Crie cargos com permissões por módulo e atribua à equipe em Equipe e acessos.
              </p>
              {canManageTeam ? (
                <button
                  type="button"
                  onClick={() => openRoleDrawerForCreate()}
                  className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold"
                  style={{ background: "#0b1f10", color: "#92ff00" }}
                >
                  <Plus size={14} />
                  Criar primeiro cargo
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <CrmResizableDataTable
                tableId="crm-conta-cargos"
                columns={colunasCargos}
                rows={filteredCargos}
                rowKey={(r) => r.id}
                rowCellClassName="px-4 py-3 align-top"
                getRowStyle={(_, idx) => ({ borderTop: idx > 0 ? "1px solid #edf3fb" : "none" })}
                onRowClick={canManageTeam ? (r) => openRoleDrawerForEdit(r.id) : undefined}
              />
              <div className="flex items-center justify-between border-t border-[#edf3fb] px-4 py-3">
                <p className="text-xs text-[#6f86a6]">
                  {filteredCargos.length > 0
                    ? `Exibindo 1-${filteredCargos.length} de ${roles.length} cargos`
                    : `Exibindo 0 de ${roles.length} cargos`}
                </p>
                <p className="text-xs text-[#6b8a76]">Clique numa linha ou use os botões de ação para gerir o cargo</p>
              </div>
            </>
          )}
            </>
          ) : (
            <div className="w-full min-w-0">
              <div className="flex items-center justify-between border-b border-[#eef5ec] px-4 py-3">
                <p className="text-xs text-[#6b8a76]">
                  Registo de alterações em usuários e cargos (owner e admin).
                </p>
                <button
                  type="button"
                  onClick={() => void loadAuditoria()}
                  disabled={auditLoading}
                  className="inline-flex h-9 items-center rounded-xl border border-[#d4ecd0] px-3 text-xs font-semibold text-[#1e4a24] hover:bg-[#f0f9ee] disabled:opacity-60"
                >
                  {auditLoading ? "Atualizando..." : "Atualizar"}
                </button>
              </div>
              {auditWarning ? (
                <p className="mx-4 mt-3 rounded-xl border border-[#f5e6b8] bg-[#fffbf0] px-3 py-2 text-xs text-[#8a6d1d]">
                  {auditWarning}
                </p>
              ) : null}
              <div className="w-full min-w-0 overflow-x-auto">
                <div className="max-h-[min(70vh,calc(100dvh-16rem))] overflow-y-auto">
                  {auditLoading ? (
                    <div className="flex h-40 items-center justify-center">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#92ff00] border-t-transparent" />
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-[#6b8a76]">
                      Nenhum evento registado ainda. Alterações em usuários e cargos passam a aparecer aqui.
                    </p>
                  ) : (
                    <CrmResizableDataTable
                      tableId="crm-conta-auditoria"
                      columns={colunasAuditoria}
                      rows={auditLogs}
                      rowKey={(log) => log.id}
                      rowCellClassName="px-4 py-3 align-top"
                      getRowStyle={(_, idx) => ({ borderTop: idx > 0 ? "1px solid #edf3fb" : "none" })}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      {userDrawerOpen && selectedUser && (
        <div className="fixed inset-0 z-[121] flex justify-end">
          <button
            type="button"
            onClick={() => setUserDrawerOpen(false)}
            className="absolute inset-0"
            style={{ background: RF_OVERLAY }}
            aria-label="Fechar painel do usuário"
          />
          <div
            className="relative flex h-full w-full max-w-[48rem] flex-col"
            style={{
              background: RF_BG_DEEP,
              borderLeft: `1px solid ${RF_BORDER_STRONG}`,
              boxShadow: "-12px 0 32px rgba(0,0,0,0.55)",
            }}
          >
            <div
              className="flex-shrink-0 px-6 py-4"
              style={{ borderBottom: `1px solid ${RF_BORDER}`, background: RF_BG_PANEL }}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold" style={{ color: RF_TEXT_PRIMARY }}>
                  {userDrawerMode === "edit" ? "Editar usuário" : "Detalhes do usuário"}
                </h3>
                <span className="text-xs" style={{ color: RF_TEXT_MUTED }}>
                  ID: {selectedUser.id.slice(0, 8)}...
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span style={RF_LABEL_STYLE}>Nome</span>
                  <input
                    value={selectedUserName}
                    onChange={(e) => setSelectedUserName(e.target.value)}
                    readOnly={userDrawerReadOnly}
                style={{
                      ...RF_INPUT_STYLE,
                      height: 44,
                      borderRadius: 12,
                      fontSize: 14,
                      ...(userDrawerReadOnly ? { opacity: 0.85, color: RF_TEXT_MUTED } : {}),
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span style={RF_LABEL_STYLE}>E-mail</span>
                  <input
                    value={selectedUser.email ?? ""}
                    readOnly
                    style={{
                      ...RF_INPUT_STYLE,
                      height: 44,
                      borderRadius: 12,
                      fontSize: 14,
                      opacity: 0.85,
                      color: RF_TEXT_MUTED,
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span style={RF_LABEL_STYLE}>Perfil base</span>
                  <select
                    value={selectedUserRole}
                    onChange={(e) => handleUserBaseRoleChange(e.target.value)}
                    disabled={userDrawerReadOnly}
                    style={{
                      ...RF_INPUT_STYLE,
                      height: 44,
                      borderRadius: 12,
                      fontSize: 14,
                      cursor: userDrawerReadOnly ? "default" : "pointer",
                      ...(userDrawerReadOnly ? { opacity: 0.85, color: RF_TEXT_MUTED } : {}),
                    }}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="atendente">Atendente</option>
                    <option value="parceiro">Parceiro</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span style={RF_LABEL_STYLE}>Status</span>
                  <select
                    value={selectedUserStatus}
                    onChange={(e) => setSelectedUserStatus(e.target.value)}
                    disabled={userDrawerReadOnly}
                    style={{
                      ...RF_INPUT_STYLE,
                      height: 44,
                      borderRadius: 12,
                      fontSize: 14,
                      cursor: userDrawerReadOnly ? "default" : "pointer",
                      ...(userDrawerReadOnly ? { opacity: 0.85, color: RF_TEXT_MUTED } : {}),
                    }}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Arquivado">Arquivado</option>
                  </select>
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span style={RF_LABEL_STYLE}>Cargo de acesso</span>
                  <select
                    value={selectedUserAccessRole}
                    onChange={(e) => handleUserAccessRoleChange(e.target.value)}
                    disabled={userDrawerReadOnly}
                    style={{
                      ...RF_INPUT_STYLE,
                      height: 44,
                      borderRadius: 12,
                      fontSize: 14,
                      cursor: userDrawerReadOnly ? "default" : "pointer",
                      ...(userDrawerReadOnly ? { opacity: 0.85, color: RF_TEXT_MUTED } : {}),
                    }}
                  >
                    <option value="">Sem cargo customizado</option>
                    {rolesActive.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                      </option>
                    ))}
                  </select>
                  {canManageTeam && !userDrawerReadOnly && !selectedUserAccessRole ? (
                    <button
                      type="button"
                      onClick={() => openRoleDrawerForCreate()}
                      className="mt-2 text-xs font-semibold underline-offset-2 hover:underline"
                      style={{ color: RF_ACCENT }}
                    >
                      + Criar cargo e atribuir a este usuário
                    </button>
                  ) : null}
                </label>
              </div>

              <div className="mt-6 space-y-2">
                <p style={{ ...RF_LABEL_STYLE, marginBottom: 8 }}>Permissões efetivas</p>
                {isOwner(selectedUserRole) && !selectedUserAccessRole ? (
                  <p
                    className="rounded-xl px-3 py-2 text-xs leading-relaxed"
                    style={{
                      border: `1px solid ${RF_BORDER_STRONG}`,
                      background: "rgba(146, 255, 0, 0.08)",
                      color: RF_TEXT_SECONDARY,
                    }}
                  >
                    Perfil <strong style={{ color: RF_ACCENT }}>Owner</strong> tem acesso total ao sistema. Os toggles abaixo mostram o padrão completo (somente leitura).
                    Para restringir módulos, crie um <strong style={{ color: RF_ACCENT }}>cargo de acesso</strong> e atribua a este usuário.
                  </p>
                ) : !selectedUserAccessRole ? (
                  <p
                    className="rounded-xl px-3 py-2 text-xs leading-relaxed"
                    style={{
                      border: `1px solid ${RF_BORDER}`,
                      background: "rgba(6, 13, 8, 0.72)",
                      color: RF_TEXT_SECONDARY,
                    }}
                  >
                    Sem cargo customizado: permissões estimadas pelo perfil base. Selecione um cargo acima para editar módulos com toggles.
                  </p>
                ) : userDrawerPermsReadOnly ? (
                  <p className="text-xs" style={{ color: RF_TEXT_SECONDARY }}>
                    Permissões do cargo <strong style={{ color: RF_ACCENT }}>{roleNameById.get(selectedUserAccessRole) ?? "—"}</strong>.
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: RF_TEXT_SECONDARY }}>
                    Alterações nos toggles atualizam o cargo vinculado e afetam todos os usuários com esse cargo.
                  </p>
                )}

                <div className="mt-2 space-y-2">
                  <PermissionToggleRow
                    icon={LayoutDashboard}
                    title="Dashboard"
                    description="Visão geral de métricas, KPIs e resumo operacional"
                    checked={userDrawerPerms.pDashboard}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pDashboard: v }))}
                    disabled={userDrawerReadOnly || userDrawerPermsReadOnly}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={UserSearch}
                    title="Leads"
                    description="Pipeline de leads e funil comercial"
                    checked={userDrawerPerms.pLeads}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pLeads: v }))}
                    disabled={userDrawerReadOnly || userDrawerPermsReadOnly}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={Briefcase}
                    title="Negócios"
                    description="Negócios, propostas e oportunidades"
                    checked={userDrawerPerms.pNegocios}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pNegocios: v }))}
                    disabled={userDrawerReadOnly || userDrawerPermsReadOnly}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={MessageSquare}
                    title="Atendimento"
                    description="Inbox, WhatsApp e atendimento"
                    checked={userDrawerPerms.pAtendimento}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pAtendimento: v }))}
                    disabled={userDrawerReadOnly || userDrawerPermsReadOnly}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={Zap}
                    title="Automações"
                    description="Fluxos, ciclos e agentes IA"
                    checked={userDrawerPerms.pAutomacoes}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pAutomacoes: v }))}
                    disabled={userDrawerReadOnly || userDrawerPermsReadOnly}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={Settings}
                    title="Configurações"
                    description="Conta, cargos e permissões da equipe"
                    checked={userDrawerPerms.pConfiguracoes}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pConfiguracoes: v }))}
                    disabled={userDrawerReadOnly || userDrawerPermsReadOnly}
                    theme="dark"
                  />
                </div>
              </div>
            </div>

            <div
              className={`flex flex-shrink-0 items-center gap-2 px-6 py-4 ${userDrawerMode === "edit" ? "justify-between" : "justify-end"}`}
              style={rfAsideFooterStyle()}
            >
              {userDrawerMode === "edit" ? (
                <button
                  type="button"
                  onClick={() => void deleteSelectedUser()}
                  disabled={savingUserDrawer || !owner}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold disabled:opacity-60"
                  style={{ borderColor: "rgba(248, 81, 73, 0.45)", color: "#f85149", background: "rgba(248, 81, 73, 0.14)" }}
                >
                  <Trash2 size={14} /> Excluir usuário
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUserDrawerOpen(false)}
                  className="h-10 rounded-xl border px-3 text-sm font-medium"
                  style={{ borderColor: RF_BORDER_STRONG, color: RF_TEXT_SECONDARY, background: "rgba(6, 13, 8, 0.6)" }}
                >
                  Fechar
                </button>
                {userDrawerMode === "edit" ? (
                  <button
                    type="button"
                    onClick={() => void saveUserDrawer()}
                    disabled={savingUserDrawer || !owner}
                    className="h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
                    style={{ background: "#0b1f10", color: "#92ff00" }}
                  >
                    {savingUserDrawer ? "Salvando..." : "Salvar alterações"}
                  </button>
                ) : canManageTeam ? (
                  <button
                    type="button"
                    onClick={() => setUserDrawerMode("edit")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold"
                    style={{ background: "#0b1f10", color: "#92ff00" }}
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                ) : null}
            </div>
          </div>
        </div>
          </div>
        )}

      {inviteDrawerOpen && (
        <div className="fixed inset-0 z-[122] flex justify-end">
          <button
            type="button"
            onClick={() => fecharInviteDrawer()}
            className="absolute inset-0"
            style={{ background: RF_OVERLAY }}
            aria-label="Fechar painel"
          />
          <div
            className="relative flex h-full w-full max-w-[48rem] flex-col"
            style={{
              background: RF_BG_DEEP,
              borderLeft: `1px solid ${RF_BORDER_STRONG}`,
              boxShadow: "-12px 0 32px rgba(0,0,0,0.55)",
            }}
          >
            <div
              className="flex-shrink-0 px-6 py-4"
              style={{ borderBottom: `1px solid ${RF_BORDER}`, background: RF_BG_PANEL }}
            >
              <div className="flex items-center gap-2">
                {inviteSuccess ? (
                  <CheckCircle2 size={16} style={{ color: RF_ACCENT }} />
                ) : (
                  <UserPlus size={16} style={{ color: RF_ACCENT }} />
                )}
                <h3 className="text-base font-bold" style={{ color: RF_TEXT_PRIMARY }}>
                  {inviteSuccess ? "Usuário criado" : "Novo usuário"}
                </h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
                {inviteSuccess ? (
                  <>
                    {inviteSuccess.linked
                      ? "O membro foi vinculado à empresa com o cargo selecionado."
                      : "O usuário foi cadastrado com sucesso."}{" "}
                    Copie as credenciais abaixo e envie de forma segura para a pessoa.
                  </>
                ) : (
                  <>
                    O acesso no Waje é definido pelo <strong style={{ color: RF_ACCENT }}>cargo de acesso</strong>.
                    Cadastre e-mail e senha, copie os dados para enviar à pessoa e escolha o cargo com as permissões
                    desejadas.
                  </>
                )}
              </p>
          </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {inviteSuccess ? (
                <div className="space-y-4">
                  <div
                    className="rounded-xl border px-4 py-3"
                    style={{
                      borderColor: "rgba(146,255,0,0.35)",
                      background: "rgba(146,255,0,0.08)",
                    }}
                  >
                    <p className="text-sm font-semibold" style={{ color: RF_ACCENT }}>
                      Pronto para compartilhar
                    </p>
                    <p className="mt-1 text-xs" style={{ color: RF_TEXT_MUTED }}>
                      Estas credenciais só aparecem agora. Copie antes de fechar este painel.
                    </p>
        </div>

                  <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: RF_BORDER, background: RF_BG_PANEL }}>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RF_TEXT_MUTED }}>
                        URL de acesso
                      </p>
                      <p className="mt-1 break-all text-sm font-medium" style={{ color: RF_TEXT_PRIMARY }}>
                        {`${window.location.origin}/login`}
                      </p>
            </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RF_TEXT_MUTED }}>
                        E-mail
                      </p>
                      <p className="mt-1 break-all text-sm font-medium" style={{ color: RF_TEXT_PRIMARY }}>
                        {inviteSuccess.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RF_TEXT_MUTED }}>
                        Senha
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="flex-1 break-all font-mono text-sm" style={{ color: RF_TEXT_PRIMARY }}>
                          {showSuccessPassword ? inviteSuccess.password : "••••••••••••"}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowSuccessPassword((v) => !v)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ color: RF_TEXT_MUTED, background: "transparent", border: "none", cursor: "pointer" }}
                          aria-label={showSuccessPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showSuccessPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    {inviteSuccess.cargoNome ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RF_TEXT_MUTED }}>
                          Cargo de acesso
                        </p>
                        <p className="mt-1 text-sm font-medium" style={{ color: RF_TEXT_PRIMARY }}>
                          {inviteSuccess.cargoNome}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void copiarCredenciais(
                        inviteSuccess.email,
                        inviteSuccess.password,
                        inviteSuccess.cargoNome,
                      )
                    }
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                    style={{ background: "#0b1f10", color: "#92ff00" }}
                  >
                    <Copy size={16} />
                    Copiar credenciais
                  </button>
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span style={RF_LABEL_STYLE}>E-mail *</span>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    style={{ ...RF_INPUT_STYLE, height: 44, borderRadius: 12, fontSize: 14 }}
                    placeholder="usuario@empresa.com"
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span style={RF_LABEL_STYLE}>Nome</span>
                  <input
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                    style={{ ...RF_INPUT_STYLE, height: 44, borderRadius: 12, fontSize: 14 }}
                    placeholder="Nome completo"
                  />
                </label>

                <label className="space-y-1">
                  <span style={RF_LABEL_STYLE}>Senha *</span>
                  <div className="relative">
                    <input
                      type={showInvitePassword ? "text" : "password"}
                      value={inviteForm.password}
                      onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
                      style={{ ...RF_INPUT_STYLE, height: 44, borderRadius: 12, fontSize: 14, paddingRight: 44 }}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInvitePassword((v) => !v)}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg"
                      style={{ color: RF_TEXT_MUTED, background: "transparent", border: "none", cursor: "pointer" }}
                      aria-label={showInvitePassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showInvitePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label className="space-y-1">
                  <span style={RF_LABEL_STYLE}>Confirmar senha *</span>
                  <div className="relative">
                    <input
                      type={showInvitePasswordConfirm ? "text" : "password"}
                      value={inviteForm.passwordConfirm}
                      onChange={(e) => setInviteForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
                      style={{ ...RF_INPUT_STYLE, height: 44, borderRadius: 12, fontSize: 14, paddingRight: 44 }}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInvitePasswordConfirm((v) => !v)}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg"
                      style={{ color: RF_TEXT_MUTED, background: "transparent", border: "none", cursor: "pointer" }}
                      aria-label={showInvitePasswordConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                    >
                      {showInvitePasswordConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span style={RF_LABEL_STYLE}>Cargo de acesso *</span>
                  <select
                    value={inviteForm.access_role_id}
                    onChange={(e) => setInviteForm((f) => ({ ...f, access_role_id: e.target.value }))}
                    style={{ ...RF_INPUT_STYLE, height: 44, borderRadius: 12, fontSize: 14, cursor: "pointer" }}
                  >
                    <option value="">Selecione um cargo</option>
                    {rolesActive.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                      </option>
                    ))}
                  </select>
                  {rolesActive.length === 0 ? (
                    <p className="mt-1 text-xs" style={{ color: RF_TEXT_MUTED }}>
                      Crie um cargo em <strong style={{ color: RF_ACCENT }}>Novo cargo</strong> antes de cadastrar o
                      usuário.
                    </p>
                  ) : null}
                </label>
          </div>
        )}
            </div>

            <div
              className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 px-6 py-4"
              style={rfAsideFooterStyle()}
            >
              {inviteSuccess ? (
                <>
          <button
            type="button"
                    onClick={() => {
                      setInviteSuccess(null);
                      setShowSuccessPassword(false);
                      resetInviteForm();
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-medium"
                    style={{ borderColor: RF_BORDER_STRONG, color: RF_ACCENT, background: "rgba(6, 13, 8, 0.6)" }}
                  >
                    <UserPlus size={14} />
                    Cadastrar outro
                  </button>
                  <button
                    type="button"
                    onClick={() => fecharInviteDrawer()}
                    className="h-10 rounded-xl px-5 text-sm font-semibold"
                    style={{ background: "#0b1f10", color: "#92ff00" }}
                  >
                    Fechar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void copiarAcessoUsuario()}
                    disabled={!inviteForm.email.trim() || inviteForm.password.length < 8}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-medium disabled:opacity-50"
                    style={{ borderColor: RF_BORDER_STRONG, color: RF_ACCENT, background: "rgba(6, 13, 8, 0.6)" }}
                  >
                    <Copy size={14} />
                    Copiar acesso
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fecharInviteDrawer()}
                      className="h-10 rounded-xl border px-4 text-sm font-medium"
                      style={{ borderColor: RF_BORDER_STRONG, color: RF_TEXT_SECONDARY, background: "rgba(6, 13, 8, 0.6)" }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void cadastrarUsuario()}
                      disabled={
                        inviteSaving ||
                        !inviteForm.email.trim() ||
                        !inviteForm.access_role_id ||
                        inviteForm.password.length < 8 ||
                        inviteForm.password !== inviteForm.passwordConfirm
                      }
                      className="h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
                      style={{ background: "#0b1f10", color: "#92ff00" }}
                    >
                      {inviteSaving ? "Salvando..." : "Cadastrar usuário"}
          </button>
        </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {roleDrawerOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
          <button
            type="button"
            onClick={() => setRoleDrawerOpen(false)}
            className="absolute inset-0"
            style={{ background: RF_OVERLAY }}
            aria-label="Fechar painel"
          />
          <div
            className="relative flex h-full w-full max-w-[48rem] flex-col"
            style={{
              background: RF_BG_DEEP,
              borderLeft: `1px solid ${RF_BORDER_STRONG}`,
              boxShadow: "-12px 0 32px rgba(0,0,0,0.55)",
            }}
          >
            {/* Header fixo */}
            <div
              className="flex-shrink-0 px-6 py-4"
              style={{ borderBottom: `1px solid ${RF_BORDER}`, background: RF_BG_PANEL }}
            >
              <div className="flex items-center gap-2">
                <Shield size={16} style={{ color: RF_ACCENT }} />
                <h3 className="text-base font-bold" style={{ color: RF_TEXT_PRIMARY }}>
                  {editingRoleId ? "Editar cargo de acesso" : "Novo cargo de acesso"}
                </h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
                {editingRoleId ? (
                  <>
                    {userCountByRoleId.get(editingRoleId) ?? 0} usuário(s) vinculado(s). Alterações nas permissões
                    afetam todos os membros com este cargo.
                  </>
                ) : (
                  <>Defina nome, módulos e status. Depois atribua o cargo aos usuários em Equipe e acessos.</>
                )}
              </p>
            </div>

            {/* Conteúdo com scroll */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              <label className="space-y-1">
                <span style={RF_LABEL_STYLE}>Nome</span>
                <input
                  value={roleForm.nome}
                  onChange={(e) => setRoleForm((s) => ({ ...s, nome: e.target.value }))}
                  style={{ ...RF_INPUT_STYLE, height: 44, borderRadius: 12, fontSize: 14 }}
                  placeholder="Ex: Comercial SDR"
                />
              </label>

              <label className="space-y-1">
                <span style={RF_LABEL_STYLE}>Slug</span>
                <input
                  value={roleForm.slug}
                  onChange={(e) => setRoleForm((s) => ({ ...s, slug: e.target.value }))}
                  style={{ ...RF_INPUT_STYLE, height: 44, borderRadius: 12, fontSize: 14 }}
                  placeholder="comercial-sdr"
                />
              </label>

              <label className="space-y-1">
                <span style={RF_LABEL_STYLE}>Descrição</span>
                <textarea
                  value={roleForm.descricao}
                  onChange={(e) => setRoleForm((s) => ({ ...s, descricao: e.target.value }))}
                  style={{ ...RF_INPUT_STYLE, minHeight: 96, borderRadius: 12, fontSize: 14, resize: "vertical" }}
                  placeholder="Resumo das responsabilidades deste cargo"
                />
              </label>

              <div className="space-y-2">
                <p className="mb-3" style={RF_LABEL_STYLE}>
                  Permissões do cargo
                </p>
                <p className="text-xs leading-relaxed" style={{ color: RF_TEXT_SECONDARY }}>
                  Defina os módulos que este cargo pode acessar. O status de cada bloco mostra imediatamente se o acesso está ativo ou inativo.
                </p>

                {/* Status geral do cargo */}
                <PermissionToggleRow
                  icon={Shield}
                  title="Cargo ativo"
                  description="Habilita este cargo para ser atribuído a usuários da equipe"
                  checked={Boolean(roleForm.ativo)}
                  onChange={(v) => setRoleForm((s) => ({ ...s, ativo: v }))}
                  variant="status"
                  theme="dark"
                />

                {/* Permissões individuais */}
                <div className="mt-3 space-y-2">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: RF_TEXT_MUTED }}>
                    Módulos disponíveis
                  </p>
                  <PermissionToggleRow
                    icon={LayoutDashboard}
                    title="Dashboard"
                    description="Visão geral de métricas, KPIs e resumo operacional do dia"
                    checked={Boolean(roleForm.pDashboard)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pDashboard: v }))}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={UserSearch}
                    title="Leads"
                    description="Pipeline de leads, qualificações e estágios de funil"
                    checked={Boolean(roleForm.pLeads)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pLeads: v }))}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={Briefcase}
                    title="Negócios"
                    description="Gestão de negócios, propostas e oportunidades comerciais"
                    checked={Boolean(roleForm.pNegocios)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pNegocios: v }))}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={MessageSquare}
                    title="Atendimento"
                    description="Inbox de conversas, WhatsApp e atendimento ao cliente"
                    checked={Boolean(roleForm.pAtendimento)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pAtendimento: v }))}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={Zap}
                    title="Automações"
                    description="Fluxos automáticos, ciclos e agentes IA"
                    checked={Boolean(roleForm.pAutomacoes)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pAutomacoes: v }))}
                    theme="dark"
                  />
                  <PermissionToggleRow
                    icon={Settings}
                    title="Configurações"
                    description="Configurações da conta, cargos e permissões de equipe"
                    checked={Boolean(roleForm.pConfiguracoes)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pConfiguracoes: v }))}
                    theme="dark"
                  />
                </div>
              </div>
            </div>
            </div>

            {/* Footer fixo */}
            <div className="flex flex-shrink-0 items-center justify-end gap-2 px-6 py-4" style={rfAsideFooterStyle()}>
              <button
                type="button"
                onClick={() => setRoleDrawerOpen(false)}
                className="h-10 rounded-xl border px-4 text-sm font-medium"
                style={{ borderColor: RF_BORDER_STRONG, color: RF_TEXT_SECONDARY, background: "rgba(6, 13, 8, 0.6)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveNewRole()}
                disabled={savingRole || !roleForm.nome.trim()}
                className="h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
                style={{ background: "#0b1f10", color: "#92ff00" }}
              >
                {savingRole ? "Salvando..." : editingRoleId ? "Salvar cargo" : "Criar cargo"}
          </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

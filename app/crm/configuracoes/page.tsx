"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Trash2,
  Users,
  UserSearch,
  Zap,
} from "lucide-react";
import { ContaSectionTabs } from "@/components/crm/ContaSectionTabs";
import { PermissionToggleRow } from "@/components/crm/PermissionToggleRow";
import { isCrmAdminRole } from "@/lib/crm-nav-groups";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { normalizeUserRow } from "@/lib/crm/users-row";
import { supabase } from "@/lib/supabase/client";

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

function MetricCard({ title, value, subValue }: { title: string; value: string; subValue?: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: "#fff", border: "1px solid #dcebd8", boxShadow: "0 2px 6px rgba(11,31,16,0.04)" }}
    >
      <p className="text-[11px] font-semibold tracking-wide" style={{ color: "#7f978a" }}>{title}</p>
      <p className="mt-1 text-[38px] font-black leading-none" style={{ color: "#0b2210" }}>{value}</p>
      {subValue ? <p className="mt-1 text-xs" style={{ color: "#5d7a67" }}>{subValue}</p> : null}
    </div>
  );
}

export default function ContaPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [erro, setErro] = useState("");

  const [me, setMe] = useState<MeProfile | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);

  const [nameDraft, setNameDraft] = useState("");
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [savingUserDrawer, setSavingUserDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [selectedUserStatus, setSelectedUserStatus] = useState("");
  const [selectedUserRole, setSelectedUserRole] = useState("");
  const [selectedUserAccessRole, setSelectedUserAccessRole] = useState("");
  const [userDrawerPerms, setUserDrawerPerms] = useState<PermissionFlags>(ALL_PERMISSIONS_ON);
  const [userDrawerPermsReadOnly, setUserDrawerPermsReadOnly] = useState(true);
  const [contaSectionTab, setContaSectionTab] = useState<"equipe" | "auditoria">("equipe");
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
  const canAudit = isCrmAdminRole(me?.role ?? "");

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
    if (!canAudit && contaSectionTab === "auditoria") {
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

  async function saveNewRole() {
    if (!owner) {
      setErro("Somente owner pode criar cargos.");
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

  async function updateUserAccess(userId: string, accessRoleId: string | null) {
    if (!owner) {
      setErro("Somente owner pode alterar acessos.");
      return;
    }
    setSavingUserId(userId);
    setErro("");
    try {
      const res = await fetch(`/api/crm/acessos/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({ access_role_id: accessRoleId }),
      });
      const json = (await res.json()) as { data?: TenantUser; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Falha ao atualizar acesso do usuário.");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, access_role_id: json.data?.access_role_id ?? null } : u)));
    } finally {
      setSavingUserId(null);
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

  function openUserDrawer(user: TenantUser) {
    setSelectedUser(user);
    setSelectedUserName(user.name ?? "");
    setSelectedUserStatus(user.status ?? "Ativo");
    setSelectedUserRole(user.role ?? "vendedor");
    setSelectedUserAccessRole(user.access_role_id ?? "");
    syncUserDrawerPerms(user.access_role_id ?? "", user.role ?? "vendedor");
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
    const confirmed = typeof window !== "undefined" ? window.confirm("Tem certeza que deseja excluir este usuário?") : false;
    if (!confirmed) return;

    setSavingUserDrawer(true);
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
    } finally {
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

  return (
    <div className="min-h-full w-full min-w-0 px-3 py-4 sm:px-5 lg:px-6 xl:px-8" style={{ background: "#f8fcf6" }}>
      <div className="w-full min-w-0">
        {erro ? (
          <p className="mb-4 rounded-xl border border-[#f0c0bd] bg-[#fff2f1] px-3 py-2 text-sm text-[#c0392b]">{erro}</p>
        ) : null}

        <div className="mb-4 grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard title="Total de usuários" value={String(users.length)} />
          <MetricCard title="Ativos" value={String(activeUsers.length)} />
          <MetricCard title="Inativos" value={String(inactiveUsers.length)} />
          <MetricCard title="Cargos ativos" value={String(rolesActive.length)} />
        </div>

        <div className="w-full min-w-0 rounded-2xl border border-[#dcebd8] bg-white shadow-[0_2px_8px_rgba(11,31,16,0.05)]">
          {canAudit ? (
            <ContaSectionTabs
              tabs={[
                { id: "equipe", label: "Equipe e acessos" },
                { id: "auditoria", label: "Auditoria do sistema" },
              ]}
              activeId={contaSectionTab}
              onSelect={(id) => setContaSectionTab(id as "equipe" | "auditoria")}
            />
          ) : (
            <div className="flex items-center gap-2 border-b border-[#e7f1e4] px-4 py-3">
              <Users size={16} className="text-[#3f9848]" />
              <h2 className="text-sm font-bold text-[#0b2210]">Equipe, cargos e acessos</h2>
            </div>
          )}

          {contaSectionTab === "equipe" ? (
            <>
          <div className="flex items-center justify-end border-b border-[#eef5ec] px-4 py-2">
            {owner ? (
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

          {/* toolbar no padrão da tabela pipeline */}
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

          <div className="w-full min-w-0 overflow-x-auto">
            <div className="max-h-[min(70vh,calc(100dvh-16rem))] overflow-y-auto">
              <table className="w-full min-w-[1600px] table-fixed text-left">
              <thead className="bg-[#f7fbff]">
                <tr>
                  <th className="w-[130px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">ID</th>
                  <th className="w-[130px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">AUTH_ID</th>
                  <th className="w-[min(22%,320px)] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Usuário</th>
                  <th className="w-[130px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Telefone</th>
                  <th className="w-[120px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Perfil Base</th>
                  <th className="w-[150px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Criado em</th>
                  <th className="w-[150px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Atualizado em</th>
                  <th className="w-[140px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">TENANT_ID</th>
                  <th className="w-[min(18%,280px)] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Cargo de Acesso</th>
                  <th className="w-[150px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">ACCESS_ROLE_ID</th>
                  <th className="w-[120px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Status</th>
                  <th className="w-[90px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, idx) => (
                  <tr key={u.id} style={{ borderTop: idx > 0 ? "1px solid #edf3fb" : "none" }}>
                    <td className="px-4 py-4 align-top">
                      <IdBadge value={u.id} tone="blue" />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <IdBadge value={u.auth_id} tone="gray" />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="truncate text-sm font-semibold text-[#0b2210]" title={u.name ?? undefined}>{u.name || "—"}</div>
                      <div className="truncate text-xs text-[#6f86a6]" title={u.email ?? undefined}>{u.email || "—"}</div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-[#4e657f]">{u.phone || "—"}</td>
                    <td className="px-4 py-4 align-top text-sm text-[#1e4a24]">{roleLabel(u.role)}</td>
                    <td className="px-4 py-4 align-top text-xs text-[#4e657f]">{formatDateTime(u.created_at)}</td>
                    <td className="px-4 py-4 align-top text-xs text-[#4e657f]">{formatDateTime(u.updated_at)}</td>
                    <td className="px-4 py-4 align-top">
                      <IdBadge value={u.tenant_id} tone="green" />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <select
                          value={u.access_role_id || ""}
                          disabled={!owner || savingUserId === u.id}
                          onChange={(e) => {
                            const newRoleId = e.target.value || null;
                            void updateUserAccess(u.id, newRoleId);
                          }}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-[#d4ecd0] bg-[#f0f9ee] px-2 text-xs font-medium text-[#1e4a24] disabled:opacity-60"
                        >
                          <option value="">Sem cargo customizado</option>
                          {rolesActive.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nome}
                            </option>
                          ))}
                        </select>
                        {owner && u.access_role_id ? (
                          <button
                            type="button"
                            onClick={() => openRoleDrawerForEdit(u.access_role_id!)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d4ecd0] bg-white text-[#3f9848] hover:bg-[#f0f9ee]"
                            aria-label="Editar permissões do cargo"
                            title="Editar permissões do cargo"
                          >
                            <Shield size={14} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <IdBadge value={u.access_role_id} tone="gray" />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                          background: String(u.status).toLowerCase() === "ativo" ? "rgba(146,255,0,0.12)" : "rgba(0,0,0,0.05)",
                          color: String(u.status).toLowerCase() === "ativo" ? "#1e4a24" : "#6b8a76",
                          border: String(u.status).toLowerCase() === "ativo" ? "1px solid rgba(146,255,0,0.3)" : "1px solid #d9d9d9",
                        }}
                      >
                        {u.status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <button
                        type="button"
                        onClick={() => openUserDrawer(u)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d4ecd0] bg-white text-[#1e4a24] transition-colors hover:bg-[#f0f9ee]"
                        aria-label="Ver usuário"
                        title="Ver usuário"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            </div>

          {/* footer/paginação visual no padrão tabela de pipeline */}
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
                    <table className="w-full min-w-[1100px] table-fixed text-left">
                      <thead className="bg-[#f7fbff] sticky top-0 z-10">
                        <tr>
                          <th className="w-[160px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Data</th>
                          <th className="w-[200px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Quem</th>
                          <th className="w-[140px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Ação</th>
                          <th className="w-[120px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Entidade</th>
                          <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">Resumo</th>
                          <th className="w-[120px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#61789b]">ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log, idx) => (
                          <tr key={log.id} style={{ borderTop: idx > 0 ? "1px solid #edf3fb" : "none" }}>
                            <td className="px-4 py-3 align-top text-xs text-[#4e657f]">{formatDateTime(log.criado_em)}</td>
                            <td className="px-4 py-3 align-top">
                              <div className="truncate text-sm font-semibold text-[#0b2210]" title={log.actor_nome ?? undefined}>
                                {log.actor_nome || "—"}
                              </div>
                              <div className="truncate text-xs text-[#6f86a6]" title={log.actor_email ?? undefined}>
                                {log.actor_email || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-sm text-[#1e4a24]">{acaoAuditoriaLabel(log.acao)}</td>
                            <td className="px-4 py-3 align-top text-xs text-[#4e657f]">{log.entidade}</td>
                            <td className="px-4 py-3 align-top text-sm text-[#0b2210]">{log.resumo}</td>
                            <td className="px-4 py-3 align-top">
                              <IdBadge value={log.entidade_id} tone="gray" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
            style={{ background: "rgba(11,31,16,0.32)" }}
            aria-label="Fechar painel do usuário"
          />
          <div className="relative flex h-full w-full max-w-[48rem] flex-col border-l border-[#dcebd8] bg-white shadow-[-10px_0_40px_rgba(11,31,16,0.15)]">
            <div className="flex-shrink-0 border-b border-[#e7f1e4] px-6 py-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-[#0b2210]">Detalhes do usuário</h3>
                <span className="text-xs text-[#6f86a6]">ID: {selectedUser.id.slice(0, 8)}...</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#89a095]">Nome</span>
                  <input
                    value={selectedUserName}
                    onChange={(e) => setSelectedUserName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d4ecd0] px-3 text-sm text-[#0b2210] outline-none focus:ring-2 focus:ring-[#92ff00]/30"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#89a095]">E-mail</span>
                  <input
                    value={selectedUser.email ?? ""}
                    readOnly
                    className="h-11 w-full rounded-xl border border-[#e3eee0] bg-[#f8fdf6] px-3 text-sm text-[#567564] outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#89a095]">Perfil base</span>
                  <select
                    value={selectedUserRole}
                    onChange={(e) => handleUserBaseRoleChange(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="atendente">Atendente</option>
                    <option value="parceiro">Parceiro</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#89a095]">Status</span>
                  <select
                    value={selectedUserStatus}
                    onChange={(e) => setSelectedUserStatus(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Arquivado">Arquivado</option>
                  </select>
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#89a095]">Cargo de acesso</span>
                  <select
                    value={selectedUserAccessRole}
                    onChange={(e) => handleUserAccessRoleChange(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                  >
                    <option value="">Sem cargo customizado</option>
                    {rolesActive.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                      </option>
                    ))}
                  </select>
                  {owner && !selectedUserAccessRole ? (
                    <button
                      type="button"
                      onClick={() => openRoleDrawerForCreate()}
                      className="mt-2 text-xs font-semibold text-[#3f9848] underline-offset-2 hover:underline"
                    >
                      + Criar cargo e atribuir a este usuário
                    </button>
                  ) : null}
                </label>
              </div>

              <div className="mt-6 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#89a095]">Permissões efetivas</p>
                {isOwner(selectedUserRole) && !selectedUserAccessRole ? (
                  <p className="rounded-xl border border-[#dcebd8] bg-[#f0f9ee] px-3 py-2 text-xs leading-relaxed text-[#3d6b4f]">
                    Perfil <strong>Owner</strong> tem acesso total ao sistema. Os toggles abaixo mostram o padrão completo (somente leitura).
                    Para restringir módulos, crie um <strong>cargo de acesso</strong> e atribua a este usuário.
                  </p>
                ) : !selectedUserAccessRole ? (
                  <p className="rounded-xl border border-[#dcebd8] bg-[#fafcfa] px-3 py-2 text-xs leading-relaxed text-[#6b8a76]">
                    Sem cargo customizado: permissões estimadas pelo perfil base. Selecione um cargo acima para editar módulos com toggles.
                  </p>
                ) : userDrawerPermsReadOnly ? (
                  <p className="text-xs text-[#6b8a76]">
                    Permissões do cargo <strong>{roleNameById.get(selectedUserAccessRole) ?? "—"}</strong>.
                  </p>
                ) : (
                  <p className="text-xs text-[#6b8a76]">
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
                    disabled={userDrawerPermsReadOnly}
                  />
                  <PermissionToggleRow
                    icon={UserSearch}
                    title="Leads"
                    description="Pipeline de leads e funil comercial"
                    checked={userDrawerPerms.pLeads}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pLeads: v }))}
                    disabled={userDrawerPermsReadOnly}
                  />
                  <PermissionToggleRow
                    icon={Briefcase}
                    title="Negócios"
                    description="Negócios, propostas e oportunidades"
                    checked={userDrawerPerms.pNegocios}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pNegocios: v }))}
                    disabled={userDrawerPermsReadOnly}
                  />
                  <PermissionToggleRow
                    icon={MessageSquare}
                    title="Atendimento"
                    description="Inbox, WhatsApp e atendimento"
                    checked={userDrawerPerms.pAtendimento}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pAtendimento: v }))}
                    disabled={userDrawerPermsReadOnly}
                  />
                  <PermissionToggleRow
                    icon={Users}
                    title="Cadastros"
                    description="Pessoas, empresas e parceiros"
                    checked={userDrawerPerms.pCadastros}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pCadastros: v }))}
                    disabled={userDrawerPermsReadOnly}
                  />
                  <PermissionToggleRow
                    icon={Zap}
                    title="Automações"
                    description="Fluxos, ciclos e agentes IA"
                    checked={userDrawerPerms.pAutomacoes}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pAutomacoes: v }))}
                    disabled={userDrawerPermsReadOnly}
                  />
                  <PermissionToggleRow
                    icon={Settings}
                    title="Configurações"
                    description="Conta, cargos e permissões da equipe"
                    checked={userDrawerPerms.pConfiguracoes}
                    onChange={(v) => setUserDrawerPerms((s) => ({ ...s, pConfiguracoes: v }))}
                    disabled={userDrawerPermsReadOnly}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-[#e7f1e4] px-6 py-4">
              <button
                type="button"
                onClick={() => void deleteSelectedUser()}
                disabled={savingUserDrawer || !owner}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: "#f0c0bd", color: "#c0392b", background: "#fff2f1" }}
              >
                <Trash2 size={14} /> Excluir usuário
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUserDrawerOpen(false)}
                  className="h-10 rounded-xl border border-[#d4ecd0] px-3 text-sm font-medium text-[#3d6b4f]"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => void saveUserDrawer()}
                  disabled={savingUserDrawer || !owner}
                  className="h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
                  style={{ background: "#0b1f10", color: "#92ff00" }}
                >
                  {savingUserDrawer ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
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
            style={{ background: "rgba(11,31,16,0.32)" }}
            aria-label="Fechar painel"
          />
          <div className="relative flex h-full w-full max-w-[48rem] flex-col border-l border-[#dcebd8] bg-white shadow-[-10px_0_40px_rgba(11,31,16,0.15)]">
            {/* Header fixo */}
            <div className="flex-shrink-0 border-b border-[#e7f1e4] px-6 py-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#3f9848]" />
                <h3 className="text-base font-bold text-[#0b2210]">{editingRoleId ? "Editar cargo de acesso" : "Novo cargo de acesso"}</h3>
              </div>
            </div>

            {/* Conteúdo com scroll */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#89a095]">Nome</span>
                <input
                  value={roleForm.nome}
                  onChange={(e) => setRoleForm((s) => ({ ...s, nome: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#d4ecd0] px-3 text-sm text-[#0b2210] outline-none focus:ring-2 focus:ring-[#92ff00]/30"
                  placeholder="Ex: Comercial SDR"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#89a095]">Slug</span>
                <input
                  value={roleForm.slug}
                  onChange={(e) => setRoleForm((s) => ({ ...s, slug: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#d4ecd0] px-3 text-sm text-[#0b2210] outline-none focus:ring-2 focus:ring-[#92ff00]/30"
                  placeholder="comercial-sdr"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#89a095]">Descrição</span>
                <textarea
                  value={roleForm.descricao}
                  onChange={(e) => setRoleForm((s) => ({ ...s, descricao: e.target.value }))}
                  className="min-h-24 w-full rounded-xl border border-[#d4ecd0] px-3 py-2 text-sm text-[#0b2210] outline-none focus:ring-2 focus:ring-[#92ff00]/30"
                  placeholder="Resumo das responsabilidades deste cargo"
                />
              </label>

              <div className="space-y-2">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#89a095" }}>
                  Permissões do cargo
                </p>
                <p className="text-xs leading-relaxed text-[#6b8a76]">
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
                />

                {/* Permissões individuais */}
                <div className="mt-3 space-y-2">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#96a89e" }}>Módulos disponíveis</p>
                  <PermissionToggleRow
                    icon={LayoutDashboard}
                    title="Dashboard"
                    description="Visão geral de métricas, KPIs e resumo operacional do dia"
                    checked={Boolean(roleForm.pDashboard)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pDashboard: v }))}
                  />
                  <PermissionToggleRow
                    icon={UserSearch}
                    title="Leads"
                    description="Pipeline de leads, qualificações e estágios de funil"
                    checked={Boolean(roleForm.pLeads)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pLeads: v }))}
                  />
                  <PermissionToggleRow
                    icon={Briefcase}
                    title="Negócios"
                    description="Gestão de negócios, propostas e oportunidades comerciais"
                    checked={Boolean(roleForm.pNegocios)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pNegocios: v }))}
                  />
                  <PermissionToggleRow
                    icon={MessageSquare}
                    title="Atendimento"
                    description="Inbox de conversas, WhatsApp e atendimento ao cliente"
                    checked={Boolean(roleForm.pAtendimento)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pAtendimento: v }))}
                  />
                  <PermissionToggleRow
                    icon={Users}
                    title="Cadastros"
                    description="Cadastro de pessoas, empresas e parceiros"
                    checked={Boolean(roleForm.pCadastros)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pCadastros: v }))}
                  />
                  <PermissionToggleRow
                    icon={Zap}
                    title="Automações"
                    description="Fluxos automáticos, ciclos e agentes IA"
                    checked={Boolean(roleForm.pAutomacoes)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pAutomacoes: v }))}
                  />
                  <PermissionToggleRow
                    icon={Settings}
                    title="Configurações"
                    description="Configurações da conta, cargos e permissões de equipe"
                    checked={Boolean(roleForm.pConfiguracoes)}
                    onChange={(v) => setRoleForm((s) => ({ ...s, pConfiguracoes: v }))}
                  />
                </div>
              </div>
            </div>
            </div>

            {/* Footer fixo */}
            <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[#e7f1e4] px-6 py-4">
              <button
                type="button"
                onClick={() => setRoleDrawerOpen(false)}
                className="h-10 rounded-xl border border-[#d4ecd0] px-4 text-sm font-medium text-[#3d6b4f]"
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

"use client";

import type { MouseEvent } from "react";
import { useCallback, useMemo } from "react";
import { Download, Pencil, RefreshCw, Search } from "lucide-react";
import {
  CrmResizableDataTable,
  type CrmResizableColumn,
} from "@/components/crm/CrmResizableDataTable";
import { CrmIconButtonGroup } from "@/components/crm/CrmIconButtonGroup";
import { OpsStatusBadge } from "@/components/ops/OpsStatusBadge";
import type { AgenteRow } from "@/components/crm/waje/WajeOwnerAgenteSideover";
import type { LeadInteresseRow } from "@/components/crm/waje/WajeOwnerLeadSideover";
import type { PagamentoRow } from "@/components/crm/waje/WajeOwnerPagamentoSideover";
import type { TenantRow } from "@/components/crm/waje/WajeOwnerTenantSideover";
import type { UsuarioRow } from "@/components/crm/waje/WajeOwnerUsuarioSideover";
import type { WajeOwnerTab } from "@/components/crm/waje/waje-owner-theme";

type Props = {
  tab: WajeOwnerTab;
  tenants: TenantRow[];
  agentes: AgenteRow[];
  pagamentos: PagamentoRow[];
  usuarios: UsuarioRow[];
  leads: LeadInteresseRow[];
  search: string;
  onSearchChange: (v: string) => void;
  filtroTenant: "todos" | "ativos" | "inativos";
  onFiltroTenantChange: (v: "todos" | "ativos" | "inativos") => void;
  loading: boolean;
  onRefresh: () => void;
  schemaPagamentos: boolean;
  schemaLeads: boolean;
  onGerirTenant?: (row: TenantRow) => void;
  onGerirUsuario?: (row: UsuarioRow) => void;
  onGerirLead?: (row: LeadInteresseRow) => void;
};

function stopRowClick(e: MouseEvent) {
  e.stopPropagation();
}

function formatarData(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("pt-BR");
  } catch {
    return v;
  }
}

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusPagamento(s: string): "pendente" | "pago" | "atrasado" | "inativo" | "neutral" {
  const x = s.toLowerCase();
  if (x === "pago") return "pago";
  if (x === "atrasado") return "atrasado";
  if (x === "cancelado") return "inativo";
  if (x === "pendente") return "pendente";
  return "neutral";
}

function trialLabel(trialAte: string | null | undefined) {
  if (!trialAte) return "—";
  const end = new Date(trialAte).getTime();
  if (end > Date.now()) return formatarData(trialAte);
  return "Expirado";
}

/** Altura máxima da área com scroll vertical nas tabelas Owner. */
const TABLE_SCROLL_MAX = "min(52vh, 460px)";

export function WajeOwnerTabela({
  tab,
  tenants,
  agentes,
  pagamentos,
  usuarios,
  leads,
  search,
  onSearchChange,
  filtroTenant,
  onFiltroTenantChange,
  loading,
  onRefresh,
  schemaPagamentos,
  schemaLeads,
  onGerirTenant,
  onGerirUsuario,
  onGerirLead,
}: Props) {
  const tenantsFiltrados = useMemo(() => {
    let list = tenants;
    if (filtroTenant === "ativos") list = list.filter((t) => t.ativo);
    if (filtroTenant === "inativos") list = list.filter((t) => !t.ativo);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.nome.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.cnpj ?? "").includes(q),
    );
  }, [tenants, filtroTenant, search]);

  const agentesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agentes;
    return agentes.filter(
      (a) =>
        a.nome.toLowerCase().includes(q) ||
        a.agente_slug.toLowerCase().includes(q) ||
        (a.tenant_nome ?? "").toLowerCase().includes(q),
    );
  }, [agentes, search]);

  const pagamentosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pagamentos;
    return pagamentos.filter((p) => (p.tenant_nome ?? "").toLowerCase().includes(q));
  }, [pagamentos, search]);

  const usuariosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.tenant_nome ?? "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [usuarios, search]);

  const leadsFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.nome.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.empresa ?? "").toLowerCase().includes(q) ||
        (l.interesse_principal ?? "").toLowerCase().includes(q),
    );
  }, [leads, search]);

  const urlBoleto = useCallback((p: PagamentoRow) => {
    return p.boleto_arquivo_url?.trim() || p.cora_boleto_url?.trim() || null;
  }, []);

  const semEmissaoCount = useMemo(
    () => pagamentos.filter((p) => p.status !== "pago" && !p.cora_invoice_id).length,
    [pagamentos],
  );

  const acoesCol = useCallback(
    function acoesCol<T>(onClick: (row: T) => void, label: string) {
      return {
        id: "acoes",
        label: "Ações",
        defaultWidth: 44,
        minWidth: 44,
        maxWidth: 52,
        align: "center" as const,
        truncate: false as const,
        headerClassName: "px-2",
        cellClassName: "px-2",
        render: (r: T) => (
          <div className="flex justify-center" onClick={stopRowClick} role="presentation">
            <CrmIconButtonGroup
              aria-label={label}
              items={[
                {
                  key: "gerir",
                  variant: "outline" as const,
                  icon: <Pencil size={14} />,
                  title: "Gerir",
                  "aria-label": "Gerir",
                  onClick: () => onClick(r),
                },
              ]}
            />
          </div>
        ),
      };
    },
    [],
  );

  const tenantColumns = useMemo<CrmResizableColumn<TenantRow>[]>(
    () => [
      { id: "nome", label: "Empresa", defaultWidth: 180, render: (r) => r.nome },
      {
        id: "slug",
        label: "Slug",
        defaultWidth: 120,
        render: (r) => <code className="text-xs text-[#0f6b4f]">{r.slug}</code>,
      },
      { id: "cnpj", label: "CNPJ", defaultWidth: 120, render: (r) => r.cnpj ?? "—" },
      {
        id: "status",
        label: "Status",
        defaultWidth: 90,
        render: (r) => <OpsStatusBadge variant={r.ativo ? "ativo" : "inativo"} />,
      },
      {
        id: "trial",
        label: "Trial até",
        defaultWidth: 100,
        render: (r) => trialLabel(r.trial_ate),
      },
      {
        id: "criado",
        label: "Criado",
        defaultWidth: 100,
        render: (r) => formatarData(r.criado_em),
      },
      acoesCol<TenantRow>((r) => onGerirTenant?.(r), "Gerir tenant"),
    ],
    [acoesCol, onGerirTenant],
  );

  const agenteColumns = useMemo<CrmResizableColumn<AgenteRow>[]>(
    () => [
      { id: "nome", label: "Agente", defaultWidth: 160, render: (r) => r.nome },
      {
        id: "slug",
        label: "Slug",
        defaultWidth: 120,
        render: (r) => <code className="text-xs text-[#0f6b4f]">{r.agente_slug}</code>,
      },
      { id: "tenant", label: "Tenant", defaultWidth: 150, render: (r) => r.tenant_nome ?? "—" },
      { id: "cargo", label: "Cargo", defaultWidth: 120, render: (r) => r.cargo ?? "—" },
      {
        id: "wa",
        label: "WhatsApp",
        defaultWidth: 120,
        render: (r) =>
          r.whatsapp_conectado ? (
            <OpsStatusBadge variant="ativo" label="Conectado" />
          ) : r.whatsapp_instancia ? (
            <OpsStatusBadge variant="pendente" label="Instância" />
          ) : (
            <OpsStatusBadge variant="neutral" label="Sem WA" />
          ),
      },
      {
        id: "op",
        label: "Operação",
        defaultWidth: 100,
        render: (r) =>
          r.arquivado_em ? (
            <OpsStatusBadge variant="inativo" label="Arquivado" />
          ) : (
            <OpsStatusBadge variant={r.ativo ? "ativo" : "inativo"} />
          ),
      },
    ],
    [],
  );

  const pagamentoColumns = useMemo<CrmResizableColumn<PagamentoRow>[]>(
    () => [
      { id: "tenant", label: "Tenant", defaultWidth: 140, render: (r) => r.tenant_nome ?? "—" },
      {
        id: "comp",
        label: "Competência",
        defaultWidth: 96,
        render: (r) => formatarData(r.competencia),
      },
      {
        id: "valor",
        label: "Valor",
        defaultWidth: 96,
        render: (r) => formatarMoeda(r.valor_reais),
      },
      {
        id: "status",
        label: "Status",
        defaultWidth: 88,
        render: (r) => <OpsStatusBadge variant={statusPagamento(r.status)} />,
      },
      {
        id: "venc",
        label: "Vencimento",
        defaultWidth: 96,
        render: (r) => formatarData(r.vencimento),
      },
      {
        id: "cora",
        label: "Emissão",
        defaultWidth: 88,
        render: (r) =>
          r.cora_invoice_id ? (
            <OpsStatusBadge variant="ativo" label="Emitido" />
          ) : r.cora_status === "erro" || r.cora_erro ? (
            <OpsStatusBadge variant="inativo" label="Erro" />
          ) : (
            <OpsStatusBadge variant="neutral" label="—" />
          ),
      },
      {
        id: "boleto",
        label: "Boleto",
        defaultWidth: 72,
        truncate: false,
        align: "center",
        render: (r) => {
          const url = urlBoleto(r);
          if (!url) return <span className="text-[#90a89b]">—</span>;
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopRowClick}
              className="inline-flex text-[#0f6b4f] hover:text-[#0a4d38]"
              title="Baixar PDF"
            >
              <Download size={15} />
            </a>
          );
        },
      },
    ],
    [urlBoleto],
  );

  const usuarioColumns = useMemo<CrmResizableColumn<UsuarioRow>[]>(
    () => [
      { id: "nome", label: "Nome", defaultWidth: 160, render: (r) => r.name },
      { id: "email", label: "E-mail", defaultWidth: 180, render: (r) => r.email },
      { id: "tenant", label: "Tenant", defaultWidth: 140, render: (r) => r.tenant_nome ?? "—" },
      { id: "role", label: "Papel", defaultWidth: 90, render: (r) => r.role },
      {
        id: "status",
        label: "Status",
        defaultWidth: 88,
        render: (r) => (
          <OpsStatusBadge variant={r.status === "ativo" || r.status === "Ativo" ? "ativo" : "inativo"} />
        ),
      },
      {
        id: "plat",
        label: "Plat.",
        defaultWidth: 64,
        render: (r) => (r.owner ? <OpsStatusBadge variant="ativo" label="Sim" /> : "—"),
      },
      {
        id: "criado",
        label: "Criado",
        defaultWidth: 96,
        render: (r) => formatarData(r.criado_em),
      },
      acoesCol<UsuarioRow>((r) => onGerirUsuario?.(r), "Gerir utilizador"),
    ],
    [acoesCol, onGerirUsuario],
  );

  const leadColumns = useMemo<CrmResizableColumn<LeadInteresseRow>[]>(
    () => [
      { id: "nome", label: "Nome", defaultWidth: 140, render: (r) => r.nome },
      { id: "email", label: "E-mail", defaultWidth: 160, render: (r) => r.email },
      { id: "empresa", label: "Empresa", defaultWidth: 130, render: (r) => r.empresa ?? "—" },
      { id: "tel", label: "Telefone", defaultWidth: 110, render: (r) => r.telefone ?? "—" },
      {
        id: "interesse",
        label: "Interesse",
        defaultWidth: 120,
        render: (r) => r.interesse_principal ?? "—",
      },
      { id: "origem", label: "Origem", defaultWidth: 100, render: (r) => r.origem },
      {
        id: "criado",
        label: "Criado",
        defaultWidth: 96,
        render: (r) => formatarData(r.criado_em),
      },
      acoesCol<LeadInteresseRow>((r) => onGerirLead?.(r), "Gerir lead"),
    ],
    [acoesCol, onGerirLead],
  );

  const rows =
    tab === "tenants"
      ? tenantsFiltrados
      : tab === "agentes"
        ? agentesFiltrados
        : tab === "usuarios"
          ? usuariosFiltrados
          : tab === "leads"
            ? leadsFiltrados
            : pagamentosFiltrados;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-[#eef5ec] px-4 py-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
            <Search size={14} className="text-[#6b8a76]" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar nos resultados..."
              className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
            />
          </div>
          {tab === "tenants" ? (
            <select
              value={filtroTenant}
              onChange={(e) => onFiltroTenantChange(e.target.value as typeof filtroTenant)}
              className="h-10 rounded-xl border border-[#d4ecd0] bg-white px-3 text-xs font-semibold text-[#1e4a24]"
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#d4ecd0] bg-white px-3 text-xs font-semibold text-[#1e4a24] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col px-2 pb-4 pt-2">
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-2">
          <p className="m-0 text-[10px] text-[#6e7681]">{rows.length} registo(s)</p>
          <div className="flex flex-wrap items-center gap-3">
            {tab === "pagamentos" && semEmissaoCount > 0 ? (
              <p className="m-0 text-[10px] font-semibold text-[#b42318]">
                {semEmissaoCount} sem boleto emitido — abra o tenant na aba Tenants para emitir ou
                gerir cobranças
              </p>
            ) : null}
            <p className="m-0 text-[10px] text-[#89a095]">
              Scroll vertical na tabela · arraste a borda da coluna para ajustar
            </p>
          </div>
        </div>

        {tab === "pagamentos" && !schemaPagamentos ? (
          <p className="py-12 text-center text-sm text-[#5d7a67]">
            Execute <code className="text-xs">waje-ops-platform.sql</code> no Supabase para habilitar
            mensalidades.
          </p>
        ) : tab === "leads" && !schemaLeads ? (
          <p className="py-12 text-center text-sm text-[#5d7a67]">
            Aplique a migração <code className="text-xs">20260710100000_waje_landing_interesse.sql</code> no
            Supabase.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#5d7a67]">Nenhum registo encontrado.</p>
        ) : (
          <div className="shrink-0 overflow-hidden rounded-lg border border-[#dcebd8] bg-white">
            {tab === "tenants" ? (
              <CrmResizableDataTable
                tableId="waje-owner-tenants"
                variant="waje"
                columns={tenantColumns}
                rows={tenantsFiltrados}
                rowKey={(r) => r.id}
                maxHeight={TABLE_SCROLL_MAX}
                className="border-t-0 text-xs"
                rowCellClassName="px-3 py-2 align-top text-[#0b2210]"
                getRowStyle={() => ({ borderBottom: "1px solid #eef7eb" })}
                onRowClick={onGerirTenant}
              />
            ) : null}
            {tab === "agentes" ? (
              <CrmResizableDataTable
                tableId="waje-owner-agentes"
                variant="waje"
                columns={agenteColumns}
                rows={agentesFiltrados}
                rowKey={(r) => r.agente_slug}
                maxHeight={TABLE_SCROLL_MAX}
                className="border-t-0 text-xs"
                rowCellClassName="px-3 py-2 align-top text-[#0b2210]"
                getRowStyle={() => ({ borderBottom: "1px solid #eef7eb" })}
              />
            ) : null}
            {tab === "pagamentos" ? (
              <CrmResizableDataTable
                tableId="waje-owner-pagamentos"
                variant="waje"
                columns={pagamentoColumns}
                rows={pagamentosFiltrados}
                rowKey={(r) => r.id}
                maxHeight={TABLE_SCROLL_MAX}
                className="border-t-0 text-xs"
                rowCellClassName="px-3 py-2 align-top text-[#0b2210]"
                getRowStyle={() => ({ borderBottom: "1px solid #eef7eb" })}
              />
            ) : null}
            {tab === "usuarios" ? (
              <CrmResizableDataTable
                tableId="waje-owner-usuarios"
                variant="waje"
                columns={usuarioColumns}
                rows={usuariosFiltrados}
                rowKey={(r) => r.id}
                maxHeight={TABLE_SCROLL_MAX}
                className="border-t-0 text-xs"
                rowCellClassName="px-3 py-2 align-top text-[#0b2210]"
                getRowStyle={() => ({ borderBottom: "1px solid #eef7eb" })}
                onRowClick={onGerirUsuario}
              />
            ) : null}
            {tab === "leads" ? (
              <CrmResizableDataTable
                tableId="waje-owner-leads"
                variant="waje"
                columns={leadColumns}
                rows={leadsFiltrados}
                rowKey={(r) => r.id}
                maxHeight={TABLE_SCROLL_MAX}
                className="border-t-0 text-xs"
                rowCellClassName="px-3 py-2 align-top text-[#0b2210]"
                getRowStyle={() => ({ borderBottom: "1px solid #eef7eb" })}
                onRowClick={onGerirLead}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

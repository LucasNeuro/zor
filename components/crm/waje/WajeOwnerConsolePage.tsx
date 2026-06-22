"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ContaSectionTabs } from "@/components/crm/ContaSectionTabs";
import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import { CrmPainelViewToolbar } from "@/components/crm/painel/CrmPainelViewToolbar";
import type { AgenteRow } from "@/components/crm/waje/WajeOwnerAgenteSideover";
import { WajeOwnerPaineis } from "@/components/crm/waje/WajeOwnerPaineis";
import type { PagamentoRow } from "@/components/crm/waje/WajeOwnerPagamentoSideover";
import { WajeOwnerTabela } from "@/components/crm/waje/WajeOwnerTabela";
import {
  WajeOwnerTenantSideover,
  type TenantRow,
} from "@/components/crm/waje/WajeOwnerTenantSideover";
import type { LeadInteresseRow } from "@/components/crm/waje/WajeOwnerLeadSideover";
import { WajeOwnerLeadSideover } from "@/components/crm/waje/WajeOwnerLeadSideover";
import type { UsuarioRow } from "@/components/crm/waje/WajeOwnerUsuarioSideover";
import { WajeOwnerUsuarioSideover } from "@/components/crm/waje/WajeOwnerUsuarioSideover";
import { sparklineFromSeed } from "@/lib/crm/metric-visuals";
import type { PainelViewMode } from "@/lib/crm/painel-view";
import type { WajeOwnerTab } from "@/components/crm/waje/waje-owner-theme";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

const VALID_TABS: WajeOwnerTab[] = ["tenants", "agentes", "pagamentos", "usuarios", "leads"];

function parseTab(v: string | null): WajeOwnerTab {
  if (v && (VALID_TABS as string[]).includes(v)) return v as WajeOwnerTab;
  return "tenants";
}

const TAB_COPY: Record<WajeOwnerTab, { label: string; description: string }> = {
  tenants: {
    label: "Tenants",
    description: "Empresas clientes na plataforma Waje — ativar ou desativar acesso.",
  },
  agentes: {
    label: "Agentes",
    description: "Agentes IA em todos os tenants — status operacional e WhatsApp.",
  },
  pagamentos: {
    label: "Pagamentos",
    description: "Mensalidades SaaS cobradas de cada tenant.",
  },
  usuarios: {
    label: "Utilizadores",
    description: "Contas em public.users — papéis, tenant e acesso à plataforma.",
  },
  leads: {
    label: "Leads landing",
    description: "Interessados captados na landing (waje_landing_interesse).",
  },
};

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function WajeOwnerConsolePage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const viewParam = searchParams.get("view");

  const initialTab = parseTab(tabParam);
  const [tab, setTab] = useState<WajeOwnerTab>(initialTab);
  const [viewMode, setViewMode] = useState<PainelViewMode>(() => {
    if (viewParam === "paineis" || viewParam === "tabela") return viewParam;
    return initialTab === "tenants" ? "tabela" : "paineis";
  });

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [agentes, setAgentes] = useState<AgenteRow[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [leads, setLeads] = useState<LeadInteresseRow[]>([]);
  const [schemaPagamentos, setSchemaPagamentos] = useState(true);
  const [schemaLeads, setSchemaLeads] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [erroBloqueante, setErroBloqueante] = useState("");
  const [erroTab, setErroTab] = useState<Partial<Record<WajeOwnerTab, string>>>({});
  const [search, setSearch] = useState("");
  const [filtroTenant, setFiltroTenant] = useState<"todos" | "ativos" | "inativos">("todos");

  const [tenantSideover, setTenantSideover] = useState<TenantRow | null>(null);
  const [usuarioSideover, setUsuarioSideover] = useState<UsuarioRow | null>(null);
  const [leadSideover, setLeadSideover] = useState<LeadInteresseRow | null>(null);

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    setErroBloqueante("");
    setErroTab({});
    try {
      const [rT, rA, rP, rU, rL] = await Promise.all([
        fetch("/api/ops/tenants", { headers: await opsApiHeaders(), credentials: "include" }),
        fetch("/api/ops/agentes", { headers: await opsApiHeaders(), credentials: "include" }),
        fetch("/api/ops/pagamentos", { headers: await opsApiHeaders(), credentials: "include" }),
        fetch("/api/ops/users", { headers: await opsApiHeaders(), credentials: "include" }),
        fetch("/api/ops/landing-interesse", { headers: await opsApiHeaders(), credentials: "include" }),
      ]);
      const jT = (await rT.json()) as { data?: TenantRow[]; error?: string };
      const jA = (await rA.json()) as { data?: AgenteRow[]; error?: string };
      const jP = (await rP.json()) as {
        data?: PagamentoRow[];
        schema_ready?: boolean;
        error?: string;
      };
      const jU = (await rU.json()) as { data?: UsuarioRow[]; error?: string };
      const jL = (await rL.json()) as {
        data?: LeadInteresseRow[];
        schema_ready?: boolean;
        error?: string;
      };
      if (!rT.ok) throw new Error(jT.error ?? "Falha ao carregar tenants.");
      if (!rA.ok) throw new Error(jA.error ?? "Falha ao carregar agentes.");
      const nextTenants = jT.data ?? [];
      setTenants(nextTenants);
      setAgentes(jA.data ?? []);
      setPagamentos(jP.data ?? []);
      setUsuarios(jU.data ?? []);
      setLeads(jL.data ?? []);
      setSchemaPagamentos(jP.schema_ready !== false);
      setSchemaLeads(jL.schema_ready !== false);
      setTenantSideover((prev) => {
        if (!prev) return prev;
        return nextTenants.find((t) => t.id === prev.id) ?? prev;
      });
      const tabErrors: Partial<Record<WajeOwnerTab, string>> = {};
      if (!rP.ok && jP.error) tabErrors.pagamentos = jP.error;
      if (!rU.ok && jU.error) tabErrors.usuarios = jU.error;
      if (!rL.ok && jL.error) tabErrors.leads = jL.error;
      setErroTab(tabErrors);
    } catch (e) {
      setErroBloqueante(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      if (opts?.silent) setRefreshing(false);
      else setLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  const atualizarPagamentosGlobais = useCallback(async () => {
    setRefreshing(true);
    try {
      const rP = await fetch("/api/ops/pagamentos", {
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const jP = (await rP.json()) as {
        data?: PagamentoRow[];
        schema_ready?: boolean;
        error?: string;
      };
      if (rP.ok) {
        setPagamentos(jP.data ?? []);
        setSchemaPagamentos(jP.schema_ready !== false);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (VALID_TABS.includes(tabParam as WajeOwnerTab)) {
      setTab(tabParam as WajeOwnerTab);
    }
    if (viewParam === "paineis" || viewParam === "tabela") {
      setViewMode(viewParam);
    }
  }, [tabParam, viewParam]);

  const metrics = useMemo(() => {
    if (tab === "tenants") {
      const ativos = tenants.filter((t) => t.ativo).length;
      const emTrial = tenants.filter(
        (t) => t.trial_ate && new Date(t.trial_ate).getTime() > Date.now(),
      ).length;
      return [
        { label: "Total tenants", valor: tenants.length, sub: "Na plataforma", tone: "brand" as const, seed: 1 },
        { label: "Ativos", valor: ativos, sub: "Com acesso", tone: "success" as const, seed: 2 },
        { label: "Em trial", valor: emTrial, tone: "warning" as const, seed: 3 },
        {
          label: "Com CNPJ",
          valor: tenants.filter((t) => t.cnpj).length,
          tone: "muted" as const,
          seed: 4,
        },
      ];
    }
    if (tab === "agentes") {
      const ops = agentes.filter((a) => a.ativo && !a.arquivado_em).length;
      return [
        { label: "Total agentes", valor: agentes.length, tone: "brand" as const, seed: 5 },
        { label: "Operacionais", valor: ops, tone: "success" as const, seed: 6 },
        {
          label: "WhatsApp OK",
          valor: agentes.filter((a) => a.whatsapp_conectado).length,
          tone: "brand" as const,
          seed: 7,
        },
        {
          label: "Arquivados",
          valor: agentes.filter((a) => a.arquivado_em).length,
          tone: "muted" as const,
          seed: 8,
        },
      ];
    }
    if (tab === "usuarios") {
      const ativos = usuarios.filter((u) => u.status === "ativo" || u.status === "Ativo").length;
      return [
        { label: "Total utilizadores", valor: usuarios.length, tone: "brand" as const, seed: 13 },
        { label: "Ativos", valor: ativos, tone: "success" as const, seed: 14 },
        {
          label: "Plataforma",
          valor: usuarios.filter((u) => u.owner).length,
          tone: "warning" as const,
          seed: 15,
        },
        {
          label: "Com tenant",
          valor: usuarios.filter((u) => u.tenant_id).length,
          tone: "muted" as const,
          seed: 16,
        },
      ];
    }
    if (tab === "leads") {
      const ultimos7 = leads.filter((l) => {
        const t = new Date(l.criado_em).getTime();
        return t > Date.now() - 7 * 86_400_000;
      }).length;
      return [
        { label: "Total leads", valor: leads.length, tone: "brand" as const, seed: 17 },
        { label: "Últimos 7 dias", valor: ultimos7, tone: "success" as const, seed: 18 },
        {
          label: "Com empresa",
          valor: leads.filter((l) => l.empresa).length,
          tone: "brand" as const,
          seed: 19,
        },
        {
          label: "Origem landing",
          valor: leads.filter((l) => l.origem.includes("landing")).length,
          tone: "muted" as const,
          seed: 20,
        },
      ];
    }
    const aReceber = pagamentos
      .filter((p) => p.status === "pendente" || p.status === "atrasado")
      .reduce((s, p) => s + p.valor_reais, 0);
    const recebido = pagamentos
      .filter((p) => p.status === "pago")
      .reduce((s, p) => s + p.valor_reais, 0);
    const pendentes = pagamentos.filter((p) => p.status === "pendente").length;
    return [
      { label: "Mensalidades", valor: pagamentos.length, tone: "brand" as const, seed: 9, ocultavel: true },
      {
        label: "A receber",
        valor: formatarMoeda(aReceber),
        sub: pendentes ? `${pendentes} pendente(s)` : undefined,
        tone: "warning" as const,
        seed: 10,
        ocultavel: true,
      },
      {
        label: "Recebido",
        valor: formatarMoeda(recebido),
        sub: "mensalidades pagas",
        tone: "success" as const,
        seed: 12,
        ocultavel: true,
      },
      {
        label: "Emitidas",
        valor: pagamentos.filter((p) => p.cora_invoice_id).length,
        sub: "com boleto gerado",
        tone: "brand" as const,
        seed: 11,
        ocultavel: true,
      },
    ];
  }, [tab, tenants, agentes, pagamentos, usuarios, leads]);

  if (loading && !hasLoadedOnce) {
    return (
      <div className="flex h-72 items-center justify-center bg-[#f8fcf6]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#92ff00] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f8fcf6]">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {erroBloqueante ? (
          <div
            className="mb-4 rounded-xl border border-[#f8514966] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]"
            role="alert"
          >
            {erroBloqueante}
            <button
              type="button"
              onClick={() => void carregar()}
              className="ml-2 text-xs font-bold underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {!erroBloqueante && erroTab[tab] ? (
          <div
            className="mb-4 rounded-xl border border-[#f59e0b66] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]"
            role="status"
          >
            {TAB_COPY[tab].label}: {erroTab[tab]}
            <button
              type="button"
              onClick={() => void carregar({ silent: true })}
              className="ml-2 text-xs font-bold underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        <CrmMetricsGrid cols={4} className="mb-4">
          {metrics.map((m) => (
            <CrmMetricCard
              key={m.label}
              label={m.label}
              valor={m.valor}
              sub={"sub" in m ? m.sub : undefined}
              tone={m.tone}
              sparkline={sparklineFromSeed(m.seed)}
              ocultavel={"ocultavel" in m ? Boolean(m.ocultavel) : false}
            />
          ))}
        </CrmMetricsGrid>

        <div className="flex w-full min-w-0 flex-col rounded-2xl border border-[#dcebd8] bg-white shadow-[0_2px_8px_rgba(11,31,16,0.05)]">
          <ContaSectionTabs
            tabs={(
              Object.keys(TAB_COPY) as WajeOwnerTab[]
            ).map((id) => ({ id, label: TAB_COPY[id].label }))}
            activeId={tab}
            onSelect={(id) => {
              setTab(id as WajeOwnerTab);
              setSearch("");
            }}
          />

          <CrmPainelViewToolbar
            description={TAB_COPY[tab].description}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showViewToggle
            periodo="7d"
            onPeriodoChange={() => {}}
            showPeriodo={false}
            onRefresh={viewMode === "paineis" ? () => void carregar({ silent: true }) : undefined}
            refreshing={refreshing}
            dark={false}
          />

          {viewMode === "paineis" ? (
            <WajeOwnerPaineis
              tab={tab}
              tenants={tenants}
              agentes={agentes}
              pagamentos={pagamentos}
              usuarios={usuarios}
              leads={leads}
              onGerirTenant={tab === "tenants" ? setTenantSideover : undefined}
            />
          ) : (
            <WajeOwnerTabela
              tab={tab}
              tenants={tenants}
              agentes={agentes}
              pagamentos={pagamentos}
              usuarios={usuarios}
              leads={leads}
              search={search}
              onSearchChange={setSearch}
              filtroTenant={filtroTenant}
              onFiltroTenantChange={setFiltroTenant}
              loading={refreshing}
              onRefresh={() => void carregar({ silent: true })}
              schemaPagamentos={schemaPagamentos}
              schemaLeads={schemaLeads}
              onGerirTenant={setTenantSideover}
              onGerirUsuario={setUsuarioSideover}
              onGerirLead={setLeadSideover}
            />
          )}
        </div>
      </div>

      <WajeOwnerTenantSideover
        open={Boolean(tenantSideover)}
        tenant={tenantSideover}
        onClose={() => setTenantSideover(null)}
        onUpdated={(t) => {
          setTenants((prev) => prev.map((x) => (x.id === t.id ? t : x)));
          setTenantSideover(t);
        }}
        onBillingChanged={() => void atualizarPagamentosGlobais()}
      />

      <WajeOwnerUsuarioSideover
        open={Boolean(usuarioSideover)}
        usuario={usuarioSideover}
        tenants={tenants}
        onClose={() => setUsuarioSideover(null)}
        onUpdated={(u) => {
          setUsuarios((prev) => prev.map((x) => (x.id === u.id ? u : x)));
          setUsuarioSideover(u);
        }}
        onDeleted={(id) => {
          setUsuarios((prev) => prev.filter((x) => x.id !== id));
          setUsuarioSideover(null);
        }}
      />

      <WajeOwnerLeadSideover
        open={Boolean(leadSideover)}
        lead={leadSideover}
        onClose={() => setLeadSideover(null)}
        onUpdated={(l) => {
          setLeads((prev) => prev.map((x) => (x.id === l.id ? l : x)));
          setLeadSideover(l);
        }}
        onDeleted={(id) => {
          setLeads((prev) => prev.filter((x) => x.id !== id));
          setLeadSideover(null);
        }}
      />
    </div>
  );
}

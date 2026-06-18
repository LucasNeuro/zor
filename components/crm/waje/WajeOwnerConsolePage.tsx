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
import type { WajeOwnerTab } from "@/components/crm/waje/waje-owner-theme";
import { sparklineFromSeed } from "@/lib/crm/metric-visuals";
import type { PainelViewMode } from "@/lib/crm/painel-view";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

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
};

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function WajeOwnerConsolePage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const viewParam = searchParams.get("view");

  const [tab, setTab] = useState<WajeOwnerTab>(
    tabParam === "agentes" || tabParam === "pagamentos" ? tabParam : "tenants",
  );
  const [viewMode, setViewMode] = useState<PainelViewMode>(
    viewParam === "tabela" ? "tabela" : "paineis",
  );

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [agentes, setAgentes] = useState<AgenteRow[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([]);
  const [schemaPagamentos, setSchemaPagamentos] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [erro, setErro] = useState("");
  const [search, setSearch] = useState("");
  const [filtroTenant, setFiltroTenant] = useState<"todos" | "ativos" | "inativos">("todos");

  const [tenantSideover, setTenantSideover] = useState<TenantRow | null>(null);

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    setErro("");
    try {
      const [rT, rA, rP] = await Promise.all([
        fetch("/api/ops/tenants", { headers: await opsApiHeaders(), credentials: "include" }),
        fetch("/api/ops/agentes", { headers: await opsApiHeaders(), credentials: "include" }),
        fetch("/api/ops/pagamentos", { headers: await opsApiHeaders(), credentials: "include" }),
      ]);
      const jT = (await rT.json()) as { data?: TenantRow[]; error?: string };
      const jA = (await rA.json()) as { data?: AgenteRow[]; error?: string };
      const jP = (await rP.json()) as {
        data?: PagamentoRow[];
        schema_ready?: boolean;
        error?: string;
      };
      if (!rT.ok) throw new Error(jT.error ?? "Falha ao carregar tenants.");
      if (!rA.ok) throw new Error(jA.error ?? "Falha ao carregar agentes.");
      const nextTenants = jT.data ?? [];
      setTenants(nextTenants);
      setAgentes(jA.data ?? []);
      setPagamentos(jP.data ?? []);
      setSchemaPagamentos(jP.schema_ready !== false);
      setTenantSideover((prev) => {
        if (!prev) return prev;
        return nextTenants.find((t) => t.id === prev.id) ?? prev;
      });
      if (!rP.ok && jP.error) setErro(jP.error);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
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
    if (tabParam === "agentes" || tabParam === "pagamentos" || tabParam === "tenants") {
      setTab(tabParam);
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
  }, [tab, tenants, agentes, pagamentos]);

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
        {erro ? (
          <div
            className="mb-4 rounded-xl border border-[#f8514966] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]"
            role="alert"
          >
            {erro}
            <button
              type="button"
              onClick={() => void carregar()}
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
            />
          ) : (
            <WajeOwnerTabela
              tab={tab}
              tenants={tenants}
              agentes={agentes}
              pagamentos={pagamentos}
              search={search}
              onSearchChange={setSearch}
              filtroTenant={filtroTenant}
              onFiltroTenantChange={setFiltroTenant}
              loading={refreshing}
              onRefresh={() => void carregar({ silent: true })}
              schemaPagamentos={schemaPagamentos}
              onGerirTenant={setTenantSideover}
              onPagamentosChange={() => void atualizarPagamentosGlobais()}
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
    </div>
  );
}

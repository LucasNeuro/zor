"use client";

import { CrmPainelChartShell } from "@/components/crm/painel/CrmPainelChartShell";
import type { AgenteRow } from "@/components/crm/waje/WajeOwnerAgenteSideover";
import type { TenantRow } from "@/components/crm/waje/WajeOwnerTenantSideover";

type PagamentoRow = {
  id: string;
  tenant_nome: string | null;
  competencia: string;
  valor_reais: number;
  status: string;
};

type Props = {
  tab: "tenants" | "agentes" | "pagamentos";
  tenants: TenantRow[];
  agentes: AgenteRow[];
  pagamentos: PagamentoRow[];
};

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[rgba(146,255,0,0.08)] py-2 last:border-0">
      <span className="text-[11px]" style={{ color: "#b8d4bc" }}>
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums" style={{ color: "#92ff00" }}>
        {value}
      </span>
    </div>
  );
}

export function WajeOwnerPaineis({ tab, tenants, agentes, pagamentos }: Props) {
  const ativosT = tenants.filter((t) => t.ativo).length;
  const waOk = agentes.filter((a) => a.whatsapp_conectado).length;
  const opsA = agentes.filter((a) => a.ativo && !a.arquivado_em).length;
  const pendentes = pagamentos.filter((p) => p.status === "pendente").length;
  const pagos = pagamentos.filter((p) => p.status === "pago").length;
  const receita = pagamentos
    .filter((p) => p.status === "pago")
    .reduce((s, p) => s + p.valor_reais, 0);

  if (tab === "tenants") {
    const emTrial = tenants.filter(
      (t) => t.trial_ate && new Date(t.trial_ate).getTime() > Date.now(),
    ).length;
    const trialExpirado = tenants.filter(
      (t) => t.trial_ate && new Date(t.trial_ate).getTime() <= Date.now(),
    ).length;
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <CrmPainelChartShell title="Tenants na plataforma" subtitle={`${tenants.length} empresa(s) cadastrada(s)`}>
          <StatLine label="Ativos" value={ativosT} />
          <StatLine label="Inativos" value={tenants.length - ativosT} />
          <StatLine label="Taxa ativa" value={tenants.length ? `${Math.round((ativosT / tenants.length) * 100)}%` : "—"} />
        </CrmPainelChartShell>
        <CrmPainelChartShell title="Período de teste" subtitle="Trial configurado pelo console Owner">
          <StatLine label="Em trial agora" value={emTrial} />
          <StatLine label="Trial expirado" value={trialExpirado} />
          <StatLine label="Sem trial" value={tenants.filter((t) => !t.trial_ate).length} />
        </CrmPainelChartShell>
        <CrmPainelChartShell title="Últimos tenants" subtitle="Mais recentes no cadastro">
          {tenants.slice(0, 5).map((t) => (
            <StatLine key={t.id} label={t.nome} value={t.ativo ? "Ativo" : "Inativo"} />
          ))}
          {tenants.length === 0 ? (
            <p className="py-4 text-center text-[11px]" style={{ color: "#7a9a7e" }}>
              Nenhum tenant.
            </p>
          ) : null}
        </CrmPainelChartShell>
        <CrmPainelChartShell title="Com CNPJ" subtitle="Identificação fiscal no settings" highlight>
          <StatLine
            label="Com documento"
            value={tenants.filter((t) => t.cnpj).length}
          />
          <StatLine label="Sem CNPJ" value={tenants.filter((t) => !t.cnpj).length} />
        </CrmPainelChartShell>
      </div>
    );
  }

  if (tab === "agentes") {
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <CrmPainelChartShell title="Agentes IA" subtitle={`${agentes.length} agente(s) no total`}>
          <StatLine label="Operacionais" value={opsA} />
          <StatLine label="Arquivados" value={agentes.filter((a) => a.arquivado_em).length} />
          <StatLine label="Inativos" value={agentes.filter((a) => !a.ativo && !a.arquivado_em).length} />
        </CrmPainelChartShell>
        <CrmPainelChartShell title="WhatsApp" subtitle="Conexão UAZAPI por agente">
          <StatLine label="Conectados" value={waOk} />
          <StatLine label="Com instância" value={agentes.filter((a) => a.whatsapp_instancia).length} />
          <StatLine label="Sem WA" value={agentes.filter((a) => !a.whatsapp_instancia).length} />
        </CrmPainelChartShell>
        <CrmPainelChartShell title="Por tenant" subtitle="Distribuição" highlight>
          {Array.from(
            agentes.reduce((map, a) => {
              const k = a.tenant_nome ?? "Sem tenant";
              map.set(k, (map.get(k) ?? 0) + 1);
              return map;
            }, new Map<string, number>()),
          )
            .slice(0, 6)
            .map(([nome, n]) => (
              <StatLine key={nome} label={nome} value={n} />
            ))}
          {agentes.length === 0 ? (
            <p className="py-4 text-center text-[11px]" style={{ color: "#7a9a7e" }}>
              Nenhum agente.
            </p>
          ) : null}
        </CrmPainelChartShell>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      <CrmPainelChartShell title="Mensalidades" subtitle={`${pagamentos.length} registro(s)`}>
        <StatLine label="Pendentes" value={pendentes} />
        <StatLine label="Pagas" value={pagos} />
        <StatLine label="Atrasadas" value={pagamentos.filter((p) => p.status === "atrasado").length} />
      </CrmPainelChartShell>
      <CrmPainelChartShell title="Receita recebida" subtitle="Status pago no período">
        <p className="text-2xl font-extrabold tabular-nums" style={{ color: "#92ff00" }}>
          {receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      </CrmPainelChartShell>
      <CrmPainelChartShell title="Últimas competências" subtitle="Mais recentes" highlight>
        {pagamentos.slice(0, 5).map((p) => (
          <StatLine
            key={p.id}
            label={p.tenant_nome ?? "—"}
            value={p.valor_reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          />
        ))}
        {pagamentos.length === 0 ? (
          <p className="py-4 text-center text-[11px]" style={{ color: "#7a9a7e" }}>
            Sem mensalidades cadastradas.
          </p>
        ) : null}
      </CrmPainelChartShell>
    </div>
  );
}

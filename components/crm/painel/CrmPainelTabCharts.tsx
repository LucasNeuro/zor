"use client";

import { CrmPainelChartShell, PAINEL_LIME } from "@/components/crm/painel/CrmPainelChartShell";
import {
  AreaChartDark,
  ConversaoChartDark,
  DonutChartDark,
  FunilBarChartDark,
  MetricBarsChartDark,
  RadialGaugeDark,
} from "@/components/crm/painel/CrmPainelChartsDark";
import type { AnalyticsPayload } from "@/lib/crm/analytics-aggregate";
import type { AnalyticsPeriodo } from "@/lib/crm/analytics-period";
import { periodoLabel as periodoLabelFn } from "@/lib/crm/analytics-period";
import type { PainelTabId } from "@/lib/crm/painel-tabs";
import { moedaPipeline } from "@/lib/crm/pipeline-funil";
import { CRM_MODULE_PARCEIROS_ENABLED } from "@/lib/crm/waje-modules";

type Props = {
  tabId: PainelTabId;
  data: AnalyticsPayload;
  periodo: AnalyticsPeriodo;
};

function mapFunil(items: AnalyticsPayload["funilLeads"]) {
  return items.map((f) => ({
    label: f.label,
    count: f.count,
  }));
}

export function CrmPainelTabCharts({ tabId, data, periodo }: Props) {
  const periodoTxt = periodoLabelFn(periodo);

  switch (tabId) {
    case "visao-geral":
      return (
        <ChartsGrid>
          <CrmPainelChartShell
            title="Captação de leads"
            subtitle={`Marketing → CRM · ${periodoTxt}`}
            highlight
            className="md:col-span-2 lg:col-span-1"
          >
            <AreaChartDark pontos={data.leadsPorDia} periodo={periodo} />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Funil comercial" subtitle="Leads por estágio">
            <DonutChartDark items={mapFunil(data.funilLeads)} centerLabel="leads" />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Pipeline de negócios" subtitle="Etapas do funil comercial">
            <FunilBarChartDark items={data.funilNegocios.map((f) => ({ label: f.label, count: f.count }))} />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Conversão" subtitle={CRM_MODULE_PARCEIROS_ENABLED ? "Qualificação e parceiros" : "Qualificação de leads"}>
            <ConversaoChartDark
              taxaQualificacao={data.metricas.taxaQualificacao}
              taxaEncaminhamento={data.metricas.taxaEncaminhamento}
              mostrarEncaminhamento={CRM_MODULE_PARCEIROS_ENABLED}
            />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Operação comercial" subtitle="CRM em tempo real">
            <MetricBarsChartDark
              items={[
                { label: "Conversas ativas", count: data.operacao.conversasAtivas },
                { label: "Leads em atendimento", count: data.operacao.leadsAtivos },
                {
                  label: "Negócios no pipeline",
                  count: data.funilNegocios
                    .filter((f) => f.id !== "ganho" && f.id !== "perdido")
                    .reduce((s, f) => s + f.count, 0),
                },
              ]}
            />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Atendimento WhatsApp" subtitle="Fila e agentes IA">
            <MetricBarsChartDark
              items={[
                {
                  label: "Mensagens na fila",
                  count: data.atendimento.filaPendente,
                  color: data.atendimento.filaPendente > 5 ? "#ff7b72" : PAINEL_LIME,
                },
                {
                  label: "Leads aguardando",
                  count: data.atendimento.leadsAguardando,
                  color: data.atendimento.leadsAguardando > 0 ? "#e3b341" : PAINEL_LIME,
                },
                { label: "Agentes IA ativos", count: data.atendimento.agentesAtivos },
              ]}
            />
          </CrmPainelChartShell>
        </ChartsGrid>
      );

    case "comercial":
      return (
        <ChartsGrid>
          <CrmPainelChartShell
            title="Entrada de leads"
            subtitle={periodoTxt}
            highlight
            className="md:col-span-2"
          >
            <AreaChartDark pontos={data.leadsPorDia} periodo={periodo} />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Funil de leads" subtitle="Distribuição por estágio">
            <DonutChartDark items={mapFunil(data.funilLeads)} centerLabel="total" />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Funil de negócios" subtitle="Etapas comerciais">
            <FunilBarChartDark items={data.funilNegocios.map((f) => ({ label: f.label, count: f.count }))} />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Taxas comerciais" subtitle={CRM_MODULE_PARCEIROS_ENABLED ? "Meta: qualif. 40% · enc. 15%" : "Meta: qualif. 40%"}>
            <ConversaoChartDark
              taxaQualificacao={data.metricas.taxaQualificacao}
              taxaEncaminhamento={data.metricas.taxaEncaminhamento}
              mostrarEncaminhamento={CRM_MODULE_PARCEIROS_ENABLED}
            />
          </CrmPainelChartShell>
          {CRM_MODULE_PARCEIROS_ENABLED ? (
          <CrmPainelChartShell title="Rede de parceiros" subtitle="Homologados e encaminhamentos">
            <MetricBarsChartDark
              items={[
                { label: "Parceiros homologados", count: data.parceiros.homologados },
                { label: "Encaminhamentos", count: data.parceiros.encaminhamentosPeriodo },
              ]}
            />
            <div className="mt-4">
              <RadialGaugeDark label="Taxa encaminhamento" pct={data.parceiros.taxaEncaminhamento} meta={15} />
            </div>
          </CrmPainelChartShell>
          ) : null}
        </ChartsGrid>
      );

    case "atendimento":
      return (
        <ChartsGrid>
          <CrmPainelChartShell
            title="Fila operacional"
            subtitle="WhatsApp e canais"
            highlight
            className="md:col-span-2"
          >
            <div className="grid grid-cols-3 gap-3">
              <RadialGaugeDark
                label="Fila pendente"
                pct={Math.min(100, data.atendimento.filaPendente * 8)}
                meta={80}
              />
              <RadialGaugeDark
                label="Leads aguardando"
                pct={Math.min(100, data.atendimento.leadsAguardando * 15)}
                meta={50}
              />
              <div className="flex flex-col items-center justify-center">
                <p className="text-3xl font-black tabular-nums" style={{ color: PAINEL_LIME }}>
                  {data.atendimento.agentesAtivos}
                </p>
                <p className="text-[10px] font-medium text-[#b8d4bc]">agentes IA</p>
              </div>
            </div>
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Volume de atendimento" subtitle={periodoTxt}>
            <MetricBarsChartDark
              items={[
                { label: "Mensagens na fila", count: data.atendimento.filaPendente },
                { label: "Leads aguardando ação", count: data.atendimento.leadsAguardando },
                { label: "Aprovações pendentes", count: data.metricas.aprovacoesPendentes },
                { label: "Agentes IA ativos", count: data.atendimento.agentesAtivos },
              ]}
            />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Leads no funil" subtitle="Estágios de atendimento">
            <FunilBarChartDark items={mapFunil(data.funilLeads)} />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Captação recente" subtitle="Novos leads">
            <AreaChartDark pontos={data.leadsPorDia} periodo={periodo} />
          </CrmPainelChartShell>
        </ChartsGrid>
      );

    case "operacao":
      return (
        <ChartsGrid>
          <CrmPainelChartShell title="Operação CRM" subtitle="Atendimento e pipeline" highlight>
            <MetricBarsChartDark
              items={[
                { label: "Conversas ativas", count: data.operacao.conversasAtivas },
                { label: "Leads em atendimento", count: data.operacao.leadsAtivos },
                { label: "Mensagens na fila", count: data.atendimento.filaPendente },
              ]}
            />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Pipeline comercial" subtitle="Negócios em aberto">
            <DonutChartDark
              items={data.funilNegocios
                .filter((f) => f.id !== "ganho" && f.id !== "perdido")
                .map((f) => ({ label: f.label, count: f.count }))}
              centerLabel="abertos"
            />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Negócios por etapa" subtitle="Funil operacional">
            <FunilBarChartDark items={data.funilNegocios.map((f) => ({ label: f.label, count: f.count }))} />
          </CrmPainelChartShell>
          {CRM_MODULE_PARCEIROS_ENABLED ? (
          <CrmPainelChartShell title="Rede e encaminhamentos" subtitle={periodoTxt}>
            <MetricBarsChartDark
              items={[
                { label: "Encaminhamentos", count: data.parceiros.encaminhamentosPeriodo },
                { label: "Parceiros homologados", count: data.parceiros.homologados },
              ]}
            />
          </CrmPainelChartShell>
          ) : null}
        </ChartsGrid>
      );

    case "financeiro":
      return (
        <ChartsGrid>
          <CrmPainelChartShell
            title="Receita potencial"
            subtitle="Pipeline em aberto"
            highlight
            className="md:col-span-2"
          >
            <p className="text-3xl font-black tabular-nums" style={{ color: PAINEL_LIME }}>
              {moedaPipeline(data.metricas.receitaPotencial)}
            </p>
            <div className="mt-4">
              <MetricBarsChartDark
                items={[
                  {
                    label: "Negócios no pipeline",
                    count: data.funilNegocios
                      .filter((f) => f.id !== "ganho" && f.id !== "perdido")
                      .reduce((s, f) => s + f.count, 0),
                  },
                  { label: "Leads hoje", count: data.metricas.leadsHoje },
                ]}
              />
            </div>
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Conversão financeira" subtitle="Qualificação do funil">
            <ConversaoChartDark
              taxaQualificacao={data.metricas.taxaQualificacao}
              taxaEncaminhamento={data.metricas.taxaEncaminhamento}
              mostrarEncaminhamento={CRM_MODULE_PARCEIROS_ENABLED}
            />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Resultado comercial" subtitle="Ganhos vs perdas">
            <FunilBarChartDark
              items={data.funilNegocios
                .filter((f) => f.id === "ganho" || f.id === "perdido" || f.count > 0)
                .map((f) => ({
                  label: f.label,
                  count: f.count,
                  color: f.id === "ganho" ? PAINEL_LIME : f.id === "perdido" ? "#ff7b72" : undefined,
                }))}
            />
          </CrmPainelChartShell>
          <CrmPainelChartShell title="Captação" subtitle={periodoTxt}>
            <AreaChartDark pontos={data.leadsPorDia} periodo={periodo} />
          </CrmPainelChartShell>
        </ChartsGrid>
      );

    default:
      return null;
  }
}

function ChartsGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

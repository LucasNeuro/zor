"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { AnalyticsPayload, KpiCard } from "@/lib/crm/analytics-aggregate";
import {
  ANALYTICS_PERIODOS,
  type AnalyticsPeriodo,
  periodoLabel,
} from "@/lib/crm/analytics-period";
import { CrmLeadsEntradaPeriodo } from "@/components/crm/CrmLeadsEntradaPeriodo";
import { FunilOperacionalChart } from "@/components/crm/FunilOperacionalChart";
import {
  PipelineTabsBar,
  type PipelineTabItem,
} from "@/components/crm/pipelines/PipelineTabsBar";
import { moedaPipeline } from "@/lib/crm/pipeline-funil";
import type { PrefixoMercado } from "@/lib/crm/negocio-cadastro";
import { CRM_MODULE_PARCEIROS_ENABLED } from "@/lib/crm/waje-modules";

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-gradient-to-r from-[#c9a24a44] to-transparent" />
      <p className="text-xs font-black uppercase tracking-widest text-[#c9a24a]">{children}</p>
      <div className="h-px flex-1 bg-gradient-to-l from-[#c9a24a44] to-transparent" />
    </div>
  );
}

function nivelBadge(nivel: string) {
  if (nivel === "critico") return { label: "Crítico", cls: "bg-[#f8514926] text-[#ff7b72]" };
  if (nivel === "atencao") return { label: "Atenção", cls: "bg-[#d2992226] text-[#e3b341]" };
  return { label: "OK", cls: "bg-[#23863633] text-[#3fb950]" };
}

function formatValor(kpi: KpiCard): string {
  if (kpi.unidade === "BRL") return moedaPipeline(kpi.valor);
  if (kpi.unidade === "%") return `${kpi.valor.toFixed(1)}%`;
  return Number.isInteger(kpi.valor) ? String(kpi.valor) : kpi.valor.toFixed(1);
}

function KpiCardView({ kpi }: { kpi: KpiCard }) {
  const badge = nivelBadge(kpi.nivel_alerta);
  const border =
    kpi.nivel_alerta === "critico"
      ? "border-[#f8514966]"
      : kpi.nivel_alerta === "atencao"
        ? "border-[#d2992266]"
        : "border-[#dcebd8]";

  return (
    <div className={`rounded-xl border bg-[#ffffff] p-4 ${border}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-bold text-[#0b2210]" title={kpi.slug}>
          {kpi.nome}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${badge.cls}`}>{badge.label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-[#5d7a67]">Atual</p>
          <p className="text-lg font-bold text-[#0b2210]">{formatValor(kpi)}</p>
        </div>
        {kpi.valor_meta != null && (
          <div className="text-right">
            <p className="text-xs text-[#5d7a67]">Meta</p>
            <p className="text-sm font-bold text-[#0b2210]">
              {kpi.unidade === "BRL" ? moedaPipeline(kpi.valor_meta) : `${kpi.valor_meta}${kpi.unidade === "%" ? "%" : ""}`}
            </p>
          </div>
        )}
      </div>
      {kpi.progresso_pct != null && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#eef7eb]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${kpi.progresso_pct}%`,
                background:
                  kpi.nivel_alerta === "critico"
                    ? "#f85149"
                    : kpi.nivel_alerta === "atencao"
                      ? "#d29922"
                      : "#3fb950",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

type FunilNegocioBar = AnalyticsPayload["funilNegocios"][number];

function MetricMini({
  label,
  value,
  cor,
  href,
}: {
  label: string;
  value: string | number;
  cor?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#484f58]">{label}</p>
      <p className="text-xl font-black" style={{ color: cor ?? "#0b2210" }}>
        {value}
      </p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border border-[#dcebd8] bg-[#ffffff] p-3 transition-transform hover:scale-[1.02]"
        style={{ borderLeft: `3px solid ${cor ?? "#dcebd8"}` }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div
      className="rounded-xl border border-[#dcebd8] bg-[#ffffff] p-3"
      style={{ borderLeft: `3px solid ${cor ?? "#dcebd8"}` }}
    >
      {inner}
    </div>
  );
}

export function CrmAnalyticsDashboard() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [periodo, setPeriodo] = useState<AnalyticsPeriodo>("24h");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizandoKpis, setAtualizandoKpis] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [kpiFeedback, setKpiFeedback] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [pipelines, setPipelines] = useState<PipelineTabItem[]>([]);
  const [mercadoSelecionado, setMercadoSelecionado] = useState<PrefixoMercado | null>(null);
  const [funilNegocios, setFunilNegocios] = useState<FunilNegocioBar[]>([]);
  const [carregandoFunilNeg, setCarregandoFunilNeg] = useState(false);
  const [erroFunilNeg, setErroFunilNeg] = useState<string | null>(null);

  const carregarPipelines = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/pipelines?tipo=negocio", {
        credentials: "include",
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({ data: [] }))) as { data?: PipelineTabItem[] };
      const list = json.data ?? [];
      const porMercado = list.filter((p) => p.mercado_sigla);
      setPipelines(porMercado.length ? porMercado : list);
    } catch {
      setPipelines([]);
    }
  }, []);

  const carregarFunilNegocios = useCallback(
    async (mercado: PrefixoMercado) => {
      setCarregandoFunilNeg(true);
      setErroFunilNeg(null);
      try {
        const res = await fetch(`/api/crm/analytics?periodo=${periodo}&mercado=${mercado}`, {
          credentials: "include",
          headers: internalApiHeaders(),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const payload = (await res.json()) as AnalyticsPayload;
        setFunilNegocios(payload.funilNegocios ?? []);
      } catch (e) {
        setErroFunilNeg(e instanceof Error ? e.message : "Erro ao carregar funil de negócios");
        setFunilNegocios([]);
      } finally {
        setCarregandoFunilNeg(false);
      }
    },
    [periodo]
  );

  const onSelectPipeline = useCallback(
    (pipelineId: string) => {
      const pipe = pipelines.find((p) => p.id === pipelineId);
      const sigla = pipe?.mercado_sigla?.trim().toUpperCase() as PrefixoMercado | undefined;
      if (!sigla) return;
      setMercadoSelecionado(sigla);
    },
    [pipelines]
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/analytics?periodo=${periodo}`, {
        credentials: "include",
        headers: internalApiHeaders(),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as AnalyticsPayload);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar analytics");
      setData(null);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  const atualizarKpis = useCallback(async () => {
    setAtualizandoKpis(true);
    setKpiFeedback(null);
    try {
      const res = await fetch("/api/crm/kpis/calcular", {
        method: "POST",
        headers: internalApiHeaders(),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Falha ao calcular KPIs");
      }
      const j = (await res.json()) as { inseridos?: number };
      setKpiFeedback({
        tipo: "ok",
        msg: `KPIs atualizados (${j.inseridos ?? 6} medições gravadas).`,
      });
      window.setTimeout(() => setKpiFeedback(null), 3000);
      await carregar();
    } catch (e) {
      setKpiFeedback({
        tipo: "erro",
        msg: e instanceof Error ? e.message : "Erro ao atualizar KPIs",
      });
      window.setTimeout(() => setKpiFeedback(null), 3000);
    } finally {
      setAtualizandoKpis(false);
    }
  }, [carregar]);

  useEffect(() => {
    void carregarPipelines();
  }, [carregarPipelines]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (mercadoSelecionado) {
      void carregarFunilNegocios(mercadoSelecionado);
    }
  }, [periodo, mercadoSelecionado, carregarFunilNegocios]);

  useEffect(() => {
    setSlot({
      path: pathname,
      subtitle: `KPIs e tendências — ${periodoLabel(periodo)}`,
      actions: (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg p-0.5" style={{ background: "#eef7eb" }}>
            {ANALYTICS_PERIODOS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriodo(p.value)}
                className="rounded-md px-3 py-1.5 text-xs font-bold transition-colors"
                style={{
                  background: periodo === p.value ? "#dcebd8" : "transparent",
                  color: periodo === p.value ? "#0b2210" : "#5d7a67",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void atualizarKpis()}
            disabled={atualizandoKpis || carregando}
            className="flex items-center gap-1.5 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-1.5 text-xs font-bold text-[#0b2210] hover:bg-[#dcebd8] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${atualizandoKpis ? "animate-spin" : ""}`} />
            Atualizar KPIs
          </button>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, periodo, atualizarKpis, atualizandoKpis, carregando]);

  const activePipelineId =
    mercadoSelecionado != null
      ? (pipelines.find((p) => p.mercado_sigla?.toUpperCase() === mercadoSelecionado)?.id ?? null)
      : null;

  return (
    <div className="flex min-h-full flex-col bg-[#f8fcf6]">
      <div className="min-h-0 flex-1 px-3 py-4 sm:px-6 sm:py-6">
        {carregando && !data && (
          <div className="mt-12 text-center text-[#5d7a67]">Carregando métricas...</div>
        )}

        {kpiFeedback && (
          <div
            className={`mb-4 rounded-xl border p-3 text-sm font-semibold ${
              kpiFeedback.tipo === "ok"
                ? "border-[#23863666] bg-[#23863622] text-[#3fb950]"
                : "border-[#f8514966] bg-[#1a0a0a] text-[#ff7b72]"
            }`}
            role="status"
          >
            {kpiFeedback.msg}
          </div>
        )}

        {erro && (
          <div className="mb-4 rounded-xl border border-[#f8514966] bg-[#1a0a0a] p-4 text-sm text-[#ff7b72]">
            {erro}
            <button type="button" onClick={() => void carregar()} className="ml-3 text-xs underline">
              Tentar novamente
            </button>
          </div>
        )}

        {!carregando && !data && !erro && (
          <div className="mt-12 rounded-xl border border-[#dcebd8] bg-[#ffffff] p-8 text-center">
            <p className="font-bold text-[#0b2210]">Nenhum dado de analytics</p>
            <p className="mt-2 text-sm text-[#5d7a67]">
              Reinicie o servidor de desenvolvimento (porta 3001) para carregar o código atualizado.
            </p>
            <button
              type="button"
              onClick={() => void carregar()}
              className="mt-4 rounded-lg bg-[#c9a24a] px-4 py-2 text-xs font-bold text-[#f8fcf6]"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {data && (
          <div className="space-y-8">
            <SectionTitle>Comercial</SectionTitle>
            {data.kpis.length === 0 ? (
              <div className="rounded-xl border border-[#dcebd8] bg-[#ffffff] p-8 text-center">
                <p className="font-bold text-[#0b2210]">Sem histórico de KPIs neste período</p>
                <p className="mt-1 text-sm text-[#5d7a67]">
                  Use &quot;Atualizar KPIs&quot; para gravar as métricas do funil no histórico.
                </p>
                <button
                  type="button"
                  onClick={() => void atualizarKpis()}
                  className="mt-4 rounded-lg bg-[#c9a24a] px-4 py-2 text-xs font-bold text-[#f8fcf6]"
                >
                  Calcular agora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.kpis.map((kpi) => (
                  <KpiCardView key={kpi.slug} kpi={kpi} />
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-[#dcebd8] bg-[#ffffff] p-4 lg:col-span-1">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#5d7a67]">Funil de leads</p>
                <p className="mb-3 text-[10px] leading-snug text-[#6e7681]">
                  Distribuição actual por estágio (snapshot operacional, não taxa de conversão entre etapas).
                </p>
                <FunilOperacionalChart
                  items={data.funilLeads.map((f) => ({ label: f.label, count: f.count, color: f.color }))}
                />
              </div>
              <div className="rounded-xl border border-[#dcebd8] bg-[#ffffff] p-4 lg:col-span-1">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5d7a67]">
                  Funil de negócios
                  {mercadoSelecionado ? ` — ${mercadoSelecionado}` : ""}
                </p>
                {pipelines.length > 0 && (
                  <div className="mb-3">
                    <PipelineTabsBar
                      pipelines={pipelines}
                      activePipelineId={activePipelineId}
                      onSelect={onSelectPipeline}
                    />
                  </div>
                )}
                {mercadoSelecionado == null ? (
                  <p className="rounded-lg border border-dashed border-[#dcebd8] bg-[#f8fcf6] px-3 py-6 text-center text-xs text-[#5d7a67]">
                    Selecione um mercado para ver o funil de negócios conforme o pipeline PDF.
                  </p>
                ) : carregandoFunilNeg ? (
                  <p className="py-6 text-center text-xs text-[#5d7a67]">Carregando funil…</p>
                ) : erroFunilNeg ? (
                  <p className="rounded-lg border border-[#f8514966] bg-[#1a0a0a] px-3 py-4 text-center text-xs text-[#ff7b72]">
                    {erroFunilNeg}
                  </p>
                ) : (
                  <FunilOperacionalChart
                    items={funilNegocios.map((f) => ({
                      label: f.label,
                      count: f.count,
                      color: f.color,
                    }))}
                  />
                )}
              </div>
              <div className="lg:col-span-1">
                <CrmLeadsEntradaPeriodo pontos={data.leadsPorDia} periodo={periodo} />
              </div>
            </div>

            <SectionTitle>Atendimento</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricMini
                label="Fila pendente"
                value={data.atendimento.filaPendente}
                cor={data.atendimento.filaPendente > 5 ? "#f85149" : "#c9a24a"}
                href="/crm/leads"
              />
              <MetricMini
                label="Leads aguardando"
                value={data.atendimento.leadsAguardando}
                cor={data.atendimento.leadsAguardando > 0 ? "#d29922" : "#3fb950"}
                href="/crm/leads"
              />
              <MetricMini label="Agentes IA ativos" value={data.atendimento.agentesAtivos} cor="#60a5fa" href="/crm/agentes" />
              <MetricMini
                label="Aprovações pendentes"
                value={data.metricas.aprovacoesPendentes}
                cor={data.metricas.aprovacoesPendentes > 0 ? "#f85149" : "#3fb950"}
                href="/crm/aprovacoes"
              />
            </div>

            {CRM_MODULE_PARCEIROS_ENABLED ? (
            <>
            <SectionTitle>Parceiros</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <MetricMini label="Homologados" value={data.parceiros.homologados} cor="#60a5fa" href="/crm/parceiros" />
              <MetricMini
                label="Encaminhamentos"
                value={data.parceiros.encaminhamentosPeriodo}
                cor="#a78bfa"
                href="/crm/parceiros"
              />
              <MetricMini label="Taxa encaminhamento" value={`${data.parceiros.taxaEncaminhamento}%`} cor="#f59e0b" />
            </div>
            </>
            ) : null}

            <SectionTitle>Marketing</SectionTitle>
            {data.marketing ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricMini label="Gasto" value={moedaPipeline(data.marketing.spend)} cor="#ef4444" />
                <MetricMini label="Cliques" value={data.marketing.clicks} cor="#3b82f6" />
                <MetricMini label="CPC médio" value={moedaPipeline(data.marketing.cpc)} cor="#f97316" />
                <MetricMini label="Campanhas" value={data.marketing.campanhas} cor="#22c55e" href="/crm/trafego" />
              </div>
            ) : (
              <div className="rounded-xl border border-[#dcebd8] bg-[#ffffff] p-4 text-sm text-[#5d7a67]">
                Windsor.ai não configurado ou sem dados.{" "}
                <Link href="/crm/trafego" className="font-bold text-[#c9a24a] hover:underline">
                  Ver campanhas
                </Link>
              </div>
            )}

            <SectionTitle>Obras</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <MetricMini label="Em andamento" value={data.obras.emAndamento} cor="#22c55e" href="/crm/obras" />
              <MetricMini label="Pedidos material" value={data.obras.pedidosAbertos} cor="#eab308" href="/crm/pedidos" />
            </div>

            <SectionTitle>IA e automação</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <MetricMini
                label="KPIs críticos"
                value={data.ia.kpisCriticos}
                cor={data.ia.kpisCriticos > 0 ? "#f85149" : "#3fb950"}
              />
              <MetricMini
                label="Ciclos com erro"
                value={data.ia.ciclosComFalha}
                cor={data.ia.ciclosComFalha > 0 ? "#f85149" : "#3fb950"}
                href="/crm/ciclos"
              />
              <MetricMini label="Leads hoje" value={data.metricas.leadsHoje} cor="#c9a24a" href="/crm/leads" />
            </div>

            {data.ia.observacoesMl.length > 0 && (
              <div className="rounded-xl border border-[#dcebd8] bg-[#ffffff] p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#5d7a67]">Observações ML</p>
                <ul className="space-y-2">
                  {data.ia.observacoesMl.map((o, i) => (
                    <li key={i} className="border-b border-[#eef7eb] pb-2 text-sm last:border-0">
                      <span className="text-[10px] font-bold uppercase text-[#c9a24a]">{o.tipo}</span>
                      <p className="text-[#0b2210]">{o.descricao}</p>
                      {o.amostras > 0 && (
                        <p className="text-xs text-[#6e7681]">{o.amostras} amostras</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.alertas.length > 0 && (
              <>
                <SectionTitle>Alertas</SectionTitle>
                <div className="space-y-2">
                  {data.alertas.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-[#dcebd8] bg-[#ffffff] px-3 py-2"
                    >
                      <span className="text-sm text-[#0b2210]">{a.titulo}</span>
                      <span className="text-[10px] font-bold uppercase text-[#5d7a67]">{a.nivel}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {data.ultimosResultados.length > 0 && (
              <>
                <SectionTitle>Histórico de medições</SectionTitle>
                <div className="overflow-hidden rounded-xl border border-[#dcebd8]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#ffffff] text-left text-[10px] uppercase text-[#5d7a67]">
                        <th className="px-3 py-2">KPI</th>
                        <th className="px-3 py-2">Valor</th>
                        <th className="px-3 py-2">Alerta</th>
                        <th className="px-3 py-2">Quando</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ultimosResultados.map((r, i) => (
                        <tr key={i} className="border-t border-[#eef7eb] text-[#0b2210]">
                          <td className="px-3 py-2 font-mono text-xs">{r.kpi_slug}</td>
                          <td className="px-3 py-2">{r.valor_medido}</td>
                          <td className="px-3 py-2">{r.nivel_alerta}</td>
                          <td className="px-3 py-2 text-xs text-[#5d7a67]">
                            {new Date(r.criado_em).toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

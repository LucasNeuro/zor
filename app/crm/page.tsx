"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, UserPlus } from "lucide-react";
import { CrmAcaoAgora } from "@/components/crm/CrmAcaoAgora";
import { CrmAlertasStrip } from "@/components/crm/CrmAlertasStrip";
import { CrmEquipeResumo } from "@/components/crm/CrmEquipeResumo";
import { CrmMetricCard, CrmSectionTitle } from "@/components/crm/CrmMetricCard";
import { CrmOperacaoResumo } from "@/components/crm/CrmOperacaoResumo";
import { CrmPipelineResumo } from "@/components/crm/CrmPipelineResumo";
import { CrmUltimosLeads } from "@/components/crm/CrmUltimosLeads";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { useAgentes } from "@/hooks/useAgentes";
import { useCrmDashboard } from "@/hooks/useCrmDashboard";
import { moedaPipeline } from "@/lib/crm/pipeline-funil";

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;
  const dash = useCrmDashboard();
  const { agentes, loading: loadingAgentes } = useAgentes();
  const m = dash;

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      actions: (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/crm/analytics"
            className="flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-xs font-bold text-[#e6edf3] transition-colors hover:border-[#c9a24a55] hover:text-[#c9a24a]"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Ver tendências
          </Link>
          <button
            type="button"
            onClick={() => router.push("/crm/leads")}
            className="flex items-center gap-1.5 rounded-lg border border-[#c9a24a44] bg-[#003b2622] px-3 py-1.5 text-xs font-bold text-[#c9a24a] hover:bg-[#003b2640]"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Leads
          </button>
          <button
            type="button"
            onClick={() => router.push("/crm/parceiros/novo")}
            className="rounded-lg border border-[#30363d] px-3 py-1.5 text-xs font-bold text-[#60a5fa] hover:bg-[#21262d]"
          >
            + Parceiro
          </button>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, router, isMobile]);

  const receita =
    m.receitaPotencial > 0 ? moedaPipeline(m.receitaPotencial) : "R$0";

  const hoje = [
    {
      label: "Encaminhamentos hoje",
      valor: m.encaminhamentosHoje,
      sub: "rede de parceiros",
      cor: "#a78bfa",
      rota: "/crm/parceiros",
    },
    {
      label: "Modelos IA ativos",
      valor: m.agentesAtivos,
      sub: "agentes no hub",
      cor: "#60a5fa",
      rota: "/crm/agentes",
    },
  ];

  const saude = [
    {
      label: "Taxa qualificação",
      valor: `${m.taxaQualificacao}%`,
      sub: "do total de leads",
      cor: "#34d399",
      rota: "/crm/leads",
    },
    {
      label: "Taxa encaminhamento",
      valor: `${m.taxaEncaminhamento}%`,
      sub: "leads com encaminhamento",
      cor: "#f59e0b",
      rota: "/crm/parceiros",
    },
    {
      label: "Parceiros ativos",
      valor: m.parceirosAtivos,
      sub: "homologados",
      cor: "#60a5fa",
      rota: "/crm/parceiros",
    },
    {
      label: "Receita potencial",
      valor: receita,
      sub: "pipeline em aberto",
      cor: "#c9a24a",
      rota: "/crm/leads",
    },
  ];

  const dataHoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className={`bg-[#0d1117] ${isMobile ? "min-h-0 p-3 pb-6" : "min-h-screen p-4 sm:p-6"}`}>
      {isMobile && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-[#e6edf3]">Pulso</h1>
            <p className="text-xs capitalize text-[#8b949e]">{dataHoje}</p>
          </div>
          <Link
            href="/crm/analytics"
            className="flex min-h-11 items-center gap-1 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-xs font-bold text-[#c9a24a]"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Tendências
          </Link>
        </div>
      )}
      {dash.erro && (
        <div
          className="mb-4 rounded-xl border border-[#f8514966] bg-[#1a0a0a] px-4 py-3 text-sm text-[#ff7b72]"
          role="alert"
        >
          {dash.erro}
          <button
            type="button"
            onClick={() => dash.recarregar()}
            className="ml-2 text-xs font-bold underline"
          >
            Tentar novamente
          </button>
        </div>
      )}
      <CrmAcaoAgora m={m} loading={m.loading} indisponivel={!!dash.erro && !dash.carregado} />
      <CrmPipelineResumo />
      <CrmAlertasStrip alertas={dash.alertas} loading={dash.loading} />
      <CrmUltimosLeads leads={dash.leadsRecentes} loading={dash.loading} />
      <CrmOperacaoResumo operacao={dash.operacao} loading={dash.loading} />

      <CrmSectionTitle>Hoje</CrmSectionTitle>
      <div className="mb-6 grid grid-cols-2 gap-2">
        {hoje.map((c) => (
          <CrmMetricCard
            key={c.label}
            label={c.label}
            valor={c.valor}
            sub={c.sub}
            cor={c.cor}
            loading={m.loading}
            onClick={() => router.push(c.rota)}
          />
        ))}
      </div>

      <CrmSectionTitle>Saúde comercial</CrmSectionTitle>
      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {saude.map((c) => (
          <CrmMetricCard
            key={c.label}
            label={c.label}
            valor={c.valor}
            sub={c.sub}
            cor={c.cor}
            loading={m.loading}
            onClick={() => router.push(c.rota)}
          />
        ))}
      </div>

      <CrmEquipeResumo agentes={agentes} ciclos={dash.ciclos} loading={loadingAgentes || dash.loading} />
    </div>
  );
}

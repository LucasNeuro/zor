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
            className="flex items-center gap-1.5 rounded-lg border border-[#dcebd8] bg-white px-3 py-1.5 text-xs font-bold text-[#0b2210] transition-colors hover:border-[#3f9848] hover:text-[#3f9848]"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Ver tendências
          </Link>
          <button
            type="button"
            onClick={() => router.push("/crm/leads")}
            className="flex items-center gap-1.5 rounded-lg border border-[#3f984844] bg-[#3f984814] px-3 py-1.5 text-xs font-bold text-[#2d7a36] hover:bg-[#3f984828]"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Leads
          </button>
          <button
            type="button"
            onClick={() => router.push("/crm/parceiros/novo")}
            className="rounded-lg border border-[#dcebd8] px-3 py-1.5 text-xs font-bold text-[#2563eb] hover:bg-[#eef7eb]"
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
    <div
      className={`bg-[#f8fcf6] ${isMobile ? "min-h-0 px-3 pb-6 pt-1" : "min-h-screen px-4 py-5 sm:px-6 sm:py-6"}`}
    >
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        {isMobile && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#dcebd8] bg-white px-3.5 py-3 shadow-sm">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#0b2210]">Dashboard</h1>
              <p className="text-xs capitalize text-[#5d7a67]">{dataHoje}</p>
            </div>
            <Link
              href="/crm/analytics"
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-[#dcebd8] bg-[#eef7eb] px-3 text-xs font-bold text-[#3f9848]"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Tendências
            </Link>
          </div>
        )}

        {dash.erro && (
          <div
            className="rounded-2xl border border-[#f8514966] bg-[#1a0a0a] px-4 py-3 text-sm text-[#ff7b72]"
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

        <div className="grid gap-6 xl:grid-cols-2">
          <CrmUltimosLeads leads={dash.leadsRecentes} loading={dash.loading} />
          <CrmOperacaoResumo operacao={dash.operacao} loading={dash.loading} />
        </div>

        <div>
          <CrmSectionTitle>Hoje</CrmSectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
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
        </div>

        <div>
          <CrmSectionTitle>Saúde comercial</CrmSectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        </div>

        <CrmEquipeResumo agentes={agentes} ciclos={dash.ciclos} loading={loadingAgentes || dash.loading} />
      </div>
    </div>
  );
}

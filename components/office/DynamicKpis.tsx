"use client";

interface Kpi {
  label: string;
  value: string;
  delta?: string;
  up?: boolean;
  color?: string;
}

const KPI_MAP: Record<string, Kpi[]> = {
  geral: [
    { label: "Leads Hoje", value: "62", delta: "+8", up: true, color: "#22c55e" },
    { label: "Qualificados", value: "24", delta: "+3", up: true, color: "#60a5fa" },
    { label: "Match Rate", value: "87%", delta: "+2%", up: true, color: "#a78bfa" },
    { label: "ROAS", value: "4.1x", delta: "+0.3x", up: true, color: "#f59e0b" },
    { label: "Críticos", value: "3", delta: "+1", up: false, color: "#ef4444" },
    { label: "Receita Hoje", value: "R$42k", delta: "+R$7k", up: true, color: "#34d399" },
  ],
  atendimento: [
    { label: "Em Atendimento", value: "18", delta: "+4", up: true, color: "#22c55e" },
    { label: "SLA Médio", value: "4.2 min", delta: "-0.8", up: true, color: "#60a5fa" },
    { label: "Satisfação", value: "9.1/10", delta: "+0.2", up: true, color: "#a78bfa" },
    { label: "Escalados", value: "2", delta: "-1", up: true, color: "#f59e0b" },
    { label: "Conversão", value: "68%", delta: "+5%", up: true, color: "#34d399" },
    { label: "Aguardando", value: "5", delta: "+2", up: false, color: "#ef4444" },
  ],
  trafego: [
    { label: "CPL Meta", value: "R$184", delta: "-R$12", up: true, color: "#22c55e" },
    { label: "CPL Google", value: "R$210", delta: "+R$8", up: false, color: "#ef4444" },
    { label: "Impressões", value: "128k", delta: "+22k", up: true, color: "#60a5fa" },
    { label: "CTR", value: "3.8%", delta: "+0.4%", up: true, color: "#a78bfa" },
    { label: "Gasto Hoje", value: "R$3.2k", delta: "", color: "#f59e0b" },
    { label: "ROAS", value: "4.1x", delta: "+0.3x", up: true, color: "#34d399" },
  ],
  conteudo: [
    { label: "Peças Hoje", value: "14", delta: "+3", up: true, color: "#22c55e" },
    { label: "Em Produção", value: "7", delta: "", color: "#60a5fa" },
    { label: "Aprovadas", value: "9", delta: "+2", up: true, color: "#a78bfa" },
    { label: "Pendentes", value: "5", delta: "+1", up: false, color: "#f59e0b" },
    { label: "Publicadas", value: "6", delta: "+1", up: true, color: "#34d399" },
    { label: "Reprovadas", value: "1", delta: "", color: "#ef4444" },
  ],
  sites: [
    { label: "Uptime", value: "99.9%", delta: "", color: "#22c55e" },
    { label: "Deploy Hoje", value: "3", delta: "+1", up: true, color: "#60a5fa" },
    { label: "Bugs Abertos", value: "2", delta: "-3", up: true, color: "#a78bfa" },
    { label: "Velocidade", value: "94/100", delta: "+2", up: true, color: "#f59e0b" },
    { label: "Visitas Hoje", value: "1.2k", delta: "+180", up: true, color: "#34d399" },
    { label: "Conversão Site", value: "4.2%", delta: "+0.3%", up: true, color: "#ef4444" },
  ],
  agentes: [
    { label: "Online", value: "18", delta: "", color: "#22c55e" },
    { label: "Trabalhando", value: "12", delta: "", color: "#60a5fa" },
    { label: "Em Reunião", value: "4", delta: "", color: "#a78bfa" },
    { label: "Celebrando", value: "1", delta: "", color: "#f59e0b" },
    { label: "Mensagens/h", value: "340", delta: "+22", up: true, color: "#34d399" },
    { label: "Tarefas/dia", value: "187", delta: "+14", up: true, color: "#ef4444" },
  ],
  governanca: [
    { label: "Aprovações", value: "5", delta: "+2", up: false, color: "#ef4444" },
    { label: "Gargalos", value: "2", delta: "-1", up: true, color: "#f59e0b" },
    { label: "Compliance", value: "98%", delta: "+1%", up: true, color: "#22c55e" },
    { label: "Custo IA/dia", value: "R$8,40", delta: "-R$1,20", up: true, color: "#60a5fa" },
    { label: "Alertas", value: "3", delta: "+1", up: false, color: "#a78bfa" },
    { label: "Decisões", value: "12", delta: "", color: "#34d399" },
  ],
  relatorios: [
    { label: "Relatórios", value: "8", delta: "+2", up: true, color: "#22c55e" },
    { label: "Exportados", value: "3", delta: "", color: "#60a5fa" },
    { label: "Pendentes", value: "2", delta: "", color: "#f59e0b" },
    { label: "Receita Mês", value: "R$284k", delta: "+R$32k", up: true, color: "#34d399" },
    { label: "Meta Mês", value: "72%", delta: "+8%", up: true, color: "#a78bfa" },
    { label: "Previsão", value: "R$390k", delta: "", color: "#ef4444" },
  ],
};

interface DynamicKpisProps {
  visao: string;
}

export function DynamicKpis({ visao }: DynamicKpisProps) {
  const kpis = KPI_MAP[visao] ?? KPI_MAP.geral;

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 bg-gray-950 border-b border-gray-800 flex-shrink-0 overflow-x-auto">
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className="flex-shrink-0 flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-1.5 min-w-[110px]"
        >
          <div>
            <div className="text-gray-500 text-[10px] leading-tight">{kpi.label}</div>
            <div className="text-white text-sm font-bold leading-tight" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
          </div>
          {kpi.delta && (
            <div className={`text-[10px] font-medium ml-auto ${kpi.up === false ? "text-red-400" : "text-green-400"}`}>
              {kpi.delta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

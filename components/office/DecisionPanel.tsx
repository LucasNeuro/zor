"use client";
import { useState } from "react";

type Tab = "decisoes" | "crm" | "aprovacoes" | "gargalos" | "alertas";

interface DecisaoItem {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "urgente" | "normal" | "info";
  agente?: string;
  valor?: number;
  tempo: string;
}

const DECISOES: DecisaoItem[] = [
  { id: "d1", titulo: "Aprovar proposta #312", descricao: "Reforma alto padrão R$280k — cliente aguarda 2h", tipo: "urgente", agente: "Ariane", valor: 280000, tempo: "2h" },
  { id: "d2", titulo: "Pausar conjunto Meta B", descricao: "CPL 65% acima da meta — ROAS caindo", tipo: "urgente", agente: "IA Tráfego", tempo: "1h 10min" },
  { id: "d3", titulo: "Validar copy Instagram", descricao: "Copy Alpha gerou peça para campanha verão", tipo: "normal", agente: "Copy Alpha", tempo: "30min" },
  { id: "d4", titulo: "Aprovar budget extra", descricao: "SDR solicita R$2.000 para Google Ads esta semana", tipo: "normal", agente: "SDR IA", valor: 2000, tempo: "45min" },
];

const CRM_ITEMS = [
  { id: "l1", nome: "Carlos Mendes", fase: "Qualificação", valor: 120000, tempo: "8min", status: "quente" as const },
  { id: "l2", nome: "Ana Ferreira", fase: "Proposta", valor: 280000, tempo: "2h", status: "normal" as const },
  { id: "l3", nome: "Roberto Silva", fase: "Entrada", valor: 45000, tempo: "22min", status: "frio" as const },
  { id: "l4", nome: "Marina Costa", fase: "Negociação", valor: 650000, tempo: "5min", status: "quente" as const },
];

const APROVACOES = [
  { id: "a1", item: "Copy campanha verão", solicitante: "Copy Alpha", tipo: "Conteúdo", tempo: "10min" },
  { id: "a2", item: "Landing page reforma", solicitante: "Dev IA", tipo: "Site", tempo: "1h" },
  { id: "a3", item: "Script follow-up D+3", solicitante: "SDR IA", tipo: "Atendimento", tempo: "25min" },
];

const GARGALOS = [
  { id: "g1", titulo: "Aprovação manual bloqueando", descricao: "3 peças aguardando há mais de 1h", area: "Conteúdo", impacto: "alto" as const },
  { id: "g2", titulo: "Budget esgotando", descricao: "Campanha Google com 90% do budget consumido", area: "Tráfego", impacto: "medio" as const },
];

const ALERTAS = [
  { id: "al1", msg: "Lead #247 sem resposta há 22min — SLA estourado", tipo: "critico" as const },
  { id: "al2", msg: "ROAS Meta Ads caiu para 2.8x (meta: 3.5x)", tipo: "atencao" as const },
  { id: "al3", msg: "Ariane processou 340 msgs hoje — recorde", tipo: "info" as const },
  { id: "al4", msg: "Novo lead alto valor: Construtora ABC R$1.2M", tipo: "info" as const },
];

const STATUS_COR = { quente: "#ef4444", normal: "#f59e0b", frio: "#60a5fa" };

export function DecisionPanel() {
  const [tab, setTab] = useState<Tab>("decisoes");
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set());

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "decisoes", label: "Decisões", count: DECISOES.length },
    { id: "crm", label: "CRM", count: CRM_ITEMS.length },
    { id: "aprovacoes", label: "Aprovações", count: APROVACOES.length },
    { id: "gargalos", label: "Gargalos", count: GARGALOS.length },
    { id: "alertas", label: "Alertas", count: ALERTAS.length },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800 flex-shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors border-b-2 ${
              tab === t.id
                ? "text-orange-400 border-orange-500"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[10px] rounded-full px-1 py-0.5 min-w-[16px] text-center font-bold ${
                tab === t.id ? "bg-orange-500/20 text-orange-400" : "bg-gray-800 text-gray-500"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "decisoes" && (
          <div>
            {DECISOES.filter(d => !ignorados.has(d.id)).map(d => (
              <div key={d.id} className="px-4 py-3 border-b border-gray-800/50 last:border-0">
                <div className="flex items-start gap-2 mb-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${d.tipo === "urgente" ? "bg-red-500 animate-pulse" : "bg-yellow-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-medium leading-tight">{d.titulo}</div>
                    <div className="text-gray-400 text-[11px] mt-0.5 leading-relaxed">{d.descricao}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {d.agente && <span className="text-gray-500 text-[10px]">{d.agente}</span>}
                      <span className="text-gray-600 text-[10px]">·</span>
                      <span className="text-gray-500 text-[10px]">{d.tempo}</span>
                      {d.valor && <span className="text-orange-400 text-[10px] font-medium ml-auto">R${(d.valor/1000).toFixed(0)}k</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-green-600/20 hover:bg-green-600/40 border border-green-600/30 text-green-400 text-[10px] font-medium rounded py-1 transition-colors">
                    Aprovar
                  </button>
                  <button
                    onClick={() => setIgnorados(s => new Set([...s, d.id]))}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-[10px] rounded py-1 transition-colors"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            ))}
            {DECISOES.filter(d => !ignorados.has(d.id)).length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                <div className="text-2xl mb-2">✓</div>
                <div className="text-xs">Tudo resolvido</div>
              </div>
            )}
          </div>
        )}

        {tab === "crm" && (
          <div>
            {CRM_ITEMS.map(l => (
              <div key={l.id} className="px-4 py-3 border-b border-gray-800/50 last:border-0 hover:bg-gray-900/50 cursor-pointer transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-xs font-medium">{l.nome}</span>
                  <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COR[l.status] }} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-[11px]">{l.fase}</span>
                  <span className="text-gray-600 text-[10px]">·</span>
                  <span className="text-orange-400 text-[11px] font-medium">R${(l.valor/1000).toFixed(0)}k</span>
                  <span className="text-gray-600 text-[10px] ml-auto">{l.tempo}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "aprovacoes" && (
          <div>
            {APROVACOES.map(a => (
              <div key={a.id} className="px-4 py-3 border-b border-gray-800/50 last:border-0">
                <div className="text-white text-xs font-medium mb-0.5">{a.item}</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-400 text-[11px]">{a.solicitante}</span>
                  <span className="bg-gray-800 text-gray-400 text-[10px] rounded px-1.5 py-0.5">{a.tipo}</span>
                  <span className="text-gray-600 text-[10px] ml-auto">{a.tempo}</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-green-600/20 hover:bg-green-600/40 border border-green-600/30 text-green-400 text-[10px] font-medium rounded py-1 transition-colors">
                    Aprovar
                  </button>
                  <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-[10px] rounded py-1 transition-colors">
                    Reprovar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "gargalos" && (
          <div>
            {GARGALOS.map(g => (
              <div key={g.id} className="px-4 py-3 border-b border-gray-800/50 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${g.impacto === "alto" ? "bg-red-500" : "bg-yellow-500"}`} />
                  <span className="text-white text-xs font-medium">{g.titulo}</span>
                </div>
                <div className="text-gray-400 text-[11px] mb-1">{g.descricao}</div>
                <span className="bg-gray-800 text-gray-400 text-[10px] rounded px-1.5 py-0.5">{g.area}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "alertas" && (
          <div>
            {ALERTAS.map(a => (
              <div key={a.id} className="px-4 py-3 border-b border-gray-800/50 last:border-0 flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  a.tipo === "critico" ? "bg-red-500 animate-pulse" :
                  a.tipo === "atencao" ? "bg-yellow-500" : "bg-blue-500"
                }`} />
                <span className="text-gray-300 text-[11px] leading-relaxed">{a.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

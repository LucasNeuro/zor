"use client";
import { useState, useMemo } from "react";
import agentsData from "@/lib/data/agents-mock.json";
import { type Agent } from "@/components/office/OfficeCanvas";

const agents: Agent[] = agentsData.agents as Agent[];

type FiltroAgente = "todos" | "humanos" | "ias" | "produzindo" | "aguardando" | "travados";

const isIA = (agent: Agent) =>
  /\bIA\b|Alpha|Beta|Gamma/i.test(agent.nome) || agent.avatar?.startsWith("/");

interface AgentsDrawerProps {
  aberto: boolean;
  onFechar: () => void;
  onAgenteClick?: (agent: Agent) => void;
}

const FILTROS: { id: FiltroAgente; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "humanos", label: "Humanos" },
  { id: "ias", label: "IAs" },
  { id: "produzindo", label: "Produzindo" },
  { id: "aguardando", label: "Aguardando" },
  { id: "travados", label: "Travados" },
];

const AREA_COR: Record<string, string> = {
  Marketing: "#22c55e", Executivo: "#f59e0b", Estratégia: "#60a5fa",
  Conteúdo: "#a78bfa", Design: "#f472b6", Performance: "#34d399",
  Atendimento: "#06b6d4", Comercial: "#fb923c",
};

export function AgentsDrawer({ aberto, onFechar, onAgenteClick }: AgentsDrawerProps) {
  const [filtro, setFiltro] = useState<FiltroAgente>("todos");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    let list = agents;
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(a => a.nome.toLowerCase().includes(q) || a.funcao.toLowerCase().includes(q) || a.area.toLowerCase().includes(q));
    }
    switch (filtro) {
      case "humanos": return list.filter(a => !isIA(a));
      case "ias": return list.filter(a => isIA(a));
      case "produzindo": return list.filter(a => a.status?.online);
      case "aguardando": return list.filter(a => !a.status?.online);
      case "travados": return list.filter(a => a.currentActivity?.includes("aguardando") || a.currentActivity?.includes("bloqueado"));
      default: return list;
    }
  }, [filtro, busca]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex justify-end"
      onClick={onFechar}
    >
      <div
        className="w-80 h-full bg-gray-950 border-l border-gray-800 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <div>
            <div className="text-white font-bold text-sm">Agentes em Operação</div>
            <div className="text-gray-500 text-xs mt-0.5">{agents.filter(a => a.status?.online).length} online · {agents.length} total</div>
          </div>
          <button onClick={onFechar} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-800 flex-shrink-0">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar agente..."
            className="w-full bg-gray-900 text-white text-xs rounded-lg px-3 py-2 outline-none border border-gray-700 focus:border-orange-500 placeholder-gray-600"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-1 px-4 py-2 border-b border-gray-800 flex-shrink-0 overflow-x-auto">
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`flex-shrink-0 text-[10px] rounded-full px-2.5 py-1 transition-colors font-medium ${
                filtro === f.id
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-gray-900 text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtrados.map(agent => {
            const isOnline = agent.status?.online;
            const cor = AREA_COR[agent.area] ?? "#6b7280";
            const isAriane = agent.avatar?.startsWith("/");
            return (
              <div
                key={agent.id}
                onClick={() => onAgenteClick?.(agent)}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer transition-colors"
                style={{ opacity: isOnline ? 1 : 0.5 }}
              >
                {isAriane ? (
                  <img src={agent.avatar} alt={agent.nome} className="w-8 h-10 object-contain flex-shrink-0" />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: `${cor}20`, border: `2px solid ${isOnline ? cor : "#4b5563"}` }}
                  >
                    {agent.avatar}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{agent.nome}</div>
                  <div className="text-gray-500 text-[11px] truncate">{agent.funcao}</div>
                  {agent.currentActivity && (
                    <div className="text-gray-600 text-[10px] truncate mt-0.5">{agent.currentActivity}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: isOnline ? "#10b981" : "#4b5563", boxShadow: isOnline ? "0 0 6px #10b981" : "none" }}
                  />
                  <span className="text-[9px] font-medium" style={{ color: isOnline ? "#10b981" : "#6b7280" }}>
                    {isOnline ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
              </div>
            );
          })}
          {filtrados.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600">
              <div className="text-2xl mb-2">🔍</div>
              <div className="text-xs">Nenhum agente encontrado</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
          <a
            href="/agentes"
            className="block w-full text-center bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 text-orange-400 text-xs font-medium rounded-lg py-2 transition-colors"
          >
            Configurar Agentes →
          </a>
        </div>
      </div>
    </div>
  );
}

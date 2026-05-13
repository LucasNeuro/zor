"use client";
import { useEffect, useMemo, useState } from "react";
import { type Agent } from "@/components/office/OfficeCanvas";
import { internalApiHeaders } from "@/lib/internal-api-headers";

const NIVEIS = [
  { nivel: 1, label: "Sugestão apenas", desc: "IA sugere, humano executa tudo" },
  { nivel: 2, label: "Semi-autônomo", desc: "IA executa tarefas simples, escala complexas" },
  { nivel: 3, label: "Autônomo supervisionado", desc: "IA age livremente mas notifica tudo" },
  { nivel: 4, label: "Autônomo pleno", desc: "IA age e reporta apenas resultados" },
  { nivel: 5, label: "Fully agentic", desc: "IA gerencia outras IAs autonomamente" },
];

const MODELOS = ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7", "gpt-4o", "gpt-4o-mini"];

interface AgenteConfig {
  autonomia: number;
  modelo: string;
  canSendMessages: boolean;
  canEditContent: boolean;
  canSpendBudget: boolean;
  canEscalate: boolean;
  ativo: boolean;
}

const defaultConfig = (): AgenteConfig => ({
  autonomia: 3,
  modelo: "claude-haiku-4-5",
  canSendMessages: true,
  canEditContent: true,
  canSpendBudget: false,
  canEscalate: true,
  ativo: true,
});

const AREA_COR: Record<string, string> = {
  Marketing: "#22c55e", Executivo: "#f59e0b", Estratégia: "#60a5fa",
  Conteúdo: "#a78bfa", Design: "#f472b6", Performance: "#34d399",
  Atendimento: "#06b6d4", Comercial: "#fb923c",
};

type AgenteApi = {
  agente_slug: string;
  nome: string;
  cargo: string;
  area: string | null;
  nivel: number | null;
  ativo: boolean | null;
  modelo_padrao?: string | null;
};

function initials(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("") || "IA";
}

function mapAgente(row: AgenteApi): Agent {
  const area = row.area || "Geral";
  return {
    id: row.agente_slug,
    nome: row.nome,
    avatar: initials(row.nome),
    funcao: row.cargo,
    area,
    sala: area,
    posicao: { x: 0, y: 0 },
    perfil: {
      humor: "operacional",
      personalidade: "profissional",
      tom_comunicacao: "profissional",
      estilo_trabalho: "orientado a dados",
    },
    status: { online: row.ativo !== false, modo: row.ativo === false ? "inativo" : "operando" },
    tarefas: { ativas: 0, concluidas_hoje: 0 },
    governanca: { nivel: String(row.nivel ?? 3), score: row.ativo === false ? 50 : 90 },
    currentActivity: row.ativo === false ? "Agente inativo" : "Sincronizado com hub_agente_identidade",
  };
}

export default function AgentesPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, AgenteConfig>>(
    {}
  );
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    fetch("/api/hub/agentes", { headers: internalApiHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Falha ao carregar agentes (${res.status})`);
        return (await res.json()) as AgenteApi[];
      })
      .then((rows) => {
        if (!ativo) return;
        const mapped = rows.map(mapAgente);
        setAgents(mapped);
        setConfigs(Object.fromEntries(mapped.map((a) => [a.id, defaultConfig()])));
        setSelecionado((atual) => atual ?? mapped[0]?.id ?? null);
        setErro(null);
      })
      .catch((error) => {
        if (!ativo) return;
        setErro(error instanceof Error ? error.message : "Erro ao carregar agentes");
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const agent = useMemo(() => agents.find(a => a.id === selecionado), [agents, selecionado]);
  const cfg = selecionado ? configs[selecionado] : null;

  function update(field: keyof AgenteConfig, value: AgenteConfig[keyof AgenteConfig]) {
    if (!selecionado) return;
    setConfigs(prev => ({ ...prev, [selecionado]: { ...prev[selecionado], [field]: value } }));
  }

  function salvar() {
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <a href="/office" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Office</a>
          <span className="text-gray-700">/</span>
          <span className="text-white font-bold text-sm">Configuração de Agentes</span>
        </div>
        <button
          onClick={salvar}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            salvo
              ? "bg-green-600 text-white"
              : "bg-orange-500 hover:bg-orange-400 text-white"
          }`}
        >
          {salvo ? "✓ Salvo!" : "Salvar configurações"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — lista de agentes */}
        <div className="w-64 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-xs text-gray-500">Carregando agentes do Supabase...</div>
          )}
          {erro && (
            <div className="px-4 py-6 text-xs text-red-400">{erro}</div>
          )}
          {!loading && !erro && agents.map(a => {
            const isSelected = a.id === selecionado;
            const cor = AREA_COR[a.area] ?? "#6b7280";
            const isAriane = a.avatar?.startsWith("/");
            const acfg = configs[a.id];
            return (
              <button
                key={a.id}
                onClick={() => setSelecionado(a.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 text-left transition-colors ${
                  isSelected ? "bg-orange-500/10 border-l-2 border-l-orange-500" : "hover:bg-gray-900"
                }`}
              >
                {isAriane ? (
                  <img src={a.avatar} alt={a.nome} className="w-7 h-9 object-contain flex-shrink-0" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: `${cor}20`, border: `2px solid ${acfg?.ativo ? cor : "#4b5563"}` }}
                  >
                    {a.avatar}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{a.nome}</div>
                  <div className="text-gray-500 text-[10px] truncate">{a.funcao}</div>
                </div>
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: acfg?.ativo ? "#10b981" : "#4b5563" }}
                />
              </button>
            );
          })}
        </div>

        {/* Main — configuração do agente selecionado */}
        {agent && cfg ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto space-y-6">
              {/* Identity */}
              <div className="flex items-center gap-4">
                {agent.avatar?.startsWith("/") ? (
                  <img src={agent.avatar} alt={agent.nome} className="w-16 h-20 object-contain" />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                    style={{ background: `${AREA_COR[agent.area] ?? "#6b7280"}30`, border: `3px solid ${AREA_COR[agent.area] ?? "#6b7280"}` }}
                  >
                    {agent.avatar}
                  </div>
                )}
                <div>
                  <div className="text-white text-xl font-bold">{agent.nome}</div>
                  <div className="text-gray-400 text-sm">{agent.funcao}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] bg-gray-800 text-gray-400 rounded px-2 py-0.5">{agent.area}</span>
                    <span className="text-[10px] bg-gray-800 text-gray-400 rounded px-2 py-0.5">{agent.sala}</span>
                  </div>
                </div>
                <div className="ml-auto flex flex-col items-end gap-2">
                  <span className="text-gray-400 text-xs">Ativo</span>
                  <button
                    onClick={() => update("ativo", !cfg.ativo)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${cfg.ativo ? "bg-green-500" : "bg-gray-700"}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${cfg.ativo ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              </div>

              {/* Autonomia */}
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="text-white font-semibold text-sm mb-1">Nível de Autonomia</div>
                <div className="text-gray-400 text-xs mb-4">
                  {NIVEIS[cfg.autonomia - 1]?.label} — {NIVEIS[cfg.autonomia - 1]?.desc}
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={cfg.autonomia}
                  onChange={e => update("autonomia", Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between mt-1">
                  {NIVEIS.map(n => (
                    <span
                      key={n.nivel}
                      className={`text-[10px] ${cfg.autonomia === n.nivel ? "text-orange-400 font-bold" : "text-gray-600"}`}
                    >
                      {n.nivel}
                    </span>
                  ))}
                </div>
              </div>

              {/* Modelo */}
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="text-white font-semibold text-sm mb-3">Modelo de IA</div>
                <div className="grid grid-cols-2 gap-2">
                  {MODELOS.map(m => (
                    <button
                      key={m}
                      onClick={() => update("modelo", m)}
                      className={`text-xs rounded-lg px-3 py-2 text-left transition-colors ${
                        cfg.modelo === m
                          ? "bg-orange-500/20 border border-orange-500/40 text-orange-400"
                          : "bg-gray-800 hover:bg-gray-700 text-gray-400 border border-transparent"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissões */}
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="text-white font-semibold text-sm mb-4">Permissões</div>
                <div className="space-y-3">
                  {([
                    ["canSendMessages", "Enviar mensagens para leads"],
                    ["canEditContent", "Editar e publicar conteúdo"],
                    ["canSpendBudget", "Movimentar budget de campanhas"],
                    ["canEscalate", "Escalar para humanos"],
                  ] as [keyof AgenteConfig, string][]).map(([field, label]) => (
                    <div key={field} className="flex items-center justify-between">
                      <span className="text-gray-300 text-xs">{label}</span>
                      <button
                        onClick={() => update(field, !cfg[field])}
                        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${cfg[field] ? "bg-orange-500" : "bg-gray-700"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${cfg[field] ? "left-5" : "left-0.5"}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            Selecione um agente para configurar
          </div>
        )}
      </div>
    </div>
  );
}

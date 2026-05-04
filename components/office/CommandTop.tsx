"use client";
import { useState, useEffect } from "react";

interface CommandTopProps {
  visao: string;
  onResolverAgora: () => void;
  onAbrirAgentes: () => void;
  onModoTV: () => void;
  modoTV: boolean;
}

const EVENTOS_AO_VIVO = [
  "CRM disparando follow-ups automáticos",
  "Ariane qualificou Lead #250 — R$650k",
  "SDR IA iniciou atendimento via WhatsApp",
  "Copy Alpha concluiu peça para Meta Ads",
  "Lead #247 aguarda resposta há 14 min",
  "Campanha Meta Ads acima do CPL meta",
  "Reunião agendada com cliente Reforma Alto Padrão",
  "IA recomendou pausa no conjunto B",
];

export function CommandTop({ visao, onResolverAgora, onAbrirAgentes, onModoTV, modoTV }: CommandTopProps) {
  const [eventoIndex, setEventoIndex] = useState(0);
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setEventoIndex(i => (i + 1) % EVENTOS_AO_VIVO.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const VISAO_NOMES: Record<string, string> = {
    geral: "Escritório de Growth",
    atendimento: "Central de Atendimento",
    trafego: "Sala de Tráfego",
    conteudo: "Produção de Conteúdo",
    sites: "Desenvolvimento de Sites",
    agentes: "Agentes em Operação",
    governanca: "Governança",
    relatorios: "Relatórios",
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-950 border-b border-gray-800 h-14 flex-shrink-0">
      {/* ESQUERDA: Logo + visão */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-orange-500 flex items-center justify-center text-white font-black text-xs">O+</div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">OBRA10+</div>
            <div className="text-gray-400 text-xs leading-tight">{VISAO_NOMES[visao] || "Escritório de Growth"}</div>
          </div>
        </div>
      </div>

      {/* CENTRO: Evento ao vivo */}
      <div className="flex-1 flex justify-center px-4">
        <div className="flex items-center gap-2 bg-gray-900 rounded-full px-4 py-1.5 max-w-lg w-full">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="text-gray-300 text-xs truncate">
            <span className="text-gray-500 mr-1">Ao vivo:</span>
            {EVENTOS_AO_VIVO[eventoIndex]}
          </span>
        </div>
      </div>

      {/* DIREITA: Busca + botões */}
      <div className="flex items-center gap-2 min-w-[280px] justify-end">
        {/* Busca */}
        <div className="relative">
          {buscaAtiva ? (
            <input
              autoFocus
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onBlur={() => { if (!busca) setBuscaAtiva(false); }}
              placeholder="Lead, agente, campanha..."
              className="bg-gray-800 text-white text-xs rounded-full px-3 py-1.5 w-48 outline-none border border-gray-600 focus:border-orange-500"
            />
          ) : (
            <button
              onClick={() => setBuscaAtiva(true)}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-full px-3 py-1.5 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar
            </button>
          )}
        </div>

        {/* Agentes */}
        <button
          onClick={onAbrirAgentes}
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-full px-3 py-1.5 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Agentes
        </button>

        {/* Resolver agora */}
        <button
          onClick={onResolverAgora}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-full px-3 py-1.5 transition-colors animate-pulse"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Resolver agora
        </button>

        {/* Modo TV */}
        <button
          onClick={onModoTV}
          className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 transition-colors ${modoTV ? "bg-orange-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-400"}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          TV
        </button>
      </div>
    </div>
  );
}

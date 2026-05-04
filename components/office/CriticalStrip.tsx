"use client";
import { useState } from "react";

interface CriticalItem {
  id: string;
  titulo: string;
  descricao: string;
  valor?: number;
  acao: string;
  tempo: string;
}

const CRITICOS: CriticalItem[] = [
  { id: "c1", titulo: "SLA Estourado", descricao: "Lead #247 aguarda há 22 min sem resposta da IA", valor: 85000, acao: "Acionar SDR", tempo: "22 min" },
  { id: "c2", titulo: "CPL Acima da Meta", descricao: "Conjunto B Meta Ads com CPL R$420 (meta R$280)", valor: 12000, acao: "Pausar conjunto", tempo: "1h 10min" },
  { id: "c3", titulo: "Lead Quente Parado", descricao: "Ariane qualificou #250 R$650k — sem follow-up", valor: 650000, acao: "Iniciar proposta", tempo: "14 min" },
];

interface CriticalStripProps {
  onResolverAgora?: () => void;
}

export function CriticalStrip({ onResolverAgora }: CriticalStripProps) {
  const [aberto, setAberto] = useState(false);
  const total = CRITICOS.length;
  const valorRisco = CRITICOS.reduce((s, c) => s + (c.valor ?? 0), 0);

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-1.5 bg-red-950/40 border-b border-red-900/50 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-bold">{total} crítico{total !== 1 ? "s" : ""}</span>
        </div>
        <span className="text-gray-600 text-xs">·</span>
        <span className="text-red-300/70 text-xs">
          R${(valorRisco / 1000).toFixed(0)}k em risco
        </span>
        <span className="text-gray-600 text-xs">·</span>
        <span className="text-orange-400/80 text-xs truncate flex-1">
          Próxima ação: {CRITICOS[0]?.acao} — {CRITICOS[0]?.titulo}
        </span>
        <button
          onClick={() => setAberto(true)}
          className="text-red-400 text-xs underline underline-offset-2 hover:text-red-300 flex-shrink-0"
        >
          Ver todos
        </button>
        {onResolverAgora && (
          <button
            onClick={onResolverAgora}
            className="flex-shrink-0 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded px-2 py-0.5 transition-colors"
          >
            Resolver agora
          </button>
        )}
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-20"
          onClick={() => setAberto(false)}
        >
          <div
            className="bg-gray-900 border border-red-900/50 rounded-xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <div className="text-white font-bold text-sm">Alertas Críticos</div>
                <div className="text-gray-400 text-xs mt-0.5">{total} itens requerem atenção imediata</div>
              </div>
              <button onClick={() => setAberto(false)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
            </div>
            <div className="overflow-y-auto max-h-96">
              {CRITICOS.map(item => (
                <div key={item.id} className="px-5 py-4 border-b border-gray-800/50 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="text-red-400 text-xs font-bold">{item.titulo}</span>
                        <span className="text-gray-600 text-xs">{item.tempo} atrás</span>
                      </div>
                      <p className="text-gray-300 text-xs leading-relaxed">{item.descricao}</p>
                      {item.valor && (
                        <p className="text-orange-400 text-xs mt-1 font-medium">
                          R${item.valor.toLocaleString("pt-BR")} em jogo
                        </p>
                      )}
                    </div>
                    <button className="flex-shrink-0 bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 text-xs rounded-lg px-3 py-1.5 transition-colors">
                      {item.acao}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

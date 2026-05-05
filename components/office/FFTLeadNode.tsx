"use client";
import { useState } from "react";

interface Props {
  id: string;
  nome: string;
  mercado?: string;
  estagio: string;
  valor?: number;
  x: number;
  y: number;
  atualizadoEm: string;
  onClick: () => void;
}

const MERCADO_CONFIG: Record<string, { emoji: string; cor: string }> = {
  imobiliario: { emoji: "🏠", cor: "#8b5cf6" },
  arquitetura:  { emoji: "🏛", cor: "#f59e0b" },
  reforma:      { emoji: "🔨", cor: "#f97316" },
  fornecedor:   { emoji: "🤝", cor: "#22c55e" },
  produto:      { emoji: "📦", cor: "#06b6d4" },
  geral:        { emoji: "📌", cor: "#6b7280" },
};

export default function FFTLeadNode({ nome, mercado = "geral", estagio, valor, x, y, atualizadoEm, onClick }: Props) {
  const [selected, setSelected] = useState(false);
  const mins = (Date.now() - new Date(atualizadoEm).getTime()) / 60000;
  const isCritico = mins >= 15;
  const isAtencao = mins >= 5 && mins < 15;

  const cor = isCritico ? "#b3261e" : isAtencao ? "#c9a24a" : "#003b26";
  const animacao = isCritico
    ? "lead-pulse-red 1.5s infinite"
    : isAtencao
    ? "lead-pulse-gold 2s infinite"
    : "aura-pulse 4s ease-in-out infinite";
  const mercadoConf = MERCADO_CONFIG[mercado] || MERCADO_CONFIG.geral;

  const hpPercent = Math.max(0, 100 - (mins / 60) * 100);
  const hpColor = hpPercent > 60 ? "#003b26" : hpPercent > 30 ? "#c9a24a" : "#b3261e";

  function tempoLabel() {
    if (mins < 1) return "agora";
    if (mins < 60) return `${Math.round(mins)}min`;
    return `${Math.round(mins / 60)}h`;
  }

  function handleClick() {
    setSelected(true);
    setTimeout(() => setSelected(false), 500);
    onClick();
  }

  return (
    <div
      className="absolute flex flex-col items-center gap-1 cursor-pointer group"
      style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)", zIndex: 8 }}
      onClick={handleClick}
    >
      {selected && (
        <div className="absolute pointer-events-none"
          style={{
            width: "52px", height: "52px",
            border: `1.5px solid ${cor}`,
            transform: "rotate(45deg)",
            animation: "selector-spin 0.5s linear",
            borderRadius: "3px",
            top: "50%", left: "50%",
            marginTop: "-26px", marginLeft: "-26px",
          }} />
      )}

      <div style={{ animation: animacao }} className="relative">
        <div className="flex items-center justify-center font-black text-white"
          style={{
            width: "40px", height: "40px", borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${cor}44, #0d1117)`,
            border: `2px solid ${cor}`,
            boxShadow: `0 0 15px ${cor}66`,
            fontSize: "14px",
          }}>
          {nome.charAt(0).toUpperCase()}
        </div>
        <div className="absolute -bottom-1 -right-1 flex items-center justify-center"
          style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#0d1117", border: `1px solid ${mercadoConf.cor}`, fontSize: "8px" }}>
          {mercadoConf.emoji}
        </div>
      </div>

      {/* HP bar */}
      <div style={{ width: "36px", height: "3px", background: "#21262d", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${hpPercent}%`, background: hpColor, borderRadius: "2px", transition: "width 1s linear" }} />
      </div>

      <div className="px-1.5 py-0.5 rounded text-center"
        style={{ background: "rgba(13,17,23,0.85)", border: `1px solid ${cor}44`, maxWidth: "70px" }}>
        <p className="font-bold leading-none truncate" style={{ color: "#e6edf3", fontSize: "9px" }}>
          {nome.split(" ")[0]}
        </p>
        <p className="leading-none mt-0.5" style={{ color: cor, fontSize: "8px" }}>
          {isCritico ? "⚠ " : ""}{tempoLabel()}
        </p>
      </div>

      {/* Hover tooltip */}
      <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ zIndex: 20 }}>
        <div className="px-2 py-1.5 rounded text-xs whitespace-nowrap fft-panel" style={{ minWidth: "120px" }}>
          <p className="font-bold" style={{ color: "#e6edf3" }}>{nome}</p>
          <p style={{ color: "#8b949e" }}>{estagio} · {mercado}</p>
          {valor && valor > 0 && <p style={{ color: "#c9a24a" }}>R$ {(valor / 1000).toFixed(0)}k</p>}
        </div>
      </div>
    </div>
  );
}

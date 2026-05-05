"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  slug: string;
  nome: string;
  cargo: string;
  x: number;
  y: number;
  status?: "ativo" | "ocupado" | "critico" | "inativo";
  leadsAtivos?: number;
  cor?: string;
  tamanho?: number;
  ativoDb?: boolean;
  iniciais?: string;
}

const CARGO_CONFIG: Record<string, { cor: string; glow: string; simbolo: string; classe: string }> = {
  sdr:                  { cor: "#60a5fa", glow: "rgba(96,165,250,0.5)",   simbolo: "⚡", classe: "Explorador" },
  atendente:            { cor: "#c9a24a", glow: "rgba(201,162,74,0.5)",   simbolo: "✦", classe: "Arauto"     },
  gerente_atendimento:  { cor: "#c0c0c0", glow: "rgba(192,192,192,0.4)",  simbolo: "◈", classe: "Cavaleiro"  },
  diretor:              { cor: "#a78bfa", glow: "rgba(167,139,250,0.5)",  simbolo: "❋", classe: "Sábio"      },
};

export default function FFTAgentNode({ slug, nome, cargo, x, y, status = "ativo", leadsAtivos = 0, cor, tamanho, ativoDb = true, iniciais }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(false);
  const config = CARGO_CONFIG[slug] || CARGO_CONFIG.atendente;
  const nodeCor   = cor   ?? config.cor;
  const nodeSize  = tamanho ?? 48;
  const nodeLabel = iniciais ?? config.simbolo;
  const isCritico = status === "critico" || leadsAtivos > 3;

  function handleClick() {
    setSelected(true);
    setTimeout(() => setSelected(false), 600);
    router.push(`/crm/agentes/${slug}`);
  }

  return (
    <div
      className="absolute flex flex-col items-center gap-1 cursor-pointer group"
      style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)", zIndex: 10, opacity: ativoDb ? 1 : 0.3 }}
      onClick={handleClick}
    >
      {selected && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ animation: "selector-spin 0.6s linear" }}>
          <div style={{
            width: "64px", height: "64px",
            border: `2px solid ${config.cor}`,
            transform: "rotate(45deg)", borderRadius: "4px",
          }} />
        </div>
      )}

      <div className="relative"
        style={{ animation: !ativoDb ? "none" : isCritico ? "aura-critical 1.5s infinite" : "aura-pulse 3s ease-in-out infinite" }}>
        {ativoDb && <>
          {/* outer ring spinning */}
          <div style={{
            position: "absolute", inset: "-6px", borderRadius: "50%",
            border: `2px solid ${nodeCor}`,
            borderTopColor: "transparent", borderRightColor: "transparent",
            animation: "aura-spin 4s linear infinite", opacity: 0.7,
          }} />
          {/* inner ring reverse */}
          <div style={{
            position: "absolute", inset: "-10px", borderRadius: "50%",
            border: `1px solid ${nodeCor}`,
            borderBottomColor: "transparent", borderLeftColor: "transparent",
            animation: "aura-spin 6s linear infinite reverse", opacity: 0.4,
          }} />
        </>}

        <div className="relative flex items-center justify-center font-black text-white"
          style={{
            width: `${nodeSize}px`, height: `${nodeSize}px`, borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${nodeCor}88, #0d1117)`,
            border: `2px solid ${nodeCor}`,
            boxShadow: ativoDb ? `0 0 20px ${nodeCor}66, inset 0 0 10px rgba(0,0,0,0.5)` : "none",
            fontSize: nodeSize <= 24 ? "10px" : nodeSize <= 28 ? "12px" : "14px",
          }}>
          {nodeLabel}
        </div>

        {leadsAtivos > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center font-black"
            style={{
              background: leadsAtivos > 3 ? "#b3261e" : "#003b26",
              color: "#c9a24a", fontSize: "9px", border: "1px solid #0d1117",
            }}>
            {leadsAtivos}
          </div>
        )}
      </div>

      <div className="px-2 py-0.5 rounded text-center"
        style={{ background: "rgba(13,17,23,0.85)", border: `1px solid ${nodeCor}44`, backdropFilter: "blur(4px)" }}>
        <p className="font-bold text-xs leading-none" style={{ color: nodeCor }}>{nome}</p>
        <p className="leading-none mt-0.5" style={{ color: "#484f58", fontSize: "9px" }}>{cargo}</p>
      </div>

      <div className="absolute bottom-full mb-2 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
        style={{ background: "rgba(13,17,23,0.95)", border: `1px solid ${nodeCor}66`, color: "#e6edf3" }}>
        {cargo}{leadsAtivos > 0 ? ` · ${leadsAtivos} leads` : ""}
      </div>
    </div>
  );
}

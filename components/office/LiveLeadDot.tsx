"use client";

import { useState, useEffect } from "react";
import { LiveLead, PHASE_CONFIG } from "@/lib/data/live-leads";

interface LiveLeadDotProps {
  lead: LiveLead;
  scaleX: number;
  scaleY: number;
  onClick: (lead: LiveLead) => void;
}

export default function LiveLeadDot({ lead, scaleX, scaleY, onClick }: LiveLeadDotProps) {
  const [opacity, setOpacity] = useState(0);
  const [bolhaVisible, setBolhaVisible] = useState(false);

  const config = PHASE_CONFIG[lead.fase];
  const x = lead.posicao.x * scaleX;
  const y = lead.posicao.y * scaleY;

  const isCritico = lead.fase === "critico";
  const isSaindo = lead.fase === "saindo";

  /* Fade in ao aparecer */
  useEffect(() => {
    const t = setTimeout(() => setOpacity(1), 100);
    return () => clearTimeout(t);
  }, []);

  /* Mostrar bolha de mensagem */
  useEffect(() => {
    if (lead.mensagem_visivel && lead.ultima_mensagem) {
      setBolhaVisible(true);
      const timer = setTimeout(() => setBolhaVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [lead.mensagem_visivel, lead.ultima_mensagem]);

  const pulseClass =
    config.pulsacao === "rapida"
      ? "pulse-fast 0.8s infinite"
      : config.pulsacao === "lenta"
      ? "pulse-slow 2s infinite"
      : "none";

  const bolhaTexto = lead.ultima_mensagem?.texto ?? "";
  const bolhaW = Math.min(bolhaTexto.length * 4.5 + 16, 130);

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{
        opacity: isSaindo ? 0 : opacity,
        transition: "opacity 500ms",
        cursor: "pointer",
        pointerEvents: "all",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(lead);
      }}
    >
      {/* Anel externo pulsante (crítico) */}
      {isCritico && (
        <circle
          r={20}
          fill="none"
          stroke={config.corBorda}
          strokeWidth={2}
          opacity={0.4}
          style={{ animation: "pulse-ring 1s infinite" }}
        />
      )}

      {/* Anel de status */}
      <circle
        r={14}
        fill="none"
        stroke={config.corBorda}
        strokeWidth={isCritico ? 2.5 : 1.5}
        opacity={0.85}
        style={{ animation: pulseClass }}
      />

      {/* Círculo principal */}
      <circle r={11} fill={config.cor} opacity={0.92} />

      {/* Letra do canal */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={8}
        fill="white"
        fontWeight="bold"
      >
        {lead.canal === "meta_ads" ? "M"
          : lead.canal === "google_ads" ? "G"
          : lead.canal === "indicacao" ? "I"
          : "●"}
      </text>

      {/* Badge da fase (acima) */}
      <g transform="translate(0 -23)">
        <rect x={-18} y={-8} width={36} height={14} rx={4} fill={config.cor} opacity={0.92} />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={6}
          fill="white"
          fontWeight="bold"
        >
          {config.badge}
        </text>
      </g>

      {/* Nome do lead */}
      <text y={21} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.85)" fontWeight="500">
        {lead.nome_curto}
      </text>

      {/* Valor estimado */}
      <text y={31} textAnchor="middle" fontSize={7} fill={config.cor} fontWeight="bold">
        R${(lead.valor_estimado / 1000).toFixed(0)}k
      </text>

      {/* Bolha de conversa */}
      {bolhaVisible && lead.ultima_mensagem && (
        <g transform="translate(18 -38)">
          <rect
            x={0}
            y={-12}
            width={bolhaW}
            height={20}
            rx={6}
            fill={lead.ultima_mensagem.de === "lead" ? "rgba(96,165,250,0.95)" : "rgba(34,197,94,0.95)"}
          />
          <polygon
            points="-4,-2 0,-6 0,2"
            fill={lead.ultima_mensagem.de === "lead" ? "rgba(96,165,250,0.95)" : "rgba(34,197,94,0.95)"}
          />
          <text
            x={bolhaW / 2}
            y={2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={7}
            fill="white"
          >
            {bolhaTexto.length > 24 ? bolhaTexto.substring(0, 24) + "…" : bolhaTexto}
          </text>
        </g>
      )}

      {/* Timer SLA (crítico) */}
      {isCritico && (
        <g transform="translate(0 43)">
          <rect x={-18} y={-7} width={36} height={12} rx={4} fill="rgba(239,68,68,0.92)" />
          <text textAnchor="middle" dominantBaseline="central" fontSize={6.5} fill="white" fontWeight="bold">
            {Math.floor(lead.tempo_na_fase_ms / 60000)}min
          </text>
        </g>
      )}
    </g>
  );
}

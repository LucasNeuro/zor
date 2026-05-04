"use client";

import { useState, useEffect, useRef } from "react";

interface PulseEvent {
  id: string;
  tipo: "conversa" | "acao" | "resultado" | "alerta";
  texto: string;
  sub: string;
}

const EVENTOS: PulseEvent[] = [
  { id: "e1",  tipo: "conversa",  texto: 'SDR → Lead #247: "Qual é o seu projeto de reforma?"',   sub: "há 2 min · Atendimento · Lead aguardando" },
  { id: "e2",  tipo: "conversa",  texto: 'Lead #247: "Cozinha + sala, SP, orçamento ~R$60k"',      sub: "há 3 min · Qualificação em andamento" },
  { id: "e3",  tipo: "acao",      texto: "Copy Alpha criando headline para Meta Ads",                sub: "há 1 min · Campanha reforma SP · Prazo hoje 18h" },
  { id: "e4",  tipo: "acao",      texto: "Tráfego Beta ajustando lances no Google Ads",              sub: "há 4 min · CPL R$64 · Dentro da meta" },
  { id: "e5",  tipo: "resultado", texto: "Lead #250 → match realizado com Arq. Costa",               sub: "há 1 min · Reforma SP · R$60k estimado" },
  { id: "e6",  tipo: "resultado", texto: "Parceiro fechou obra — comissão R$1.440 gerada",            sub: "há 12 min · Lead #243 · NPS coletado" },
  { id: "e7",  tipo: "resultado", texto: "62 leads hoje — meta 50 superada",                         sub: "há 20 min · Meta Ads 34 · Google 28" },
  { id: "e8",  tipo: "alerta",    texto: "Lead #247 aguarda contato há 18 minutos",                  sub: "SDR acionado · Reforma SP · R$80k estimado" },
  { id: "e9",  tipo: "conversa",  texto: 'Analytics → Marina: "CPL Meta subiu R$12 hoje"',          sub: "há 5 min · Revisão recomendada" },
  { id: "e10", tipo: "acao",      texto: "CRM disparando follow-ups automáticos",                    sub: "há 3 min · 8 leads mornos · Sequência ativa" },
];

const TIPO_CONFIG = {
  conversa:  { icone: "💬", cor: "#60a5fa", label: "CONVERSA" },
  acao:      { icone: "⚡", cor: "#fbbf24", label: "AÇÃO" },
  resultado: { icone: "✅", cor: "#34d399", label: "RESULTADO" },
  alerta:    { icone: "⚠️", cor: "#f87171", label: "ALERTA" },
};

export function LivePulse() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setVisible(false);
      fadeRef.current = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % EVENTOS.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [isHovered]);

  const evento = EVENTOS[currentIndex];
  const config = TIPO_CONFIG[evento.tipo];

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        gap: 2, padding: "0 16px",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        width: 440, height: "100%",
        cursor: "default", flexShrink: 0,
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
        position: "relative",
      }}
    >
      {/* Linha 1: status + tipo */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
          background: "#22c55e", boxShadow: "0 0 5px #22c55e",
          animation: "pulse 2s infinite",
        }} />
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          ao vivo
        </span>
        <span style={{
          fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
          background: `${config.cor}22`, color: config.cor,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {config.icone} {config.label}
        </span>
      </div>

      {/* Linha 2: texto principal */}
      <div style={{
        fontSize: 12, fontWeight: 600, color: config.cor,
        lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {evento.texto}
      </div>

      {/* Linha 3: subtexto */}
      <div style={{
        fontSize: 9, color: "rgba(255,255,255,0.35)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {evento.sub}
      </div>

      {/* Pausa indicador */}
      {isHovered && (
        <div style={{ position: "absolute", bottom: 4, right: 10, fontSize: 8, color: "rgba(255,255,255,0.2)" }}>
          ⏸ pausado
        </div>
      )}
    </div>
  );
}

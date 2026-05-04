"use client";

import { useEffect, useState } from "react";
import type { Agent } from "./OfficeCanvas";
import { AgentState, STATE_VISUALS, getPhrase } from "@/lib/agent-states";

interface Props {
  agent: Agent;
  state: AgentState;
  x: number;
  y: number;
}

const W = 268;

function scoreColor(s: number) {
  return s >= 85 ? "#22c55e" : s >= 70 ? "#eab308" : "#ef4444";
}

export function AgentBubble({ agent, state, x, y }: Props) {
  const [phrase,     setPhrase]     = useState("");
  const [displayed,  setDisplayed]  = useState("");
  const [visible,    setVisible]    = useState(false);
  const [expanded,   setExpanded]   = useState(false);

  useEffect(() => {
    const p = agent.currentActivity || getPhrase(agent.perfil.humor, agent.perfil.personalidade, state);
    setPhrase(p);
    setDisplayed("");
    setVisible(false);
    setExpanded(false);
    const t0 = setTimeout(() => {
      setVisible(true);
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setDisplayed(p.slice(0, i));
        if (i >= p.length) clearInterval(iv);
      }, 28);
      return () => clearInterval(iv);
    }, 30);
    return () => clearTimeout(t0);
  }, [agent.id, state, agent.perfil.humor, agent.perfil.personalidade, agent.currentActivity]);

  const sv = STATE_VISUALS[state];
  const sc = scoreColor(agent.governanca.score);

  /* smart positioning */
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let bx = x + 18;
  if (bx + W + 8 > vw) bx = x - W - 18;
  if (bx < 8) bx = 8;
  let by = y < 160 ? y + 20 : y - 148;
  if (by + 280 > vh) by = vh - 288;
  if (by < 8) by = 8;

  /* needs decision */
  const needsAction = agent.needsUserDecision === true;

  return (
    <div
      style={{
        position: "fixed",
        left: bx,
        top: by,
        width: W,
        zIndex: 9999,
        pointerEvents: "auto",
        opacity: visible ? 1 : 0,
        animation: visible ? "bubbleIn 200ms cubic-bezier(0.34,1.56,0.64,1) forwards" : undefined,
        transition: visible ? undefined : "opacity 150ms ease",
      }}
    >
      <div
        style={{
          background: "rgba(13,20,42,0.97)",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: 16,
          padding: "14px 16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* ── CAMADA 1: Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: sc + "18",
              border: `2px solid ${sc}55`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: sc, fontFamily: "monospace",
            }}
          >
            {agent.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {agent.nome}
            </div>
            <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {agent.funcao}
            </div>
          </div>
          <span
            style={{
              background: agent.status.online ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.12)",
              color: agent.status.online ? "#22c55e" : "#9ca3af",
              border: `1px solid ${agent.status.online ? "rgba(34,197,94,0.25)" : "rgba(107,114,128,0.25)"}`,
              borderRadius: 999, padding: "2px 7px",
              fontSize: 10, fontWeight: 600, flexShrink: 0,
            }}
          >
            {agent.status.online ? "🟢 Online" : "⚫ Offline"}
          </span>
        </div>

        {/* ── CAMADA 1: Fazendo agora ── */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 10, padding: "9px 11px",
            marginBottom: 8, minHeight: 36,
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4 }}>
            FAZENDO AGORA
          </p>
          <span style={{ color: "#e2e8f0", fontSize: 12, fontStyle: "italic", lineHeight: 1.5 }}>
            💭 {displayed}
            {displayed.length < phrase.length && (
              <span style={{ display: "inline-flex", gap: 2, marginLeft: 3, verticalAlign: "middle" }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 3, height: 3, borderRadius: "50%",
                      background: "rgba(255,255,255,0.40)",
                      display: "inline-block",
                      animation: `dotBlink ${0.6 + i * 0.15}s ease infinite`,
                    }}
                  />
                ))}
              </span>
            )}
          </span>
        </div>

        {/* ── CAMADA 1: Você precisa fazer algo? ── */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 10px",
            background: needsAction ? "rgba(239,68,68,0.10)" : "rgba(34,197,94,0.07)",
            border: `1px solid ${needsAction ? "rgba(239,68,68,0.22)" : "rgba(34,197,94,0.15)"}`,
            borderRadius: 9, marginBottom: 8,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>Você precisa fazer algo?</span>
          <span
            style={{
              fontSize: 11, fontWeight: 700,
              color: needsAction ? "#fca5a5" : "#86efac",
            }}
          >
            {needsAction
              ? `⚠️ ${agent.decisionDescription || "Sim — decisão pendente"}`
              : "✅ Não — trabalhando"}
          </span>
        </div>

        {/* ── CAMADA 2: Personalidade colapsável ── */}
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: expanded ? "9px 9px 0 0" : 9,
            padding: "7px 10px", cursor: "pointer",
            transition: "border-radius 150ms ease",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.50)", fontSize: 11 }}>🎭 Personalidade do agente</span>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, transition: "transform 200ms ease", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </button>

        {expanded && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderTop: "none",
              borderRadius: "0 0 9px 9px",
              padding: "10px 10px 8px",
              animation: "bubbleIn 150ms ease forwards",
            }}
          >
            <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ background: "rgba(167,139,250,0.14)", color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.22)", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                {agent.perfil.humor}
              </span>
              <span style={{ background: "rgba(96,165,250,0.12)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.20)", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                {agent.perfil.personalidade}
              </span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontStyle: "italic", lineHeight: 1.4, marginBottom: 5 }}>
              "{agent.perfil.tom_comunicacao}"
            </p>
            <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 10, lineHeight: 1.4 }}>
              Estilo: {agent.perfil.estilo_trabalho}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

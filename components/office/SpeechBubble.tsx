"use client";

import { useEffect, useState } from "react";
import { Agent } from "./OfficeCanvas";
import { AgentState, STATE_VISUALS } from "@/lib/agent-states";

interface Props {
  agent: Agent;
  state: AgentState;
  phrase: string;
  screenX: number; /* center-x of agent on screen */
  screenY: number; /* center-y of agent on screen */
}

const BUBBLE_W = 285;
const BUBBLE_H = 165; /* estimated */

export function SpeechBubble({ agent, state, phrase, screenX, screenY }: Props) {
  const [displayed, setDisplayed] = useState("");
  const [visible,   setVisible]   = useState(false);

  /* typewriter effect */
  useEffect(() => {
    setDisplayed("");
    setVisible(false);
    const t0 = setTimeout(() => {
      setVisible(true);
      let i = 0;
      const chars = phrase.split("");
      const timer = setInterval(() => {
        i++;
        setDisplayed(phrase.slice(0, i));
        if (i >= chars.length) clearInterval(timer);
      }, 32);
      return () => clearInterval(timer);
    }, 40);
    return () => clearTimeout(t0);
  }, [phrase]);

  const sv = STATE_VISUALS[state];

  /* position bubble above agent, clamped to viewport */
  let bx = screenX - BUBBLE_W / 2;
  let by = screenY - BUBBLE_H - 56;
  const maxX = (typeof window !== "undefined" ? window.innerWidth : 1200) - BUBBLE_W - 8;
  bx = Math.max(8, Math.min(maxX, bx));
  by = Math.max(8, by);

  /* if bubble would go above viewport, show below */
  const showBelow = by < 8;
  if (showBelow) by = screenY + 52;

  return (
    <div
      className="pointer-events-none fixed z-[60]"
      style={{
        left: bx,
        top:  by,
        width: BUBBLE_W,
        opacity: visible ? 1 : 0,
        transform: visible
          ? "scale(1) translateY(0)"
          : "scale(0.88) translateY(6px)",
        transition: "opacity 180ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      {/* Tail triangle (above) */}
      {!showBelow && (
        <div
          style={{
            width: 0, height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: `11px solid rgba(15,23,42,0.97)`,
            margin: "0 auto",
            marginBottom: -1,
            position: "relative",
            zIndex: 1,
            left: Math.min(Math.max(screenX - bx - 9, 12), BUBBLE_W - 30),
            marginLeft: 0,
          }}
        />
      )}

      {/* Bubble body */}
      <div
        style={{
          background: "rgba(15,23,42,0.97)",
          border: `1px solid ${sv.ringColor}44`,
          borderRadius: 16,
          padding: "14px 16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: sv.ringColor + "22",
              border: `2px solid ${sv.ringColor}55`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: sv.ringColor,
              fontFamily: "monospace",
            }}
          >
            {agent.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {agent.nome}
            </div>
            <div style={{ color: "rgba(255,255,255,0.40)", fontSize: 11 }}>{agent.funcao}</div>
          </div>
          <span
            style={{
              background: sv.ringColor + "20",
              color: sv.ringColor,
              border: `1px solid ${sv.ringColor}44`,
              borderRadius: 999, padding: "2px 8px",
              fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {sv.icon} {sv.label}
          </span>
        </div>

        {/* Phrase */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 10,
            minHeight: 42,
          }}
        >
          <span style={{ color: "#e2e8f0", fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>
            💭 {displayed}
            {displayed.length < phrase.length && (
              <span style={{ display: "inline-flex", gap: 2, marginLeft: 4, verticalAlign: "middle" }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 4, height: 4, borderRadius: "50%",
                      background: "rgba(255,255,255,0.45)",
                      display: "inline-block",
                      animation: `dotBlink ${0.6 + i * 0.15}s ease infinite`,
                    }}
                  />
                ))}
              </span>
            )}
          </span>
        </div>

        {/* Metrics */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <span style={{ color: sv.ringColor, fontWeight: 600 }}>
            🟢 {agent.governanca.score}%
          </span>
          <span style={{ color: "rgba(255,255,255,0.60)" }}>
            ⚡ <strong>{agent.tarefas.ativas}</strong> ativas
          </span>
          <span style={{ color: "rgba(255,255,255,0.60)" }}>
            ✅ <strong>{agent.tarefas.concluidas_hoje}</strong> hoje
          </span>
        </div>
      </div>

      {/* Tail triangle (below) */}
      {showBelow && (
        <div
          style={{
            width: 0, height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderBottom: `11px solid rgba(15,23,42,0.97)`,
            margin: "0 auto",
            marginTop: -1,
          }}
        />
      )}
    </div>
  );
}

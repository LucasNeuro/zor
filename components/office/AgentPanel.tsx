"use client";

import { useEffect, useState } from "react";
import { Agent } from "./OfficeCanvas";

function govColor(score: number): string {
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#ca8a04";
  return "#dc2626";
}
function govBg(score: number): string {
  if (score >= 85) return "#dcfce7";
  if (score >= 70) return "#fef9c3";
  return "#fee2e2";
}

const MOCK_TASKS = [
  {
    id: 1,
    title: "Campanha Q3 — revisão criativa",
    status: "Em produção",
    priority: "Alta",
    date: "Hoje, 14h",
  },
  {
    id: 2,
    title: "Relatório de performance mensal",
    status: "Revisão",
    priority: "Média",
    date: "Amanhã, 10h",
  },
  {
    id: 3,
    title: "Planejamento Q4",
    status: "Planejamento",
    priority: "Baixa",
    date: "Seg, 09h",
  },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "Em produção": { bg: "#dbeafe", text: "#1d4ed8" },
  "Revisão":     { bg: "#fef3c7", text: "#92400e" },
  "Planejamento":{ bg: "#f3f4f6", text: "#4b5563" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Alta:  { bg: "#fee2e2", text: "#dc2626" },
  Média: { bg: "#fef9c3", text: "#ca8a04" },
  Baixa: { bg: "#dcfce7", text: "#16a34a" },
};

interface Props {
  agent: Agent | null;
  onClose: () => void;
}

export function AgentPanel({ agent, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (agent) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [agent]);

  if (!agent) return null;

  const color   = govColor(agent.governanca.score);
  const colorBg = govBg(agent.governanca.score);
  const score   = Math.min(100, Math.max(0, agent.governanca.score));

  return (
    <>
      {/* overlay */}
      <div
        className="fixed inset-0 z-30"
        style={{
          background: "rgba(0,0,0,0.20)",
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
          pointerEvents: "none",
        }}
      />

      {/* panel */}
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-[380px] flex-col overflow-hidden"
        style={{
          background: "#ffffff",
          borderLeft: "1px solid #e5e7eb",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms cubic-bezier(0.16,1,0.3,1)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start gap-3 px-5 pt-5 pb-4 shrink-0"
          style={{ borderBottom: "1px solid #f3f4f6" }}
        >
          {/* Avatar */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[18px] font-bold"
            style={{
              background: colorBg,
              color,
              border: `2px solid ${color}44`,
            }}
          >
            {agent.avatar}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="truncate text-[18px] font-bold leading-tight" style={{ color: "#111827" }}>
              {agent.nome}
            </h2>
            <p className="mt-0.5 text-[13px]" style={{ color: "#4b5563" }}>
              {agent.funcao}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                IA
              </span>
              <span style={{
                background: agent.status.online ? "#dcfce7" : "#f3f4f6",
                color:      agent.status.online ? "#16a34a" : "#6b7280",
                borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600,
              }}>
                {agent.status.online ? "● Online" : "○ Offline"}
              </span>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            style={{ color: "#9ca3af", background: "transparent" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6"; (e.currentTarget as HTMLButtonElement).style.color = "#374151"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; }}
          >
            ✕
          </button>
        </div>

        {/* ── Fixed metrics ── */}
        <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid #f3f4f6" }}>
          {/* Score bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>
                Score de Governança
              </span>
              <span className="text-[20px] font-bold tabular-nums" style={{ color }}>
                {agent.governanca.score}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "#f3f4f6" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${score}%`,
                  background: color,
                  transition: "width 0.7s ease",
                }}
              />
            </div>
          </div>

          {/* Task grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: agent.tarefas.ativas,          l: "Tarefas ativas",  icon: "⚡" },
              { v: agent.tarefas.concluidas_hoje,  l: "Concluídas hoje", icon: "✅" },
            ].map(({ v, l, icon }) => (
              <div
                key={l}
                className="rounded-xl p-3 text-center"
                style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}
              >
                <p className="text-[28px] font-bold tabular-nums" style={{ color: "#111827" }}>{v}</p>
                <p className="text-[11px] font-medium mt-0.5" style={{ color: "#6b7280" }}>
                  {icon} {l}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div
          className="flex-1 overflow-y-auto"
        >
          <div className="px-5 py-4">
            {/* Sala */}
            <p className="mb-4 text-[12px]" style={{ color: "#6b7280" }}>
              📍 {agent.sala}
            </p>

            {/* Personality */}
            <section className="mb-5">
              <h3
                className="mb-3 text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: "#6b7280" }}
              >
                Perfil
              </h3>

              <div className="flex flex-wrap gap-1.5 mb-3">
                <span style={{ background: colorBg, color, borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>
                  {agent.perfil.humor}
                </span>
                <span style={{ background: "#f3f4f6", color: "#374151", borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>
                  {agent.perfil.personalidade}
                </span>
              </div>

              <div className="rounded-xl p-3 mb-2" style={{ background: "#f9fafb" }}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>
                  Tom de comunicação
                </p>
                <p className="text-[12px] italic leading-relaxed" style={{ color: "#374151" }}>
                  {agent.perfil.tom_comunicacao}
                </p>
              </div>

              <div className="rounded-xl p-3" style={{ background: "#f9fafb" }}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>
                  Estilo de trabalho
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "#374151" }}>
                  {agent.perfil.estilo_trabalho}
                </p>
              </div>
            </section>

            {/* Tasks */}
            <section className="mb-4">
              <h3
                className="mb-3 text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: "#6b7280" }}
              >
                Tarefas recentes
              </h3>

              <div className="flex flex-col gap-2">
                {MOCK_TASKS.map((task) => {
                  const sc = STATUS_COLORS[task.status]   ?? { bg: "#f3f4f6", text: "#374151" };
                  const pc = PRIORITY_COLORS[task.priority] ?? { bg: "#f3f4f6", text: "#374151" };
                  return (
                    <div
                      key={task.id}
                      className="rounded-xl p-3"
                      style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}
                    >
                      <p className="mb-2 text-[13px] font-medium leading-snug" style={{ color: "#111827" }}>
                        {task.title}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                          <span style={{ ...sc, borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 600 }}>
                            {task.status}
                          </span>
                          <span style={{ ...pc, borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 600 }}>
                            {task.priority}
                          </span>
                        </div>
                        <span className="text-[11px]" style={{ color: "#9ca3af" }}>{task.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 shrink-0" style={{ borderTop: "1px solid #f3f4f6" }}>
          <button
            onClick={onClose}
            className="w-full rounded-xl py-2.5 text-[13px] font-medium transition-colors"
            style={{
              border: "1px solid #e5e7eb",
              color: "#6b7280",
              background: "#ffffff",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
              (e.currentTarget as HTMLButtonElement).style.color = "#374151";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#ffffff";
              (e.currentTarget as HTMLButtonElement).style.color = "#6b7280";
            }}
          >
            Fechar painel
          </button>
        </div>
      </aside>
    </>
  );
}

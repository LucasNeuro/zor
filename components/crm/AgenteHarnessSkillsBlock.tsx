"use client";

import { useCallback, useEffect, useState } from "react";
import { hubApiHeaders } from "@/lib/internal-api-headers-client";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type SkillRow = {
  skill_id: string;
  titulo: string;
  descricao: string;
  corpo_md?: string;
  ferramentas_sugeridas?: string[];
};

type HarnessMetricas = {
  sessoes: number;
  tokens_input: number;
  tokens_output: number;
  turnos: number;
  custo_brl: number;
  aprovacoes_pendentes: number;
  skills_ativas: number;
};

export type AgenteHarnessSkillsBlockProps = {
  agenteSlug: string;
  modoInterno?: boolean;
};

export function AgenteHarnessSkillsBlock({
  agenteSlug,
  modoInterno = false,
}: AgenteHarnessSkillsBlockProps) {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [metricas, setMetricas] = useState<HarnessMetricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [expandida, setExpandida] = useState<string | null>(null);

  const base = `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/harness`;

  const carregar = useCallback(async () => {
    if (!agenteSlug || !modoInterno) return;
    setLoading(true);
    setErro("");
    try {
      const headers = await hubApiHeaders();
      const [skillsRes, metricsRes] = await Promise.all([
        fetch(`${base}/skills`, { headers }),
        fetch(`${base}/metrics`, { headers }),
      ]);
      const skillsData = (await skillsRes.json().catch(() => ({}))) as { skills?: SkillRow[] };
      const metricsData = (await metricsRes.json().catch(() => ({}))) as {
        metricas?: HarnessMetricas;
      };
      if (Array.isArray(skillsData.skills)) setSkills(skillsData.skills);
      if (metricsData.metricas) setMetricas(metricsData.metricas);
    } catch {
      setErro("Não foi possível carregar skills/métricas do harness.");
    } finally {
      setLoading(false);
    }
  }, [agenteSlug, base, modoInterno]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!modoInterno) return null;

  return (
    <section
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${RF_BORDER}`,
        background: "rgba(6, 13, 8, 0.72)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: RF_TEXT_PRIMARY }}>
            Skills & métricas harness
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: RF_TEXT_SECONDARY, lineHeight: 1.45 }}>
            Runbooks L0/L1 do superagente. O agente carrega o corpo completo via{" "}
            <code style={{ color: RF_ACCENT }}>harness_skill_view</code> durante o turno.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${RF_BORDER_STRONG}`,
            background: "transparent",
            color: RF_ACCENT,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Actualizar
        </button>
      </div>

      {metricas ? (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 8,
          }}
        >
          {[
            { label: "Turnos", val: metricas.turnos },
            { label: "Tokens in", val: metricas.tokens_input },
            { label: "Tokens out", val: metricas.tokens_output },
            { label: "Custo (R$)", val: metricas.custo_brl.toFixed(2) },
            { label: "Skills activas", val: metricas.skills_ativas },
            { label: "Aprovações pend.", val: metricas.aprovacoes_pendentes },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${RF_BORDER}`,
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ fontSize: 10, color: RF_TEXT_MUTED }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: RF_TEXT_PRIMARY }}>{m.val}</div>
            </div>
          ))}
        </div>
      ) : null}

      {erro ? (
        <p style={{ marginTop: 12, fontSize: 12, color: "#f85149" }}>{erro}</p>
      ) : loading ? (
        <p style={{ marginTop: 12, fontSize: 12, color: RF_TEXT_MUTED }}>A carregar…</p>
      ) : skills.length === 0 ? (
        <p style={{ marginTop: 12, fontSize: 12, color: RF_TEXT_MUTED }}>
          Nenhuma skill activa. Regenerar harness no wizard ou deixar o agente criar via{" "}
          <code>harness_skill_manage</code>.
        </p>
      ) : (
        <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {skills.map((s) => (
            <li
              key={s.skill_id}
              style={{
                border: `1px solid ${RF_BORDER}`,
                borderRadius: 10,
                padding: 10,
                background: "rgba(0,0,0,0.15)",
              }}
            >
              <button
                type="button"
                onClick={() => setExpandida(expandida === s.skill_id ? null : s.skill_id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: RF_TEXT_PRIMARY,
                }}
              >
                <strong>{s.titulo}</strong>{" "}
                <span style={{ fontSize: 11, color: RF_TEXT_MUTED }}>({s.skill_id})</span>
              </button>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: RF_TEXT_SECONDARY }}>{s.descricao}</p>
              {expandida === s.skill_id && s.corpo_md ? (
                <pre
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.35)",
                    fontSize: 11,
                    color: RF_TEXT_SECONDARY,
                    whiteSpace: "pre-wrap",
                    maxHeight: 240,
                    overflow: "auto",
                  }}
                >
                  {s.corpo_md.slice(0, 2000)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

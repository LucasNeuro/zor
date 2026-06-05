"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Conversa {
  id: string;
  nome: string;
  estagio: string;
  origem: string;
  atualizado_em: string;
}

interface Conhecimento {
  secao: string;
  titulo: string;
}

interface AgenteDetalhes {
  agente_slug: string;
  nome: string;
  cargo: string;
  area: string;
  nivel: number;
  ativo: boolean;
  cor_departamento: string;
  modelo_padrao: string;
  sala_id: string;
  conhecimento: Conhecimento[];
  conversas_ativas: Conversa[];
  stats: {
    atendendo: number;
    atendidos_hoje: number;
    conversao_pct: number;
  };
}

interface Props {
  agente: AgenteDetalhes | null;
  onClose: () => void;
}

function nivelLabel(n: number) {
  return n === 1 ? "CEO" : n === 2 ? "Diretor" : n === 3 ? "Gestor" : "Executor";
}

export default function MobileAgentDrawer({ agente, onClose }: Props) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agente) return;
    const el = overlayRef.current;
    if (el) {
      el.style.opacity = "0";
      requestAnimationFrame(() => { el.style.opacity = "1"; });
    }
  }, [agente]);

  if (!agente) return null;

  const cor = agente.cor_departamento || "#c9a24a";
  const iniciais = agente.nome.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        minHeight: "100dvh",
        background: "rgba(0,0,0,0.6)",
        transition: "opacity 0.2s ease",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}>
      <div
        style={{
          background: "#ffffff",
          borderRadius: "20px 20px 0 0",
          border: "1px solid #dcebd8",
          borderBottom: "none",
          maxHeight: "88vh",
          display: "flex", flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>

        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#dcebd8" }} />
        </div>

        {/* Header com botão X */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "8px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Avatar */}
            <div style={{
              width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 900, color: "white",
              background: `radial-gradient(circle at 35% 35%, ${cor}55, #f8fcf6)`,
              border: `2.5px solid ${cor}`,
              boxShadow: `0 0 20px ${cor}55`,
            }}>
              {iniciais}
            </div>
            <div>
              <p style={{ color: "white", fontWeight: 900, fontSize: 17, lineHeight: 1.2 }}>{agente.nome}</p>
              <p style={{ color: "#5d7a67", fontSize: 12, marginTop: 2 }}>{agente.cargo}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{
                  background: `${cor}22`, border: `1px solid ${cor}55`,
                  color: cor, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                }}>
                  {nivelLabel(agente.nivel)}
                </span>
                <span style={{
                  background: agente.ativo ? "#22863a22" : "#dcebd8",
                  border: `1px solid ${agente.ativo ? "#22863a" : "#484f58"}`,
                  color: agente.ativo ? "#3fb950" : "#484f58",
                  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                }}>
                  {agente.ativo ? "ATIVO" : "INATIVO"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#eef7eb", border: "1px solid #dcebd8", borderRadius: 8,
            color: "#5d7a67", width: 32, height: 32, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Stats 3 colunas */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          borderTop: "1px solid #dcebd8", borderBottom: "1px solid #dcebd8",
          background: "#f8fcf6",
        }}>
          {[
            { label: "Atendendo", valor: agente.stats.atendendo, cor: agente.stats.atendendo > 0 ? cor : "#5d7a67" },
            { label: "Hoje", valor: agente.stats.atendidos_hoje, cor: "#5d7a67" },
            { label: "Conversão", valor: `${agente.stats.conversao_pct}%`, cor: agente.stats.conversao_pct > 30 ? "#3fb950" : "#5d7a67" },
          ].map((s, i) => (
            <div key={s.label} style={{
              display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0",
              borderRight: i < 2 ? "1px solid #dcebd8" : "none",
            }}>
              <p style={{ color: s.cor, fontWeight: 900, fontSize: 20, lineHeight: 1 }}>{s.valor}</p>
              <p style={{ color: "#484f58", fontSize: 10, marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Corpo scrollável */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

          {/* Conversas ativas */}
          {agente.conversas_ativas.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: "#484f58", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
                CONVERSAS ATIVAS
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {agente.conversas_ativas.map(c => {
                  const mins = (Date.now() - new Date(c.atualizado_em).getTime()) / 60000;
                  const tempo = mins < 1 ? "agora" : mins < 60 ? `${Math.round(mins)}min` : `${Math.round(mins / 60)}h`;
                  const corTempo = mins > 15 ? "#b3261e" : mins > 5 ? "#c9a24a" : "#3fb950";
                  return (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/crm/leads/${c.id}`)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "#eef7eb", border: "1px solid #dcebd8",
                        borderRadius: 10, padding: "8px 12px",
                        cursor: "pointer", textAlign: "left", width: "100%",
                      }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: "#dcebd8", display: "flex", alignItems: "center",
                        justifyContent: "center", color: "white", fontWeight: 900, fontSize: 13,
                      }}>
                        {c.nome.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: "white", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.nome}
                        </p>
                        <p style={{ color: "#484f58", fontSize: 11 }}>{c.estagio} · {c.origem}</p>
                      </div>
                      <span style={{ color: corTempo, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{tempo}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conhecimentos */}
          {agente.conhecimento.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: "#484f58", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
                CONHECIMENTOS
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {agente.conhecimento.slice(0, 12).map((c, i) => (
                  <span key={i} style={{
                    background: "#eef7eb", border: "1px solid #dcebd8",
                    color: "#5d7a67", fontSize: 11, padding: "3px 8px", borderRadius: 6,
                  }}>
                    {c.titulo}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Modelo */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: "#484f58", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>
              MODELO IA
            </p>
            <span style={{
              background: "#eef7eb", border: "1px solid #dcebd8",
              color: "#5d7a67", fontSize: 11, padding: "3px 8px", borderRadius: 6,
            }}>
              {agente.modelo_padrao}
            </span>
          </div>
        </div>

        {/* Botões de ação */}
        <div style={{
          display: "flex", gap: 10, padding: "12px 16px",
          borderTop: "1px solid #dcebd8",
        }}>
          <button
            onClick={() => router.push(`/crm/leads?agente=${agente.agente_slug}`)}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer",
              background: `${cor}22`, border: `1px solid ${cor}55`,
              color: cor, fontWeight: 700, fontSize: 13,
            }}>
            Ver conversas
          </button>
          <button
            onClick={() => router.push(`/crm/agentes/${agente.agente_slug}`)}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer",
              background: "#eef7eb", border: "1px solid #dcebd8",
              color: "#5d7a67", fontWeight: 700, fontSize: 13,
            }}>
            Editar agente
          </button>
        </div>
      </div>
    </div>
  );
}

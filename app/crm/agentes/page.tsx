"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";

const MERCADOS_FIXOS = ["IMB", "ARQ", "RFM", "MRC", "ENG", "SRV", "PRO", "FOR"];

const SEGMENTO_COR: Record<string, string> = {
  Marketing: "#3b82f6",
  Comercial: "#10b981",
  Operações: "#f59e0b",
};

const NIVEL_COR: Record<string, string> = {
  N2: "#a855f7",
  N3: "#2dd4bf",
  N4: "#fbbf24",
};

function iniciais(nome: string): string {
  return (nome || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

type Agente = {
  agente_slug: string;
  nome: string;
  cargo: string;
  segmento?: string;
  nivel?: string;
  ativo?: boolean;
  arquivado_em?: string | null;
  [key: string]: unknown;
};

export default function AgentesPage() {
  const router = useRouter();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  useEffect(() => {
    setErroLista(null);
    fetch("/api/hub/agentes?ativo=true", { headers: internalApiHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg =
            typeof data?.error === "string"
              ? data.error
              : `Erro ${r.status} ao carregar agentes.`;
          setErroLista(msg);
          setAgentes([]);
          return;
        }
        if (Array.isArray(data)) setAgentes(data);
        else if (Array.isArray(data?.agentes)) setAgentes(data.agentes);
        else {
          setAgentes([]);
          setErroLista("Resposta inesperada do servidor.");
        }
      })
      .catch((e: Error) => {
        setErroLista(e?.message || "Falha de rede ao carregar agentes.");
        setAgentes([]);
      })
      .finally(() => setCarregando(false));
  }, []);

  const agentesFiltrados = agentes.filter((a) => {
    const arquivado = !!a.arquivado_em;
    if (!mostrarArquivados && arquivado) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", padding: "24px" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ color: "#e6edf3", fontSize: 22, fontWeight: 700, margin: 0 }}>
          Agentes IA
        </h1>
        <button
          onClick={() => router.push("/crm/agentes/novo")}
          style={{
            background: "#003b26",
            color: "#c9a24a",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Novo agente
        </button>
      </div>

      {/* TOGGLE ARQUIVADOS */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => setMostrarArquivados((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: mostrarArquivados ? "#c9a24a" : "#30363d",
              position: "relative",
              transition: "background 200ms",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: mostrarArquivados ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "white",
                transition: "left 200ms",
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: "#8b949e" }}>Mostrar arquivados</span>
        </button>
      </div>

      {/* GRID */}
      {erroLista && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: "#3d1414",
            border: "1px solid #f8514966",
            color: "#f85149",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {erroLista}
        </div>
      )}
      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando...</p>
      ) : agentesFiltrados.length === 0 && !erroLista ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>
          Nenhum agente encontrado.
        </p>
      ) : agentesFiltrados.length === 0 ? null : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {agentesFiltrados.map((agente) => {
            const arquivado = !!agente.arquivado_em;
            const segCor = SEGMENTO_COR[agente.segmento || ""] || "#8b949e";
            const nivelCor = NIVEL_COR[agente.nivel || ""] || "#8b949e";
            const nivelBg = nivelCor + "22";
            const segBg = segCor + "22";
            const ativo = agente.ativo !== false;

            return (
              <div
                key={agente.agente_slug}
                onClick={() => router.push(`/crm/agentes/${agente.agente_slug}`)}
                style={{
                  background: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  opacity: arquivado ? 0.4 : 1,
                  transition: "border-color 150ms",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
                onMouseEnter={(e) => {
                  if (!arquivado) (e.currentTarget as HTMLDivElement).style.borderColor = "#c9a24a";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#30363d";
                }}
              >
                {/* Avatar + nome + cargo */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: segCor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "white",
                      flexShrink: 0,
                      letterSpacing: 0.5,
                    }}
                  >
                    {iniciais(agente.nome)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        color: "#e6edf3",
                        fontWeight: 700,
                        fontSize: 14,
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {agente.nome}
                    </p>
                    <p
                      style={{
                        color: "#8b949e",
                        fontSize: 11,
                        margin: "2px 0 0",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {agente.cargo}
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {agente.segmento && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: segBg,
                        color: segCor,
                        border: `1px solid ${segCor}44`,
                      }}
                    >
                      {agente.segmento}
                    </span>
                  )}
                  {agente.nivel && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: nivelBg,
                        color: nivelCor,
                        border: `1px solid ${nivelCor}44`,
                      }}
                    >
                      {agente.nivel}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: ativo ? "#003b2620" : "#b3261e20",
                      color: ativo ? "#22c55e" : "#ef4444",
                      border: `1px solid ${ativo ? "#22c55e44" : "#ef444444"}`,
                    }}
                  >
                    {ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MAPA_AGENTES_MOBILE } from "@/lib/data/office-mobile-map";
import { getInitials } from "@/lib/data/office-map";
import MobileCriticalBar from "@/components/office/MobileCriticalBar";
import MobileAgentDrawer from "@/components/mobile/MobileAgentDrawer";
import { internalApiHeaders } from "@/lib/internal-api-headers";

interface AgenteMap {
  agente_slug: string;
  nome: string;
  cargo: string;
  area: string;
  nivel: number;
  ativo: boolean;
  pos_mobile_x: number;
  pos_mobile_y: number;
  sala_id: string;
  cor_departamento: string;
  modelo_padrao: string;
  leads_atendendo: number;
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
  conhecimento: { secao: string; titulo: string }[];
  conversas_ativas: { id: string; nome: string; estagio: string; origem: string; atualizado_em: string }[];
  stats: { atendendo: number; atendidos_hoje: number; conversao_pct: number };
}

function corEstadoAgente(leadsAtendendo: number, ativo: boolean): string {
  if (!ativo) return "#484f58";
  if (leadsAtendendo > 3) return "#f85149";
  if (leadsAtendendo > 0) return "#d29922";
  return "#3fb950";
}

const LEGENDA = [
  { label: "Crítico", cor: "#f85149" },
  { label: "Quente", cor: "#d29922" },
  { label: "Normal", cor: "#3fb950" },
  { label: "Frio", cor: "#484f58" },
];

export function MobileOfficeMap() {
  const router = useRouter();
  const [agentesMap, setAgentesMap] = useState<AgenteMap[]>([]);
  const [drawerData, setDrawerData] = useState<AgenteDetalhes | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [agentePreviewSlug, setAgentePreviewSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agentes/mobile", { headers: internalApiHeaders() })
      .then(async (r) => {
        try {
          const data: unknown = await r.json();
          return Array.isArray(data) ? data : [];
        } catch {
          return [];
        }
      })
      .then(setAgentesMap)
      .catch(() => setAgentesMap([]));
  }, []);

  async function abrirAgente(slug: string) {
    setAgentePreviewSlug(null);
    setDrawerLoading(true);
    try {
      const r = await fetch(`/api/agentes/${slug}/detalhes`, { headers: internalApiHeaders() });
      const data = await r.json();
      setDrawerData(data);
    } finally {
      setDrawerLoading(false);
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col bg-[#0d1117]"
      onClick={() => setAgentePreviewSlug(null)}
    >
      <MobileCriticalBar onVerInbox={() => router.push("/crm/aprovacoes")} />

      <div className="relative min-h-0 flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div
          className="relative mx-auto h-full w-full max-w-[480px]"
          style={{ aspectRatio: "863 / 1822", maxHeight: "100%" }}
        >
          <img
            src="/sprites/office-mobile-bg.webp"
            alt="Escritório virtual"
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: "fill" }}
            loading="eager"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />

          {(Array.isArray(agentesMap) ? agentesMap : []).map((ag) => {
            const mapPos = MAPA_AGENTES_MOBILE[ag.agente_slug];
            const px = mapPos ? mapPos.x : ag.pos_mobile_x;
            const py = mapPos ? mapPos.y : ag.pos_mobile_y;
            const tamanho = ag.ativo && ag.leads_atendendo > 0 ? 36 : ag.ativo ? 28 : 22;
            const opacity = ag.ativo ? 1 : 0.35;
            const cor = ag.cor_departamento || "#c9a24a";
            const estadoCor = corEstadoAgente(ag.leads_atendendo, ag.ativo);
            const aberto = agentePreviewSlug === ag.agente_slug;
            return (
              <div
                key={ag.agente_slug}
                className="absolute z-[3]"
                style={{
                  left: `${px}%`,
                  top: `${py}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className="rounded-full border border-black/40"
                    style={{
                      width: 10,
                      height: 4,
                      background: estadoCor,
                      boxShadow: `0 0 8px ${estadoCor}88`,
                    }}
                  />
                  <button
                    type="button"
                    disabled={!ag.ativo}
                    className="relative flex items-center justify-center rounded-full border-0 p-0 font-black text-white"
                    style={{
                      width: tamanho,
                      height: tamanho,
                      background: `radial-gradient(circle at 35% 35%, ${cor}55, #0d1117)`,
                      border: `${ag.leads_atendendo > 0 ? 2.5 : 2}px solid ${cor}`,
                      boxShadow: ag.ativo ? `0 0 ${ag.leads_atendendo > 0 ? 14 : 8}px ${cor}55` : "none",
                      fontSize: Math.round(tamanho * 0.32),
                      opacity,
                      cursor: ag.ativo ? "pointer" : "default",
                    }}
                    title={`${ag.nome} — ${ag.cargo.replace(/_/g, " ")}`}
                    onClick={() => {
                      if (!ag.ativo) return;
                      setAgentePreviewSlug(aberto ? null : ag.agente_slug);
                    }}
                  >
                    {getInitials(ag.cargo)}
                    {ag.leads_atendendo > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#0d1117] bg-[#b3261e] text-[8px] font-black text-white">
                        {ag.leads_atendendo > 9 ? "9+" : ag.leads_atendendo}
                      </span>
                    )}
                  </button>
                </div>

                {aberto && ag.ativo && (
                  <div
                    className="absolute left-1/2 top-full z-[4] mt-1.5 w-[min(240px,78vw)] -translate-x-1/2 rounded-xl border border-[#c9a24a55] bg-[#161b22]/98 p-2.5 shadow-xl"
                  >
                    <p className="truncate text-xs font-bold text-white">{ag.nome}</p>
                    <p className="mt-0.5 text-[11px] text-[#8b949e]">{ag.cargo.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-[11px] text-[#c9a24a]">
                      {ag.leads_atendendo > 0
                        ? `Atendendo ${ag.leads_atendendo} conversa(s).`
                        : "Disponível."}
                    </p>
                    <button
                      type="button"
                      className="mt-2 min-h-11 w-full cursor-pointer rounded-lg border-0 py-2.5 text-[11px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #003b26, #005c3d)" }}
                      onClick={() => void abrirAgente(ag.agente_slug)}
                    >
                      Ver detalhes
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {drawerLoading && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/35">
              <span className="text-2xl tracking-widest text-white">⋯</span>
            </div>
          )}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center justify-center gap-4 border-t border-[#30363d] bg-[#161b22]/95 px-4 py-2"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))" }}
      >
        {LEGENDA.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: l.cor }} />
            <span className="text-[10px] font-semibold text-[#8b949e]">{l.label}</span>
          </div>
        ))}
      </div>

      <MobileAgentDrawer agente={drawerData} onClose={() => setDrawerData(null)} />
    </div>
  );
}

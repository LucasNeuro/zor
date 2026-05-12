"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { supabase } from "@/lib/supabase/client";

interface Ciclo {
  id: string;
  agente_slug: string;
  nome: string;
  descricao: string;
  tipo: string;
  cron_expressao?: string;
  intervalo_minutos?: number;
  ativo: boolean;
  ultimo_ciclo?: string;
  ultimo_status?: string;
  total_execucoes: number;
  total_alertas_gerados: number;
  configuracoes: Record<string, unknown>;
}

function proximaExecucao(cron?: string): string {
  if (!cron) return "—";
  const agora = new Date();
  const h = agora.getHours();
  if (cron === "*/2 * * * *") return "em 2 minutos";
  if (cron === "*/30 * * * *") return "em até 30 min";
  if (cron === "0 7 * * *") return "às 07h";
  if (cron === "0 8 * * *") return "às 08h";
  if (cron === "0 19 * * *") return "às 19h";
  if (cron === "0 */6 * * *") {
    const proxH = Math.ceil((h + 1) / 6) * 6;
    return `às ${proxH % 24}h`;
  }
  return cron;
}

function tempoRelativo(d?: string): string {
  if (!d) return "nunca";
  const diff = (Date.now() - new Date(d).getTime()) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.round(diff)}min atrás`;
  if (diff < 1440) return `${Math.round(diff / 60)}h atrás`;
  return `${Math.round(diff / 1440)}d atrás`;
}

const TIPO_COR: Record<string, string> = {
  continuo: "#003b26",
  programado: "#c9a24a",
  gatilho: "#8b949e",
};

function slugParaApiCiclos(agenteSlug: string): string {
  if (agenteSlug === "diretor" || agenteSlug === "diretor_geral_ia" || agenteSlug === "diretor_operacoes") return "diretor";
  if (agenteSlug === "gerente_atendimento") return "gerente";
  return agenteSlug;
}

const STATUS_COR: Record<string, string> = {
  sucesso: "#003b26",
  sem_acao: "#8b949e",
  erro: "#b3261e",
  rodando: "#c9a24a",
  nunca_executado: "#484f58",
};

export default function CiclosPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [alertas, setAlertas] = useState<Record<string, unknown>[]>([]);
  const [aba, setAba] = useState<"ciclos" | "logs" | "alertas">("ciclos");
  const [executando, setExecutando] = useState<string | null>(null);

  useEffect(() => { carregar(); }, [aba]);

  async function carregar() {
    const [c, l, a] = await Promise.all([
      supabase.from("hub_ciclos_ia").select("*").order("agente_slug"),
      supabase.from("hub_ciclos_log").select("*").order("iniciado_em", { ascending: false }).limit(20),
      supabase.from("hub_alertas").select("*").eq("resolvido", false).order("criado_em", { ascending: false }).limit(30),
    ]);
    if (c.data) setCiclos(c.data as Ciclo[]);
    if (l.data) setLogs(l.data);
    if (a.data) setAlertas(a.data);
  }

  async function toggleCiclo(id: string, ativo: boolean) {
    await supabase.from("hub_ciclos_ia").update({ ativo }).eq("id", id);
    carregar();
  }

  async function executarAgora(ciclo: Ciclo) {
    setExecutando(ciclo.id);
    const agente = slugParaApiCiclos(ciclo.agente_slug);
    const nome = ciclo.nome.toLowerCase();
    const nomeCiclo = nome.includes("follow") ? "followup"
      : nome.includes("sla") ? "sla"
      : nome.includes("manha") || nome.includes("matinal") ? ciclo.agente_slug === "gerente_atendimento" ? "relatorio_manha" : "analise_manha"
      : nome.includes("noite") ? "analise_noite"
      : nome.includes("tráfego") || nome.includes("trafego") ? "trafego"
      : nome.includes("supervis") ? "supervisao"
      : "followup";

    try {
      await fetch(`/api/ciclos/${agente}?ciclo=${nomeCiclo}&secret=obra10plus_cron_2026`, {
        headers: internalApiHeaders(),
      });
    } catch (e) { console.error(e); }

    await carregar();
    setExecutando(null);
  }

  async function resolverAlerta(id: string) {
    await supabase.from("hub_alertas").update({ resolvido: true, resolvido_em: new Date().toISOString() }).eq("id", id);
    carregar();
  }

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <div className="flex gap-2 text-xs">
          <span className="rounded px-2 py-1" style={{ background: "#003b2630", color: "#c9a24a" }}>
            {ciclos.filter((c) => c.ativo).length} ativos
          </span>
          <span
            className="rounded px-2 py-1"
            style={{
              background: alertas.length > 0 ? "#b3261e30" : "#21262d",
              color: alertas.length > 0 ? "#b3261e" : "#8b949e",
            }}
          >
            {alertas.length} alertas
          </span>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, ciclos, alertas]);

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh" }}>
      <div className="flex" style={{ borderBottom: "1px solid #30363d" }}>
        {[
          { id: "ciclos", label: `Ciclos (${ciclos.length})` },
          { id: "logs", label: `Logs (${logs.length})` },
          { id: "alertas", label: `Alertas (${alertas.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setAba(t.id as typeof aba)}
            className="flex-1 py-3 text-sm transition-colors"
            style={{
              color: aba === t.id ? "#c9a24a" : "#8b949e",
              background: "#0d1117",
              cursor: "pointer",
              outline: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottom: aba === t.id ? "2px solid #c9a24a" : "2px solid transparent",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {aba === "ciclos" && (
          <div className="space-y-2">
            {ciclos.length === 0 && (
              <p className="text-center py-8 text-sm" style={{ color: "#484f58" }}>Nenhum ciclo cadastrado</p>
            )}
            {ciclos.map(c => (
              <div key={c.id} className="rounded-xl p-3" style={{ background: "#161b22", border: "1px solid #30363d", opacity: c.ativo ? 1 : 0.6 }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: `${TIPO_COR[c.tipo] || "#8b949e"}30`, color: TIPO_COR[c.tipo] || "#8b949e" }}>
                        {c.tipo}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${STATUS_COR[c.ultimo_status || "nunca_executado"]}30`, color: STATUS_COR[c.ultimo_status || "nunca_executado"] }}>
                        {c.ultimo_status || "nunca executado"}
                      </span>
                    </div>
                    <p className="text-white font-bold text-sm">{c.nome}</p>
                    <p className="text-xs" style={{ color: "#8b949e" }}>{c.descricao}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button
                      onClick={() => executarAgora(c)}
                      disabled={executando === c.id || !c.ativo}
                      className="text-xs px-2 py-1 rounded-lg disabled:opacity-50"
                      style={{ background: "#21262d", color: "#c9a24a", border: "none", cursor: "pointer" }}>
                      {executando === c.id ? "..." : "▶ Executar"}
                    </button>
                    <button
                      onClick={() => toggleCiclo(c.id, !c.ativo)}
                      className="relative rounded-full transition-colors"
                      style={{ width: 40, height: 24, background: c.ativo ? "#003b26" : "#30363d", border: "none", cursor: "pointer" }}>
                      <div className="absolute top-1 rounded-full bg-white transition-transform"
                        style={{ width: 16, height: 16, transform: c.ativo ? "translateX(20px)" : "translateX(4px)" }} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "#484f58" }}>
                  <span>⏱ {tempoRelativo(c.ultimo_ciclo)}</span>
                  <span>⏭ {proximaExecucao(c.cron_expressao)}</span>
                  <span>🔄 {c.total_execucoes}x</span>
                  {c.total_alertas_gerados > 0 && (
                    <span style={{ color: "#c9a24a" }}>⚡ {c.total_alertas_gerados} alertas</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {aba === "logs" && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: "#484f58" }}>Nenhuma execução registrada ainda</p>
            ) : logs.map(l => (
              <div key={l.id as string} className="rounded-xl p-3" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white font-bold text-sm">{l.agente_slug as string}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${STATUS_COR[l.status as string] || "#8b949e"}30`, color: STATUS_COR[l.status as string] || "#8b949e" }}>
                    {l.status as string}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "#8b949e" }}>{tempoRelativo(l.iniciado_em as string)}</p>
                {typeof l.erro === "string" && <p className="text-xs mt-1" style={{ color: "#b3261e" }}>{l.erro}</p>}
                {Array.isArray(l.acoes_tomadas) && (l.acoes_tomadas as string[]).length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {(l.acoes_tomadas as string[]).slice(0, 3).map((a, i) => (
                      <p key={i} className="text-xs" style={{ color: "#484f58" }}>• {a}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {aba === "alertas" && (
          <div className="space-y-2">
            {alertas.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-2xl mb-2">✓</p>
                <p className="font-bold" style={{ color: "#e6edf3" }}>Nenhum alerta pendente</p>
                <p className="text-xs mt-1" style={{ color: "#484f58" }}>Operação saudável</p>
              </div>
            ) : alertas.map(a => {
              const cor = a.tipo === "critico" ? "#b3261e" : a.tipo === "importante" ? "#c9a24a" : a.tipo === "sugestao" ? "#003b26" : "#8b949e";
              return (
                <div key={a.id as string} className="rounded-xl p-3"
                  style={{
                    background: "#161b22",
                    borderTop: `1px solid ${cor}44`,
                    borderRight: `1px solid ${cor}44`,
                    borderBottom: `1px solid ${cor}44`,
                    borderLeft: `3px solid ${cor}`,
                  }}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: `${cor}22`, color: cor }}>{a.tipo as string}</span>
                        <span className="text-xs" style={{ color: "#484f58" }}>{a.agente_slug as string}</span>
                      </div>
                      <p className="text-white font-bold text-sm">{a.titulo as string}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{a.mensagem as string}</p>
                    </div>
                    <button onClick={() => resolverAlerta(a.id as string)}
                      className="ml-2 text-xs px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ background: "#21262d", color: "#c9a24a", border: "none", cursor: "pointer" }}>
                      Resolver
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: "#484f58" }}>{tempoRelativo(a.criado_em as string)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

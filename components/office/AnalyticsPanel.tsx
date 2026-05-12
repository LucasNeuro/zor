"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";

interface DadosCampanha {
  campaign: string;
  spend: number;
  clicks: number;
  cpc: number;
  ctr: number;
  impressions: number;
}

function MetricCard({ label, valor, cor, sub, onClick }: {
  label: string; valor: string | number; cor?: string; sub?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="fft-panel hex-bg p-3 text-left w-full transition-transform hover:scale-[1.02]"
      style={{ borderLeft: `3px solid ${cor || "#30363d"}` }}>
      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#484f58" }}>{label}</p>
      <p className="text-2xl font-black" style={{ color: cor || "#e6edf3", animation: "number-tick 0.4s ease" }}>{valor}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{sub}</p>}
    </button>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="h-px flex-1" style={{ background: "linear-gradient(to right, #c9a24a44, transparent)" }} />
      <p className="text-xs font-black uppercase tracking-widest" style={{ color: "#c9a24a" }}>{children}</p>
      <div className="h-px flex-1" style={{ background: "linear-gradient(to left, #c9a24a44, transparent)" }} />
    </div>
  );
}

export default function AnalyticsPanel() {
  const router = useRouter();
  const [dados, setDados] = useState({
    leadsHoje: 0, aguardando: 0, aprovacoes: 0, encaminhamentos: 0,
    agentes: 0, parceiros: 0, taxaQual: 0, taxaEnc: 0,
  });
  const [agentes, setAgentes] = useState<Record<string, unknown>[]>([]);
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
  const [alertas, setAlertas] = useState<Record<string, unknown>[]>([]);
  const [campanhas, setCampanhas] = useState<DadosCampanha[]>([]);
  const [ciclos, setCiclos] = useState<Record<string, unknown>[]>([]);

  const carregar = useCallback(async () => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    const [l, msgs, aprovs, enc, ags, parc, alts, cics] = await Promise.all([
      supabase.from("hub_leads_crm").select("id, estagio, criado_em, humano_responsavel"),
      supabase.from("hub_fila_mensagens").select("id", { count: "exact", head: true }).eq("direcao", "entrada").eq("status", "pendente"),
      supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("hub_encaminhamentos").select("id", { count: "exact", head: true }).gte("enviado_em", hoje.toISOString()),
      supabase.from("hub_agente_identidade").select("agente_slug, nome, cargo, nivel").eq("ativo", true).order("nivel"),
      supabase.from("hub_parceiros").select("id", { count: "exact", head: true }).eq("status", "homologado"),
      supabase.from("hub_alertas").select("*").eq("resolvido", false).order("criado_em", { ascending: false }).limit(5),
      supabase.from("hub_ciclos_ia").select("nome, ativo, ultimo_ciclo, ultimo_status").order("agente_slug"),
    ]);

    const todosLeads = l.data || [];
    const leadsHoje = todosLeads.filter(x => new Date(x.criado_em) >= hoje).length;
    const ativos = todosLeads.filter(x => !["ganho", "perdido"].includes(x.estagio as string));
    const aguardando = ativos.filter(x => !x.humano_responsavel).length;
    const qualificados = todosLeads.filter(x => x.estagio === "qualificado").length;
    const taxaQual = todosLeads.length > 0 ? Math.round((qualificados / todosLeads.length) * 100) : 0;
    const encTotal = enc.count || 0;
    const taxaEnc = leadsHoje > 0 ? Math.round((encTotal / leadsHoje) * 100) : 0;

    setDados({
      leadsHoje, aguardando,
      aprovacoes: aprovs.count || 0,
      encaminhamentos: encTotal,
      agentes: (ags.data || []).length,
      parceiros: parc.count || 0,
      taxaQual, taxaEnc,
    });

    setAgentes(ags.data || []);
    setLeads(ativos.slice(0, 6));
    setAlertas(alts.data || []);
    setCiclos(cics.data || []);

    try {
      const res = await fetch("/api/windsor/campanhas", {
        headers: internalApiHeaders(),
      });
      if (res.ok) setCampanhas(await res.json());
    } catch { /* Windsor opcional */ }
  }, []);

  useEffect(() => {
    carregar();
    const sub = supabase.channel("analytics-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .subscribe();
    const i = setInterval(carregar, 60000);
    return () => { supabase.removeChannel(sub); clearInterval(i); };
  }, [carregar]);

  const ESTAGIO_FUNIL = ["novo", "qualificando", "qualificado", "proposta", "negociando", "fechamento"];

  const CARGO_CONF: Record<string, { cor: string; simbolo: string }> = {
    sdr:                 { cor: "#60a5fa", simbolo: "⚡" },
    atendente:           { cor: "#c9a24a", simbolo: "✦" },
    gerente_atendimento: { cor: "#c0c0c0", simbolo: "◈" },
    diretor:             { cor: "#a78bfa", simbolo: "❋" },
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#0d1117", animation: "analytics-enter 0.3s ease", padding: "1rem" }}>
      <SectionTitle>Central de Comando</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <MetricCard label="Leads hoje" valor={dados.leadsHoje} cor="#c9a24a" onClick={() => router.push("/crm/leads")} />
        <MetricCard label="Aguardando" valor={dados.aguardando} cor={dados.aguardando > 0 ? "#c9a24a" : "#003b26"} sub="precisam de resposta" onClick={() => router.push("/crm/atendimento")} />
        <MetricCard label="Aprovações" valor={dados.aprovacoes} cor={dados.aprovacoes > 0 ? "#b3261e" : "#003b26"} sub="pendentes" onClick={() => router.push("/crm/aprovacoes")} />
        <MetricCard label="Encaminhados" valor={dados.encaminhamentos} cor="#003b26" sub="hoje" onClick={() => router.push("/crm/leads")} />
      </div>

      <SectionTitle>Funil de Leads</SectionTitle>
      <div className="fft-panel hex-bg p-3 mb-4">
        <div className="flex items-end gap-1">
          {ESTAGIO_FUNIL.map(e => {
            const count = leads.filter(l => l.estagio === e).length;
            const h = count > 0 ? Math.max(12, (count / Math.max(dados.leadsHoje, 1)) * 48) : 4;
            return (
              <div key={e} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-xs font-black" style={{ color: count > 0 ? "#c9a24a" : "#484f58" }}>{count}</p>
                <div style={{
                  width: "100%", height: `${h}px`,
                  background: count > 0 ? "linear-gradient(to top, #003b26, #c9a24a44)" : "#21262d",
                  borderRadius: "4px 4px 0 0", transition: "height 0.5s ease",
                }} />
                <p className="text-xs text-center leading-tight" style={{ color: "#484f58", fontSize: "8px" }}>
                  {e.slice(0, 5)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <SectionTitle>Equipe de Agentes</SectionTitle>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {agentes.map(a => {
          const c = CARGO_CONF[a.agente_slug as string] || CARGO_CONF.atendente;
          return (
            <button key={a.agente_slug as string}
              onClick={() => router.push(`/crm/agentes/${a.agente_slug}`)}
              className="fft-panel p-2 flex items-center gap-2 text-left hover:scale-[1.02] transition-transform">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                style={{ background: `${c.cor}22`, border: `1px solid ${c.cor}`, boxShadow: `0 0 8px ${c.cor}44` }}>
                {c.simbolo}
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{a.nome as string}</p>
                <p className="text-xs truncate" style={{ color: "#484f58" }}>{a.cargo as string}</p>
              </div>
            </button>
          );
        })}
      </div>

      {campanhas.length > 0 && (
        <>
          <SectionTitle>Campanhas Ativas</SectionTitle>
          <div className="space-y-2 mb-4">
            {campanhas.slice(0, 4).map((c, i) => {
              const cor = c.cpc < 2.5 ? "#003b26" : c.cpc > 4 ? "#b3261e" : "#c9a24a";
              return (
                <div key={i} className="fft-panel p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold truncate flex-1 mr-2" style={{ color: "#e6edf3" }}>
                      {c.campaign?.replace("CP_TRF_", "").replace("CP_ENG_", "")}
                    </p>
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: `${cor}22`, color: cor }}>
                      R$ {c.cpc?.toFixed(2)}/clique
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs" style={{ color: "#484f58" }}>
                    <span>Gasto: R$ {c.spend?.toFixed(0)}</span>
                    <span>Cliques: {c.clicks}</span>
                    <span>CTR: {((c.ctr || 0) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle>Ciclos de IA</SectionTitle>
      <div className="fft-panel p-3 mb-4">
        <div className="space-y-1.5">
          {ciclos.slice(0, 5).map((c, i) => {
            const ok = c.ultimo_status === "sucesso" || c.ultimo_status === "sem_acao";
            const cor = !c.ativo ? "#484f58" : ok ? "#003b26" : "#b3261e";
            return (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
                  <p className="text-xs truncate max-w-[160px]" style={{ color: c.ativo ? "#e6edf3" : "#484f58" }}>
                    {c.nome as string}
                  </p>
                </div>
                <span className="text-xs" style={{ color: "#484f58" }}>
                  {c.ativo ? (c.ultimo_status as string || "aguardando") : "pausado"}
                </span>
              </div>
            );
          })}
        </div>
        <button onClick={() => router.push("/crm/ciclos")} className="text-xs mt-2 w-full text-right" style={{ color: "#c9a24a" }}>
          Ver todos os ciclos →
        </button>
      </div>

      {alertas.length > 0 && (
        <>
          <SectionTitle>Alertas Ativos</SectionTitle>
          <div className="space-y-2 mb-4">
            {alertas.map(a => {
              const cor = a.tipo === "critico" ? "#b3261e" : a.tipo === "importante" ? "#c9a24a" : "#003b26";
              return (
                <div key={a.id as string} className="fft-panel p-2" style={{ borderLeft: `3px solid ${cor}` }}>
                  <p className="text-xs font-bold" style={{ color: "#e6edf3" }}>{a.titulo as string}</p>
                  <p className="text-xs" style={{ color: "#8b949e" }}>{(a.mensagem as string).slice(0, 60)}…</p>
                </div>
              );
            })}
            <button onClick={() => router.push("/crm/ciclos")} className="text-xs w-full text-right" style={{ color: "#c9a24a" }}>
              Ver todos os alertas →
            </button>
          </div>
        </>
      )}

      <SectionTitle>Performance</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Taxa qualificação" valor={`${dados.taxaQual}%`} cor={dados.taxaQual > 60 ? "#003b26" : "#c9a24a"} />
        <MetricCard label="Taxa encaminhamento" valor={`${dados.taxaEnc}%`} cor={dados.taxaEnc > 50 ? "#003b26" : "#c9a24a"} />
        <MetricCard label="Parceiros homologados" valor={dados.parceiros} cor="#003b26" onClick={() => router.push("/crm/parceiros")} />
        <MetricCard label="Agentes online" valor={dados.agentes} cor="#003b26" onClick={() => router.push("/crm/agentes")} />
      </div>
    </div>
  );
}

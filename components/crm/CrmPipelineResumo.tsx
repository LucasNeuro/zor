"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, ChevronRight, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  FUNIL_LEADS,
  FUNIL_LEADS_OUTCOMES,
  FUNIL_NEGOCIOS,
  corConversao,
  moedaPipeline,
  taxaConversao,
} from "@/lib/crm/pipeline-funil";

type LeadRow = { estagio: string | null; valor_estimado: number | null };
type NegRow = { etapa: string; valor_estimado: number | null; status: string };

type Tab = "leads" | "negocios";

function agregarLeads(rows: LeadRow[]) {
  const counts: Record<string, number> = {};
  const valores: Record<string, number> = {};
  for (const s of FUNIL_LEADS) {
    counts[s.id] = 0;
    valores[s.id] = 0;
  }
  for (const o of FUNIL_LEADS_OUTCOMES) {
    counts[o.id] = 0;
    valores[o.id] = 0;
  }
  for (const r of rows) {
    const e = String(r.estagio || "novo");
    counts[e] = (counts[e] ?? 0) + 1;
    valores[e] = (valores[e] ?? 0) + Number(r.valor_estimado ?? 0);
  }
  return { counts, valores };
}

function agregarNegocios(rows: NegRow[]) {
  const counts: Record<string, number> = {};
  const valores: Record<string, number> = {};
  for (const s of FUNIL_NEGOCIOS) {
    counts[s.id] = 0;
    valores[s.id] = 0;
  }
  for (const r of rows) {
    if (!["aberto", "em_negociacao"].includes(r.status)) continue;
    const e = String(r.etapa || "briefing");
    counts[e] = (counts[e] ?? 0) + 1;
    valores[e] = (valores[e] ?? 0) + Number(r.valor_estimado ?? 0);
  }
  return { counts, valores };
}

function ConectorConversao({ pct, compact }: { pct: number | null; compact?: boolean }) {
  const cor = corConversao(pct);
  if (compact) {
    return (
      <span className="text-[9px] font-bold tabular-nums" style={{ color: cor }}>
        {pct != null ? `${pct}%` : "—"}
      </span>
    );
  }
  return (
    <div className="flex flex-shrink-0 flex-col items-center justify-center px-0.5">
      <ChevronRight className="h-3.5 w-3.5 text-[#484f58]" aria-hidden />
      <span className="mt-0.5 text-[9px] font-bold tabular-nums" style={{ color: cor }}>
        {pct != null ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

export function CrmPipelineResumo() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("leads");
  const [leadsRows, setLeadsRows] = useState<LeadRow[]>([]);
  const [negRows, setNegRows] = useState<NegRow[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: leads }, { data: neg }] = await Promise.all([
      supabase.from("hub_leads_crm").select("estagio, valor_estimado"),
      supabase.from("hub_negocios").select("etapa, valor_estimado, status"),
    ]);
    setLeadsRows((leads ?? []) as LeadRow[]);
    setNegRows((neg ?? []) as NegRow[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
    const ch = supabase
      .channel("crm_pipeline_dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_negocios" }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  const leads = useMemo(() => agregarLeads(leadsRows), [leadsRows]);
  const neg = useMemo(() => agregarNegocios(negRows), [negRows]);

  const totalAtivosLeads = FUNIL_LEADS.reduce((s, e) => s + (leads.counts[e.id] ?? 0), 0);
  const pipelineLeads = FUNIL_LEADS.reduce((s, e) => s + (leads.valores[e.id] ?? 0), 0);
  const ganhos = leads.counts.ganho ?? 0;
  const perdidos = leads.counts.perdido ?? 0;

  const totalNeg = FUNIL_NEGOCIOS.reduce((s, e) => s + (neg.counts[e.id] ?? 0), 0);
  const pipelineNeg = FUNIL_NEGOCIOS.reduce((s, e) => s + (neg.valores[e.id] ?? 0), 0);
  const concluidosNeg = negRows.filter(
    (n) => n.etapa === "concluido" || n.status === "concluido"
  ).length;
  const convBriefingSitDown =
    (neg.counts.briefing ?? 0) > 0
      ? taxaConversao(neg.counts["sit-down"] ?? 0, neg.counts.briefing ?? 0)
      : null;

  function irLeads(estagio: string) {
    router.push(`/crm/leads?estagio=${encodeURIComponent(estagio)}&view=kanban`);
  }

  function irNegocios(etapa: string) {
    router.push(`/crm/negocios?etapa=${encodeURIComponent(etapa)}&view=kanban`);
  }

  return (
    <section
      className="mb-6 rounded-2xl border border-[#30363d] bg-[#161b22] shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
      aria-label="Funil comercial"
    >
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] px-4 py-3 sm:px-5">
        <div>
          <h2 className="m-0 text-sm font-bold text-[#e6edf3]">Funil comercial</h2>
          <p className="mt-0.5 text-xs text-[#8b949e]">
            Clique numa etapa para abrir o kanban já filtrado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#30363d] text-[#8b949e] transition-colors hover:border-[#c9a24a40] hover:text-[#c9a24a]"
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          </button>
          <div className="inline-flex rounded-lg bg-[#0d1117] p-0.5">
            <button
              type="button"
              onClick={() => setTab("leads")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                tab === "leads" ? "bg-[#003b26] text-[#c9a24a]" : "text-[#8b949e] hover:text-[#e6edf3]"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Leads
            </button>
            <button
              type="button"
              onClick={() => setTab("negocios")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                tab === "negocios" ? "bg-[#003b26] text-[#c9a24a]" : "text-[#8b949e] hover:text-[#e6edf3]"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Negócios
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-px border-b border-[#30363d] bg-[#30363d] sm:grid-cols-4">
        {tab === "leads" ? (
          <>
            <KpiCell label="Leads no funil" value={String(totalAtivosLeads)} hint="excl. ganho/perdido" />
            <KpiCell label="Pipeline" value={moedaPipeline(pipelineLeads)} hint="valor estimado" />
            <KpiCell label="Ganhos" value={String(ganhos)} hint="fechados" cor="#22c55e" />
            <KpiCell
              label="Conversão topo→fundo"
              value={
                totalAtivosLeads > 0
                  ? `${taxaConversao(leads.counts.fechamento ?? 0, leads.counts.novo ?? 0) ?? 0}%`
                  : "—"
              }
              hint="novo → fechamento"
            />
          </>
        ) : (
          <>
            <KpiCell label="Negócios abertos" value={String(totalNeg)} />
            <KpiCell label="Pipeline" value={moedaPipeline(pipelineNeg)} />
            <KpiCell
              label="Em negociação"
              value={String(negRows.filter((n) => n.status === "em_negociacao").length)}
            />
            <KpiCell
              label="Conversão briefing→sit-down"
              value={convBriefingSitDown != null ? `${convBriefingSitDown}%` : "—"}
              hint={`${concluidosNeg} concluído(s) no total`}
            />
          </>
        )}
      </div>

      <div className="overflow-x-auto px-3 py-4 sm:px-5 sm:py-5">
        {carregando ? (
          <div className="flex justify-center py-12">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-[#30363d] border-t-[#c9a24a]"
              aria-label="Carregando funil"
            />
          </div>
        ) : tab === "leads" && leadsRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#30363d] bg-[#0d1117] px-6 py-10 text-center">
            <p className="mb-1 text-sm font-bold text-[#e6edf3]">Nenhum lead no funil ainda</p>
            <p className="mb-4 text-xs text-[#8b949e]">
              Quando chegarem leads (WhatsApp ou cadastro manual), as etapas aparecem aqui.
            </p>
            <button
              type="button"
              onClick={() => router.push("/crm/leads?view=kanban")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#c9a24a] px-4 py-2 text-xs font-bold text-[#0d1117]"
            >
              Abrir kanban de leads
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : tab === "leads" ? (
          <>
            {/* Funil: 100% largura, badge dentro do card (nada cortado no topo) */}
            <div className="w-full min-w-0 overflow-x-auto overflow-y-visible pb-1 pt-2 scrollbar-none [-webkit-overflow-scrolling:touch]">
              <div className="mx-auto flex w-full min-w-0 max-w-full items-end justify-between gap-1 sm:gap-2">
                {FUNIL_LEADS.map((est, i) => {
                  const n = leads.counts[est.id] ?? 0;
                  const v = leads.valores[est.id] ?? 0;
                  const anterior = i > 0 ? (leads.counts[FUNIL_LEADS[i - 1].id] ?? 0) : null;
                  const pct = i > 0 ? taxaConversao(n, anterior ?? 0) : null;
                  const ativo = hover === est.id;

                  return (
                    <div key={est.id} className="flex min-w-0 flex-1 items-end justify-center">
                      {i > 0 && (
                        <div className="flex flex-shrink-0 flex-col items-center self-center px-0.5 pb-10">
                          <ChevronRight className="h-3 w-3 text-[#484f58] sm:h-3.5 sm:w-3.5" aria-hidden />
                          <ConectorConversao pct={pct} compact />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => irLeads(est.id)}
                        onMouseEnter={() => setHover(est.id)}
                        onMouseLeave={() => setHover(null)}
                        className="group flex min-w-0 flex-1 flex-col items-center transition-transform hover:scale-[1.02]"
                      >
                        <div
                          className="flex aspect-square w-full max-w-[4.25rem] flex-col items-center justify-center rounded-lg border px-1 py-1.5 transition-all sm:max-w-[4.75rem]"
                          style={{
                            background: `linear-gradient(180deg, ${est.color}35 0%, ${est.color}0c 100%)`,
                            borderColor: ativo ? est.color : `${est.color}50`,
                            boxShadow: ativo ? `0 0 0 1px ${est.color}55` : undefined,
                          }}
                        >
                          <span
                            className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                            style={{ backgroundColor: est.color }}
                          >
                            {n}
                          </span>
                          <span className="text-center text-[10px] font-semibold leading-tight text-[#e6edf3]">
                            {est.short}
                          </span>
                          {v > 0 && (
                            <span
                              className="mt-0.5 max-w-full truncate px-0.5 text-center text-[8px] font-bold leading-tight sm:text-[9px]"
                              style={{ color: est.color }}
                              title={moedaPipeline(v)}
                            >
                              {moedaPipeline(v)}
                            </span>
                          )}
                        </div>
                        <span className="mt-2 w-full max-w-[5.5rem] px-0.5 text-center text-[9px] leading-snug text-[#6e7681] group-hover:text-[#c9a24a] sm:text-[10px]">
                          {est.label}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legenda + outcomes */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#21262d] pt-3">
              <p className="m-0 text-[10px] text-[#6e7681]">
                Setas = % que passou da etapa anterior
              </p>
              <div className="flex gap-2">
                {FUNIL_LEADS_OUTCOMES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => irLeads(o.id)}
                    className="rounded-full border px-3 py-1 text-xs font-bold transition-colors hover:bg-white/[0.04]"
                    style={{ borderColor: `${o.color}44`, color: o.color }}
                  >
                    {o.label}: {leads.counts[o.id] ?? 0}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/crm/leads?view=kanban")}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#c9a24a44] bg-[#003b2610] py-2.5 text-xs font-bold text-[#c9a24a] transition-colors hover:bg-[#003b2622]"
            >
              Abrir kanban de leads
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : negRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#30363d] bg-[#0d1117] px-6 py-10 text-center">
            <p className="mb-1 text-sm font-bold text-[#e6edf3]">Nenhum negócio aberto</p>
            <p className="mb-4 text-xs text-[#8b949e]">
              Converta um lead em negócio para acompanhar briefing, match e sit-down.
            </p>
            <button
              type="button"
              onClick={() => router.push("/crm/negocios?view=kanban")}
              className="inline-flex items-center gap-2 rounded-lg border border-[#c9a24a44] bg-[#003b2622] px-4 py-2 text-xs font-bold text-[#c9a24a]"
            >
              Abrir kanban de negócios
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-full min-w-0 overflow-x-auto overflow-y-visible pb-1 pt-2 scrollbar-none [-webkit-overflow-scrolling:touch]">
              <div className="mx-auto flex w-full min-w-0 max-w-full items-end justify-between gap-1 sm:gap-2">
                {FUNIL_NEGOCIOS.map((et, i) => {
                  const n = neg.counts[et.id] ?? 0;
                  const v = neg.valores[et.id] ?? 0;
                  const anterior = i > 0 ? (neg.counts[FUNIL_NEGOCIOS[i - 1].id] ?? 0) : null;
                  const pct = i > 0 ? taxaConversao(n, anterior ?? 0) : null;
                  const ativo = hover === et.id;

                  return (
                    <div key={et.id} className="flex min-w-0 flex-1 items-end justify-center">
                      {i > 0 && (
                        <div className="flex flex-shrink-0 flex-col items-center self-center px-0.5 pb-10">
                          <ChevronRight className="h-3 w-3 text-[#484f58] sm:h-3.5 sm:w-3.5" aria-hidden />
                          <ConectorConversao pct={pct} compact />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => irNegocios(et.id)}
                        onMouseEnter={() => setHover(et.id)}
                        onMouseLeave={() => setHover(null)}
                        className="group flex min-w-0 flex-1 flex-col items-center transition-transform hover:scale-[1.02]"
                      >
                        <div
                          className="flex aspect-square w-full max-w-[4.25rem] flex-col items-center justify-center rounded-lg border px-1 py-1.5 transition-all sm:max-w-[4.75rem]"
                          style={{
                            background: `linear-gradient(180deg, ${et.color}35 0%, ${et.color}0c 100%)`,
                            borderColor: ativo ? et.color : `${et.color}50`,
                            boxShadow: ativo ? `0 0 0 1px ${et.color}55` : undefined,
                          }}
                        >
                          <span
                            className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                            style={{ backgroundColor: et.color }}
                          >
                            {n}
                          </span>
                          <span className="text-center text-[10px] font-semibold leading-tight text-[#e6edf3]">
                            {et.label.includes(" ") ? et.label.split(" ")[0] : et.label}
                          </span>
                          {v > 0 && (
                            <span
                              className="mt-0.5 max-w-full truncate px-0.5 text-center text-[8px] font-bold leading-tight sm:text-[9px]"
                              style={{ color: et.color }}
                              title={moedaPipeline(v)}
                            >
                              {moedaPipeline(v)}
                            </span>
                          )}
                        </div>
                        <span className="mt-2 w-full max-w-[5.5rem] px-0.5 text-center text-[9px] leading-snug text-[#6e7681] group-hover:text-[#c9a24a] sm:text-[10px]">
                          {et.label}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/crm/negocios?view=kanban")}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#c9a24a44] bg-[#003b2610] py-2.5 text-xs font-bold text-[#c9a24a] transition-colors hover:bg-[#003b2622]"
            >
              Abrir kanban de negócios
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function KpiCell({
  label,
  value,
  hint,
  cor = "#e6edf3",
}: {
  label: string;
  value: string;
  hint?: string;
  cor?: string;
}) {
  return (
    <div className="bg-[#161b22] px-3 py-2.5 sm:px-4">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6e7681]">{label}</p>
      <p className="text-base font-black tabular-nums sm:text-lg" style={{ color: cor }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-[#484f58]">{hint}</p>}
    </div>
  );
}

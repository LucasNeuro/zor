"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { CrmPipelinePageToolbar } from "@/components/crm/pipelines/CrmPipelinePageToolbar";
import { CrmKanbanBoardScroll } from "@/components/crm/pipelines/CrmKanbanBoardScroll";
import { CrmKanbanColumn } from "@/components/crm/pipelines/CrmKanbanColumn";
import type { CrmResizableColumn } from "@/components/crm/CrmResizableDataTable";
import {
  CrmRetrofitAdvancedFiltersGrid,
  CrmRetrofitFilterField,
  CrmRetrofitTablePanel,
  crmRetrofitFilterSelectClass,
  crmTableIdBadge,
  crmTableStagePill,
} from "@/components/crm/CrmRetrofitTablePanel";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { ESTAGIOS_FALLBACK_ATENDIMENTO_UI } from "@/lib/crm/pipeline-defaults";
import { labelPipelineTab } from "@/lib/crm/tenant-pipelines";
import { useCrmToast } from "@/lib/crm/crm-feedback";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import type { AtendimentoLeadData } from "@/components/crm/atendimento/AtendimentoEditSideover";

const LeadKanbanCard = dynamic(
  () =>
    import("@/components/crm/leads/LeadKanbanCard").then((m) => ({
      default: m.LeadKanbanCard,
    })),
  { ssr: false }
);

const PipelineConfigSideover = dynamic(
  () =>
    import("@/components/crm/leads/PipelineConfigSideover").then((m) => ({
      default: m.PipelineConfigSideover,
    })),
  { ssr: false }
);

const AtendimentoEditSideover = dynamic(
  () =>
    import("@/components/crm/atendimento/AtendimentoEditSideover").then((m) => ({
      default: m.AtendimentoEditSideover,
    })),
  { ssr: false }
);

type EstagioUi = { id: string; label: string; color: string };

type PipelineUi = {
  id: string;
  slug: string;
  nome: string;
  mercado_sigla: string | null;
  estagios: { slug: string; label: string; cor: string; ativo: boolean; ordem?: number }[];
};

const ESTAGIOS_FALLBACK: EstagioUi[] = ESTAGIOS_FALLBACK_ATENDIMENTO_UI.map((e) => ({
  id: e.id,
  label: e.label,
  color: e.color,
}));

const ORIGENS_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  linkedin: "LinkedIn",
  site: "Site",
  indicacao: "Indicação",
  outro: "Outro",
};

const ORIGENS_COLOR: Record<string, string> = {
  whatsapp: "#25D366",
  instagram: "#E1306C",
  meta_ads: "#1877F2",
  google_ads: "#EA4335",
  linkedin: "#0A66C2",
  site: "#6366F1",
  indicacao: "#F59E0B",
  outro: "#6B7280",
};

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function formatData(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function linhaUnica(s: string | null | undefined, n: number) {
  if (!s) return "—";
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function isAtendimentoRelevant(row: Record<string, unknown>): boolean {
  const humano = row.humano_responsavel != null ? String(row.humano_responsavel).trim() : "";
  const agente = row.agente_responsavel != null ? String(row.agente_responsavel).trim() : "";
  const ultimaMsg = row.ultima_mensagem_fila_em;
  return Boolean(humano || agente || ultimaMsg);
}

function mapRowToLead(row: Record<string, unknown>): AtendimentoLeadData {
  const {
    pessoa_codigo,
    pessoa_nome_completo: _pn,
    email_exibicao: _email,
    ...base
  } = row;
  return {
    ...(base as Omit<AtendimentoLeadData, "_pessoa_codigo" | "estagio_atendimento">),
    estagio_atendimento:
      row.estagio_atendimento != null ? String(row.estagio_atendimento) : "novo",
    _pessoa_codigo: pessoa_codigo != null ? String(pessoa_codigo) : null,
    ultima_mensagem_fila:
      row.ultima_mensagem_fila != null ? String(row.ultima_mensagem_fila) : null,
    ultima_mensagem_fila_em:
      row.ultima_mensagem_fila_em != null ? String(row.ultima_mensagem_fila_em) : null,
    score: Number(row.score ?? 0),
    valor_estimado: Number(row.valor_estimado ?? 0),
    criado_em: row.criado_em != null ? String(row.criado_em) : undefined,
    atualizado_em: row.atualizado_em != null ? String(row.atualizado_em) : undefined,
  };
}

function AtendimentoContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setSlot } = useCrmHeaderSlot();
  const { error: toastError } = useCrmToast();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;

  const [leads, setLeads] = useState<AtendimentoLeadData[]>([]);
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [busca, setBusca] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [editLead, setEditLead] = useState<AtendimentoLeadData | null>(null);
  const [leadDragId, setLeadDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pipelineConfigOpen, setPipelineConfigOpen] = useState(false);
  const [pipelineConfigFocusCreate, setPipelineConfigFocusCreate] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineUi[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [estagiosKanban, setEstagiosKanban] = useState<EstagioUi[]>(ESTAGIOS_FALLBACK);
  const pendingStageMovesRef = useRef(new Set<string>());

  const carregarPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/pipelines?tipo=atendimento", {
        headers: internalApiHeaders(),
      });
      const json = await res.json();
      const list = (json.data || []) as PipelineUi[];
      if (!list.length) return;
      setPipelines(list);
      setPipelineId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      /* fallback ESTAGIOS_FALLBACK */
    }
  }, []);

  const carregar = useCallback(async () => {
    const vw = await supabase
      .from("vw_hub_leads_crm_enriquecido")
      .select("*")
      .order("atualizado_em", { ascending: false });

    if (!vw.error && vw.data) {
      const merged = (vw.data as Record<string, unknown>[])
        .filter(isAtendimentoRelevant)
        .map(mapRowToLead);
      setLeads(merged);
      return;
    }

    const res = await fetch("/api/crm/atendimento", { headers: internalApiHeaders() });
    const json = await res.json().catch(() => ({}));
    const raw = (json.leads ?? []) as Record<string, unknown>[];
    setLeads(raw.map(mapRowToLead));
  }, []);

  useEffect(() => {
    const est = searchParams.get("estagio_atendimento") ?? searchParams.get("estagio");
    const v = searchParams.get("view");
    const leadId = searchParams.get("lead");
    if (est) setFiltroEstagio(est);
    if (v === "kanban" || v === "lista") setView(v);
    if (leadId && leads.length) {
      const found = leads.find((l) => l.id === leadId);
      if (found) setEditLead(found);
    }
  }, [searchParams, leads]);

  useEffect(() => {
    void carregarPipeline();
  }, [carregarPipeline]);

  const pipelineAtivo = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId]
  );

  const pipelineTitulo = useMemo(
    () => (pipelineAtivo ? labelPipelineTab(pipelineAtivo) : "Atendimento"),
    [pipelineAtivo]
  );

  useEffect(() => {
    const cols =
      pipelineAtivo?.estagios
        ?.filter((e) => e.ativo !== false)
        .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .map((e) => ({ id: e.slug, label: e.label, color: e.cor || "#6B7280" })) ?? [];
    setEstagiosKanban(cols.length ? cols : ESTAGIOS_FALLBACK);
  }, [pipelineAtivo]);

  useEffect(() => {
    void carregar();
    const ch = supabase
      .channel("atendimento_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, (payload) => {
        const leadId =
          (payload.new as { id?: string } | null)?.id ??
          (payload.old as { id?: string } | null)?.id;
        if (leadId && pendingStageMovesRef.current.has(leadId)) return;
        void carregar();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hub_fila_mensagens" },
        () => {
          void carregar();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  const abrirEditLead = useCallback(
    (lead: AtendimentoLeadData) => {
      setEditLead(lead);
      const p = new URLSearchParams(searchParams.toString());
      p.set("lead", lead.id);
      router.replace(`${pathname}?${p.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const fecharEditLead = useCallback(() => {
    setEditLead(null);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("lead");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [pathname, router, searchParams]);

  async function moverEstagio(
    leadId: string,
    novoEstagio: string,
    options?: { optimistic?: boolean }
  ) {
    const leadAtual = leads.find((l) => l.id === leadId);
    const estagioAnterior = leadAtual?.estagio_atendimento ?? "novo";

    if (options?.optimistic) {
      if (estagioAnterior === novoEstagio) return true;
      pendingStageMovesRef.current.add(leadId);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, estagio_atendimento: novoEstagio } : l
        )
      );
      if (editLead?.id === leadId) {
        setEditLead((d) => (d ? { ...d, estagio_atendimento: novoEstagio } : null));
      }
    }

    const res = await patchLeadCrm(leadId, { estagio_atendimento: novoEstagio });

    if (options?.optimistic) {
      pendingStageMovesRef.current.delete(leadId);
    }

    if (!res.ok) {
      if (options?.optimistic) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, estagio_atendimento: estagioAnterior } : l
          )
        );
        if (editLead?.id === leadId) {
          setEditLead((d) =>
            d ? { ...d, estagio_atendimento: estagioAnterior } : null
          );
        }
      }
      toastError(res.error);
      return false;
    }

    const data = res.data as { estagio_atendimento?: string };
    const est = String(data.estagio_atendimento ?? novoEstagio);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, estagio_atendimento: est } : l))
    );
    if (editLead?.id === leadId) {
      setEditLead((d) => (d ? { ...d, estagio_atendimento: est } : null));
    }
    return true;
  }

  const filtrados = useMemo(
    () =>
      leads.filter((l) => {
        if (
          busca &&
          !l.nome.toLowerCase().includes(busca.toLowerCase()) &&
          !(l.telefone || "").includes(busca) &&
          !(l.codigo || "").toLowerCase().includes(busca.toLowerCase()) &&
          !(l._pessoa_codigo || "").toLowerCase().includes(busca.toLowerCase())
        ) {
          return false;
        }
        const est = l.estagio_atendimento || "novo";
        if (filtroEstagio && est !== filtroEstagio) return false;
        if (filtroOrigem && l.origem !== filtroOrigem) return false;
        return true;
      }),
    [leads, busca, filtroEstagio, filtroOrigem]
  );

  const comHumano = leads.filter((l) => Boolean(l.humano_responsavel?.trim())).length;
  const aguardando = leads.filter((l) => (l.estagio_atendimento || "novo") === "aguardando").length;

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      subtitle: `${pipelineTitulo} · ${leads.length} conversas`,
    });
    return () => setSlot(null);
  }, [pathname, setSlot, pipelineTitulo, leads.length, isMobile]);

  const colunasAtendimento = useMemo((): CrmResizableColumn<AtendimentoLeadData>[] => {
    const estagioInfo = (lead: AtendimentoLeadData) =>
      estagiosKanban.find((e) => e.id === (lead.estagio_atendimento || "novo"));

    return [
      {
        id: "nome",
        label: "Nome",
        defaultWidth: 200,
        minWidth: 140,
        render: (lead) => (
          <span className="font-semibold text-[#0b2210]">{lead.nome}</span>
        ),
      },
      {
        id: "origem",
        label: "Origem",
        defaultWidth: 120,
        minWidth: 90,
        render: (lead) => {
          if (!lead.origem) return "—";
          const color = ORIGENS_COLOR[lead.origem] || "#6B7280";
          return crmTableStagePill(
            ORIGENS_LABEL[lead.origem] || lead.origem,
            color
          );
        },
      },
      {
        id: "estagio",
        label: "Estágio",
        defaultWidth: 130,
        minWidth: 100,
        render: (lead) => {
          const est = estagioInfo(lead);
          if (!est) return "—";
          return crmTableStagePill(est.label, est.color);
        },
      },
      {
        id: "agente",
        label: "Agente",
        defaultWidth: 140,
        minWidth: 100,
        render: (lead) => lead.agente_responsavel || "—",
      },
      {
        id: "humano",
        label: "Humano responsável",
        defaultWidth: 150,
        minWidth: 110,
        render: (lead) => lead.humano_responsavel || "—",
      },
      {
        id: "ultima_mensagem",
        label: "Última mensagem",
        defaultWidth: 200,
        minWidth: 140,
        render: (lead) => (
          <span className="text-[#5d7a67]" title={lead.ultima_mensagem_fila ?? undefined}>
            {linhaUnica(lead.ultima_mensagem_fila, 48)}
          </span>
        ),
      },
      {
        id: "telefone",
        label: "Telefone",
        defaultWidth: 130,
        minWidth: 100,
        render: (lead) => lead.telefone || "—",
      },
      {
        id: "codigo",
        label: "Código",
        defaultWidth: 110,
        minWidth: 80,
        render: (lead) => {
          const cod = lead.codigo || lead._pessoa_codigo;
          return cod ? crmTableIdBadge(cod, "green") : "—";
        },
      },
      {
        id: "atualizado",
        label: "Atualizado",
        defaultWidth: 110,
        minWidth: 90,
        render: (lead) => (
          <span className="text-[#6b8a76]" title={formatData(lead.atualizado_em)}>
            {lead.atualizado_em ? tempo(lead.atualizado_em) : "—"}
          </span>
        ),
      },
    ];
  }, [estagiosKanban]);

  const exportConfig = useMemo(
    () => ({
      filename: `atendimento-${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        "Nome",
        "Origem",
        "Estágio",
        "Agente",
        "Humano",
        "Telefone",
        "Código",
        "Atualizado",
      ],
      rowValues: (lead: AtendimentoLeadData) => {
        const est = estagiosKanban.find(
          (e) => e.id === (lead.estagio_atendimento || "novo")
        );
        return [
          lead.nome,
          lead.origem ? ORIGENS_LABEL[lead.origem] || lead.origem : "",
          est?.label || lead.estagio_atendimento,
          lead.agente_responsavel || "",
          lead.humano_responsavel || "",
          lead.telefone || "",
          lead.codigo || lead._pessoa_codigo || "",
          formatData(lead.atualizado_em),
        ];
      },
    }),
    [estagiosKanban]
  );

  const footerSummary =
    filtrados.length > 0
      ? `Exibindo 1-${filtrados.length} de ${leads.length} conversas`
      : `Exibindo 0 de ${leads.length} conversas`;

  const pipelineToolbar = (
    <CrmPipelinePageToolbar
      pipelines={pipelines}
      activePipelineId={pipelineId}
      onSelectPipeline={setPipelineId}
      pipelineCount={() => leads.length}
      view={view}
      onViewChange={setView}
      onCreatePipeline={() => {
        setPipelineConfigFocusCreate(true);
        setPipelineConfigOpen(true);
      }}
      onOpenStages={() => {
        setPipelineConfigFocusCreate(false);
        setPipelineConfigOpen(true);
      }}
    />
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">
      {pipelineToolbar}

      <div className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#dcebd8] bg-[#ffffff] px-4 py-2.5 text-sm">
        <span className="text-[#5d7a67]">
          <strong className="text-[#0b2210]">{filtrados.length}</strong> conversas
        </span>
        <span className="text-[#5d7a67]">
          Com humano <strong className="text-[#22c55e]">{comHumano}</strong>
        </span>
        {aguardando > 0 ? (
          <span className="text-[#5d7a67]">
            Aguardando <strong className="text-[#eab308]">{aguardando}</strong>
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-hidden">
        {view === "kanban" ? (
          <CrmKanbanBoardScroll isMobile={isMobile}>
            {estagiosKanban.map((est) => {
              const col = filtrados.filter(
                (l) => (l.estagio_atendimento || "novo") === est.id
              );
              return (
                <CrmKanbanColumn
                  key={est.id}
                  stageId={est.id}
                  label={est.label}
                  color={est.color}
                  count={col.length}
                  totalValue={null}
                  dragOver={dragOver === est.id}
                  isMobile={isMobile}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(est.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const lid = e.dataTransfer.getData("leadId");
                    if (lid) void moverEstagio(lid, est.id, { optimistic: true });
                    setLeadDragId(null);
                    setDragOver(null);
                  }}
                >
                  {col.map((lead) => (
                    <LeadKanbanCard
                      key={lead.id}
                      lead={{
                        ...lead,
                        estagio: lead.estagio_atendimento || "novo",
                        email: lead.email ?? null,
                        score: lead.score ?? 0,
                        valor_estimado: lead.valor_estimado ?? 0,
                        criado_em: lead.criado_em ?? lead.atualizado_em ?? new Date().toISOString(),
                        atualizado_em: lead.atualizado_em ?? new Date().toISOString(),
                      }}
                      notas={[]}
                      stageLabel={est.label}
                      stageColor={est.color}
                      dragging={leadDragId === lead.id}
                      isMobile={isMobile}
                      draggable={!isMobile}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("leadId", lead.id);
                        setLeadDragId(lead.id);
                      }}
                      onDragEnd={() => {
                        setLeadDragId(null);
                        setDragOver(null);
                      }}
                      onOpen={() => abrirEditLead(lead)}
                      onEdit={() => abrirEditLead(lead)}
                    />
                  ))}
                  {col.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#484f58]">vazio</p>
                  ) : null}
                </CrmKanbanColumn>
              );
            })}
          </CrmKanbanBoardScroll>
        ) : (
          <div className="h-full overflow-y-auto pt-4">
            <CrmRetrofitTablePanel
              tableId="crm-atendimento-lista"
              columns={colunasAtendimento}
              rows={filtrados}
              rowKey={(lead) => lead.id}
              emptyMessage="Nenhuma conversa encontrada"
              footerSummary={footerSummary}
              onRowClick={abrirEditLead}
              onEditRow={abrirEditLead}
              onViewRow={abrirEditLead}
              exportConfig={exportConfig}
              toolbar={{
                searchValue: busca,
                onSearchChange: setBusca,
                searchPlaceholder: "Buscar nome, telefone ou código…",
                showAdvancedFilters,
                onToggleAdvancedFilters: () => setShowAdvancedFilters((v) => !v),
                advancedFilters: (
                  <CrmRetrofitAdvancedFiltersGrid>
                    <CrmRetrofitFilterField label="Estágio">
                      <select
                        value={filtroEstagio}
                        onChange={(e) => setFiltroEstagio(e.target.value)}
                        className={crmRetrofitFilterSelectClass}
                      >
                        <option value="">Todos os estágios</option>
                        {estagiosKanban.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                    </CrmRetrofitFilterField>
                    <CrmRetrofitFilterField label="Origem">
                      <select
                        value={filtroOrigem}
                        onChange={(e) => setFiltroOrigem(e.target.value)}
                        className={crmRetrofitFilterSelectClass}
                      >
                        <option value="">Todas as origens</option>
                        {Object.entries(ORIGENS_LABEL).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </CrmRetrofitFilterField>
                  </CrmRetrofitAdvancedFiltersGrid>
                ),
              }}
            />
          </div>
        )}
      </div>

      <AtendimentoEditSideover
        open={!!editLead}
        lead={editLead}
        estagios={estagiosKanban}
        isMobile={isMobile}
        onClose={fecharEditLead}
        onUpdated={(updated) => {
          setLeads((prev) =>
            prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
          );
          setEditLead((prev) =>
            prev?.id === updated.id ? { ...prev, ...updated } : prev
          );
        }}
      />

      <PipelineConfigSideover
        open={pipelineConfigOpen}
        onClose={() => {
          setPipelineConfigOpen(false);
          setPipelineConfigFocusCreate(false);
        }}
        tipo="atendimento"
        pipelineId={pipelineId}
        focusCreate={pipelineConfigFocusCreate}
        onSelectPipeline={(id) => setPipelineId(id)}
        onUpdated={() => {
          void carregarPipeline();
        }}
      />
    </div>
  );
}

export default function AtendimentoPage() {
  return (
    <Suspense>
      <AtendimentoContent />
    </Suspense>
  );
}

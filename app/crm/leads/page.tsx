"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { CrmPipelinePageToolbar, type CrmPipelineViewMode } from "@/components/crm/pipelines/CrmPipelinePageToolbar";
import { CrmKanbanBoardScroll } from "@/components/crm/pipelines/CrmKanbanBoardScroll";
import { CrmKanbanColumn } from "@/components/crm/pipelines/CrmKanbanColumn";
import type { CrmResizableColumn } from "@/components/crm/CrmResizableDataTable";
import {
  CrmRetrofitAdvancedFiltersGrid,
  CrmRetrofitFilterField,
  CrmRetrofitTablePanel,
  crmRetrofitPageXClass,
  crmRetrofitFilterInputClass,
  crmRetrofitFilterSelectClass,
  crmTableIdBadge,
  crmTableStagePill,
  crmTableStatusPill,
} from "@/components/crm/CrmRetrofitTablePanel";
import { crmHeaderPrimaryBtnStyle } from "@/lib/crm/crm-list-pill-styles";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { useCrmToast } from "@/lib/crm/crm-feedback";
import { estagioParaColunaKanban } from "@/lib/crm/estagio-map";
import {
  effectiveHumanoResponsavel,
  formatHumanoDisplayName,
} from "@/lib/crm/resolve-crm-actor";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { ESTAGIOS_FALLBACK_LEAD_UI, ESTAGIOS_FALLBACK_ATENDIMENTO_UI } from "@/lib/crm/pipeline-defaults";
import { labelPipelineTab } from "@/lib/crm/tenant-pipelines";
import { CrmTableNotesCell } from "@/components/crm/CrmTableNotesCell";
import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import {
  sparklineFromCounts,
  sparklineFromSeed,
  trendLabel,
} from "@/lib/crm/metric-visuals";
import {
  loadNotasPreviewMap,
  notasParaLead,
} from "@/lib/crm/load-notas-preview";
import { leadEmAtendimentoAberto } from "@/lib/crm/atendimento-shared";
import type { NotaPreview } from "@/components/crm/CrmKanbanNotesSection";
import {
  invalidateCrmLeadsList,
  patchCrmLeadsListCache,
  useCrmLeadsList,
  type CrmLeadRow,
} from "@/hooks/useCrmLeadsQueries";
import { invalidateCrmPipelines, useCrmPipelines } from "@/hooks/useCrmDataQueries";
import { CrmLeadsPageSkeleton } from "@/components/crm/leads/CrmLeadsPageSkeleton";

type Lead = CrmLeadRow;

const LeadRapidoSideover = dynamic(
  () =>
    import("@/components/crm/leads/LeadRapidoSideover").then((m) => ({
      default: m.LeadRapidoSideover,
    })),
  { ssr: false }
);

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

const LeadEditSideover = dynamic(
  () =>
    import("@/components/crm/leads/LeadEditSideover").then((m) => ({
      default: m.LeadEditSideover,
    })),
  { ssr: false }
);

const NegocioDetailSideover = dynamic(
  () =>
    import("@/components/crm/negocios/NegocioDetailSideover").then((m) => ({
      default: m.NegocioDetailSideover,
    })),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type EstagioUi = { id: string; label: string; color: string };

type PipelineUi = {
  id: string;
  slug: string;
  nome: string;
  mercado_sigla: string | null;
  estagios: { slug: string; label: string; cor: string; ativo: boolean; ordem?: number }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTAGIOS_FALLBACK: EstagioUi[] = ESTAGIOS_FALLBACK_LEAD_UI.map((e) => ({
  id: e.id,
  label: e.label,
  color: e.color,
}));

const ORIGENS_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", meta_ads: "Meta Ads",
  google_ads: "Google Ads", linkedin: "LinkedIn", site: "Site",
  indicacao: "Indicação", outro: "Outro",
};
const ORIGENS_COLOR: Record<string, string> = {
  whatsapp: "#25D366", instagram: "#E1306C", meta_ads: "#1877F2",
  google_ads: "#EA4335", linkedin: "#0A66C2", site: "#6366F1",
  indicacao: "#F59E0B", outro: "#6B7280",
};
// ─── Helpers ──────────────────────────────────────────────────────────────────

function moeda(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
}

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

function isPipelinePrincipal(pipe: PipelineUi | null, pipelines: PipelineUi[]): boolean {
  if (!pipe) return true;
  const first = pipelines[0];
  return first?.id === pipe.id;
}

const ESTAGIOS_ATENDIMENTO_UI: EstagioUi[] = ESTAGIOS_FALLBACK_ATENDIMENTO_UI.map((e) => ({
  id: e.id,
  label: e.label,
  color: e.color,
}));

export default function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { setSlot } = useCrmHeaderSlot();
  const { error: toastError } = useCrmToast();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;
  const leadsQuery = useCrmLeadsList();
  const leads = leadsQuery.data ?? [];
  const leadsInitialLoading = leadsQuery.isPending && leadsQuery.data === undefined;
  const pipelinesLeadQuery = useCrmPipelines("lead");
  const pipelinesAtendimentoQuery = useCrmPipelines("atendimento");
  const patchLeads = useCallback(
    (updater: (prev: Lead[]) => Lead[]) => patchCrmLeadsListCache(queryClient, updater),
    [queryClient]
  );
  const refreshLeads = useCallback(() => {
    void invalidateCrmLeadsList(queryClient);
  }, [queryClient]);
  const [view, setView] = useState<CrmPipelineViewMode>("kanban");
  const [busca, setBusca] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroScoreMin, setFiltroScoreMin] = useState("");
  const [filtroScoreMax, setFiltroScoreMax] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [selectedNegocioId, setSelectedNegocioId] = useState<string | null>(null);
  const [leadDragId, setLeadDragId] = useState<string | null>(null);
  const [notasMap, setNotasMap] = useState<Map<string, NotaPreview[]>>(new Map());
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [leadRapidoOpen, setLeadRapidoOpen] = useState(false);
  const [pipelineConfigOpen, setPipelineConfigOpen] = useState(false);
  const [pipelineConfigFocusCreate, setPipelineConfigFocusCreate] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [estagiosKanban, setEstagiosKanban] = useState<EstagioUi[]>(ESTAGIOS_FALLBACK);
  const [sideoverInitialTab, setSideoverInitialTab] = useState<
    "chat" | "conversas_email" | undefined
  >(undefined);
  const [sucessoLead, setSucessoLead] = useState<string | null>(null);
  const pendingStageMovesRef = useRef(new Set<string>());
  const realtimeInvalidateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pipelines = useMemo((): PipelineUi[] => {
    const list = pipelinesLeadQuery.data ?? [];
    return list.map((p) => ({
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      mercado_sigla: p.mercado_sigla ?? null,
      estagios: (p.estagios ?? []).map((e) => ({
        slug: e.slug,
        label: e.label,
        cor: e.cor || "#6B7280",
        ativo: e.ativo !== false,
        ordem: e.ordem,
      })),
    }));
  }, [pipelinesLeadQuery.data]);

  const estagiosAtendimento = useMemo(() => {
    const pipeAt = pipelinesAtendimentoQuery.data?.[0];
    const cols =
      pipeAt?.estagios
        ?.filter((e) => e.ativo !== false)
        .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .map((e) => ({ id: e.slug, label: e.label, color: e.cor || "#6B7280" })) ?? [];
    return cols.length ? cols : ESTAGIOS_ATENDIMENTO_UI;
  }, [pipelinesAtendimentoQuery.data]);

  useEffect(() => {
    if (!pipelines.length) return;
    setPipelineId((prev) => {
      if (prev && pipelines.some((p) => p.id === prev)) return prev;
      return pipelines[0]?.id ?? null;
    });
  }, [pipelines]);

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "atendimentos") {
      const p = new URLSearchParams(searchParams.toString());
      p.delete("view");
      const leadId = p.get("lead");
      const tab = p.get("tab");
      if (leadId) {
        p.delete("lead");
        p.delete("tab");
        const rest = p.toString();
        const q =
          tab === "chat" || tab === "conversas_email"
            ? `?tab=${tab}`
            : rest
              ? `?${rest}`
              : "";
        router.replace(`/crm/atendimentos/${encodeURIComponent(leadId)}${q}`);
        return;
      }
      const q = p.toString();
      router.replace(q ? `/crm/atendimentos?${q}` : "/crm/atendimentos");
      return;
    }

    const est = searchParams.get("estagio");
    const leadId = searchParams.get("lead");
    const tab = searchParams.get("tab");
    if (est) setFiltroEstagio(est);
    if (v === "kanban" || v === "lista") setView(v);
    if ((tab === "chat" || tab === "conversas_email") && leadId) {
      router.replace(`/crm/atendimentos/${encodeURIComponent(leadId)}?tab=${tab}`);
      return;
    }
    if (leadId && leads.length) {
      const found = leads.find((l) => l.id === leadId);
      if (found) setEditLead(found);
    }
    if (searchParams.get("novo") === "1") {
      setLeadRapidoOpen(true);
      const p = new URLSearchParams(searchParams.toString());
      p.delete("novo");
      const q = p.toString();
      router.replace(q ? `/crm/leads?${q}` : "/crm/leads");
    }
  }, [searchParams, isMobile, router, leads]);

  const pipelineAtivo = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId]
  );

  const pipelineTitulo = useMemo(
    () => (pipelineAtivo ? labelPipelineTab(pipelineAtivo) : "Leads"),
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

  const estagiosKanbanIds = useMemo(
    () => estagiosKanban.map((e) => e.id),
    [estagiosKanban]
  );

  const colunaKanbanLead = useCallback(
    (lead: Lead) => estagioParaColunaKanban(lead, estagiosKanbanIds),
    [estagiosKanbanIds]
  );

  useEffect(() => {
    const ch = supabase.channel("leads_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, (payload) => {
        const leadId =
          (payload.new as { id?: string } | null)?.id ??
          (payload.old as { id?: string } | null)?.id;
        if (leadId && pendingStageMovesRef.current.has(leadId)) return;
        if (realtimeInvalidateRef.current) clearTimeout(realtimeInvalidateRef.current);
        realtimeInvalidateRef.current = setTimeout(() => {
          void invalidateCrmLeadsList(queryClient);
        }, 600);
      })
      .subscribe();
    return () => {
      if (realtimeInvalidateRef.current) clearTimeout(realtimeInvalidateRef.current);
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const abrirEditLead = useCallback((lead: Lead) => {
    setEditLead(lead);
  }, []);

  useEffect(() => {
    if (!editLead) return;
    const fresh = leads.find((l) => l.id === editLead.id);
    if (!fresh) return;
    if (
      fresh.estagio !== editLead.estagio ||
      fresh.estagio_funil !== editLead.estagio_funil ||
      fresh.estagio_atendimento !== editLead.estagio_atendimento ||
      fresh.atualizado_em !== editLead.atualizado_em
    ) {
      setEditLead((prev) => (prev?.id === fresh.id ? { ...prev, ...fresh } : prev));
    }
  }, [leads, editLead?.id, editLead?.estagio, editLead?.estagio_funil, editLead?.estagio_atendimento, editLead?.atualizado_em]);

  async function moverEstagio(
    leadId: string,
    novoEstagio: string,
    extra?: Record<string, unknown>,
    options?: { optimistic?: boolean }
  ) {
    const leadAtual = leads.find((l) => l.id === leadId);
    const estagioAnterior = leadAtual?.estagio;

    if (options?.optimistic) {
      if (estagioAnterior && estagioParaColunaKanban(estagioAnterior, estagiosKanbanIds) === novoEstagio) {
        return true;
      }
      pendingStageMovesRef.current.add(leadId);
      patchLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, estagio: novoEstagio, estagio_funil: novoEstagio } : l
        )
      );
      if (editLead?.id === leadId) {
        setEditLead((d) =>
          d ? { ...d, estagio: novoEstagio, estagio_funil: novoEstagio } : null
        );
      }
    }

    const res = await patchLeadCrm(leadId, {
      estagio: novoEstagio,
      _estagio_anterior: estagioAnterior,
      ...extra,
    });

    if (options?.optimistic) {
      pendingStageMovesRef.current.delete(leadId);
    }

    if (!res.ok) {
      if (options?.optimistic && estagioAnterior) {
        patchLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, estagio: estagioAnterior, estagio_funil: estagioAnterior } : l
          )
        );
        if (editLead?.id === leadId) {
          setEditLead((d) =>
            d ? { ...d, estagio: estagioAnterior, estagio_funil: estagioAnterior } : null
          );
        }
      }
      toastError(res.error);
      return false;
    }

    const data = res.data as { estagio?: string; estagio_funil?: string };
    const est = String(data.estagio_funil ?? data.estagio ?? novoEstagio);
    patchLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, estagio: est, estagio_funil: est } : l)));
    if (editLead?.id === leadId) setEditLead((d) => (d ? { ...d, estagio: est, estagio_funil: est } : null));
    return true;
  }

  function onNegocioCreated(lead: Lead, negocioId: string) {
    refreshLeads();
    setSelectedNegocioId(negocioId);
  }

  const leadsDoPipeline = useMemo(
    () =>
      leads.filter((l) => {
    if (!pipelineAtivo) return true;
        if (l.pipeline_id === pipelineAtivo.id) return true;
        if (!l.pipeline_id && isPipelinePrincipal(pipelineAtivo, pipelines)) return true;
        return false;
      }),
    [leads, pipelineAtivo, pipelines]
  );

  const filtrados = useMemo(
    () =>
      leadsDoPipeline.filter((l) => {
    if (
      busca &&
      !l.nome.toLowerCase().includes(busca.toLowerCase()) &&
      !(l.telefone || "").includes(busca) &&
      !(l.codigo || "").toLowerCase().includes(busca.toLowerCase()) &&
      !(l._pessoa_codigo || "").toLowerCase().includes(busca.toLowerCase())
    ) {
      return false;
    }
    if (filtroEstagio && colunaKanbanLead(l) !== filtroEstagio) return false;
        if (filtroOrigem && l.origem !== filtroOrigem) return false;
        if (filtroScoreMin && l.score < Number(filtroScoreMin)) return false;
        if (filtroScoreMax && l.score > Number(filtroScoreMax)) return false;
        if (filtroDataInicio) {
          const inicio = new Date(filtroDataInicio);
          inicio.setHours(0, 0, 0, 0);
          if (new Date(l.criado_em) < inicio) return false;
        }
        if (filtroDataFim) {
          const fim = new Date(filtroDataFim);
          fim.setHours(23, 59, 59, 999);
          if (new Date(l.criado_em) > fim) return false;
        }
    return true;
      }),
    [
      leadsDoPipeline,
      busca,
      filtroEstagio,
      filtroOrigem,
      filtroScoreMin,
      filtroScoreMax,
      filtroDataInicio,
      filtroDataFim,
      colunaKanbanLead,
    ]
  );

  const filtradosIdsKey = useMemo(
    () => filtrados.map((l) => l.id).join(","),
    [filtrados]
  );

  useEffect(() => {
    const ids = filtradosIdsKey ? filtradosIdsKey.split(",") : [];
    if (!ids.length) {
      setNotasMap((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    let cancelled = false;
    void loadNotasPreviewMap(supabase, { leadIds: ids }).then((map) => {
      if (!cancelled) setNotasMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [filtradosIdsKey]);

  const recarregarNotasPreviews = useCallback(() => {
    const ids = filtradosIdsKey ? filtradosIdsKey.split(",") : [];
    if (!ids.length) {
      setNotasMap((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    void loadNotasPreviewMap(supabase, { leadIds: ids }).then(setNotasMap);
  }, [filtradosIdsKey]);

  const semResposta = leadsDoPipeline.filter(l => !["ganho", "perdido"].includes(l.estagio) && Date.now() - new Date(l.atualizado_em).getTime() > 86_400_000).length;
  const pipeline = leadsDoPipeline.filter(l => !["ganho", "perdido"].includes(l.estagio)).reduce((s, l) => s + l.valor_estimado, 0);
  const atendimentoAberto = leadsDoPipeline.filter(
    (l) => (l.estagio_atendimento || "novo") !== "fechado"
  ).length;
  const stageSparkline = useMemo(() => {
    const buckets = estagiosKanban.slice(0, 5).map(
      (est) => leadsDoPipeline.filter((l) => colunaKanbanLead(l) === est.id).length
    );
    return sparklineFromCounts(buckets);
  }, [estagiosKanban, leadsDoPipeline]);

  const pipelineCount = useCallback(
    (pid: string) => {
      const principal = pipelines[0]?.id;
      return leads.filter((l) => {
        if (l.pipeline_id === pid) return true;
        if (!l.pipeline_id && pid === principal) return true;
        return false;
      }).length;
    },
    [leads, pipelines]
  );

  const botaoNovoLead = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setLeadRapidoOpen(true)}
        style={crmHeaderPrimaryBtnStyle()}
      >
        + Novo lead
      </button>
    ),
    []
  );

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      subtitle: `${pipelineTitulo} · ${leadsDoPipeline.length} leads`,
      actions: botaoNovoLead,
    });
    return () => setSlot(null);
  }, [pathname, setSlot, pipelineTitulo, leadsDoPipeline.length, isMobile, botaoNovoLead]);

  const colunasLeads = useMemo((): CrmResizableColumn<Lead>[] => {
    const estagioInfo = (lead: Lead) =>
      estagiosKanban.find((e) => e.id === colunaKanbanLead(lead));
    const estagioAtendimentoInfo = (lead: Lead) =>
      estagiosAtendimento.find((e) => e.id === (lead.estagio_atendimento || "novo"));

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
        id: "atendimento",
        label: "Atendimento",
        defaultWidth: 130,
        minWidth: 100,
        render: (lead) => {
          const est = estagioAtendimentoInfo(lead);
          if (!est) return "—";
          return crmTableStagePill(est.label, est.color);
        },
      },
      {
        id: "valor",
        label: "Valor",
        defaultWidth: 100,
        minWidth: 80,
        align: "right",
        render: (lead) =>
          lead.valor_estimado > 0 ? moeda(lead.valor_estimado) : "—",
      },
      {
        id: "score",
        label: "Score",
        defaultWidth: 80,
        minWidth: 64,
        align: "center",
        render: (lead) =>
          crmTableStatusPill(String(lead.score), lead.score >= 50),
      },
      {
        id: "observacoes",
        label: "Observações",
        defaultWidth: 160,
        minWidth: 120,
        render: (lead) => (
          <CrmTableNotesCell notas={notasParaLead(notasMap, lead.id)} />
        ),
      },
      {
        id: "agente",
        label: "Agente",
        defaultWidth: 140,
        minWidth: 100,
        render: (lead) => lead.agente_responsavel || "—",
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
            {tempo(lead.atualizado_em)}
          </span>
        ),
      },
      {
        id: "criado",
        label: "Criado em",
        defaultWidth: 110,
        minWidth: 90,
        render: (lead) => formatData(lead.criado_em),
      },
    ];
  }, [estagiosKanban, estagiosAtendimento, notasMap]);

  const leadsExportConfig = useMemo(
    () => ({
      filename: `leads-${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        "Nome",
        "Origem",
        "Estágio",
        "Valor",
        "Score",
        "Agente",
        "Telefone",
        "Código",
        "Criado em",
      ],
      rowValues: (lead: Lead) => {
        const est = estagiosKanban.find((e) => e.id === colunaKanbanLead(lead));
        return [
          lead.nome,
          lead.origem ? ORIGENS_LABEL[lead.origem] || lead.origem : "",
          est?.label || lead.estagio,
          lead.valor_estimado > 0 ? String(lead.valor_estimado) : "",
          String(lead.score),
          lead.agente_responsavel || "",
          lead.telefone || "",
          lead.codigo || lead._pessoa_codigo || "",
          formatData(lead.criado_em),
        ];
      },
    }),
    [estagiosKanban]
  );

  const leadsFooterSummary =
    filtrados.length > 0
      ? `Exibindo 1-${filtrados.length} de ${leadsDoPipeline.length} leads`
      : `Exibindo 0 de ${leadsDoPipeline.length} leads`;

  const onViewChange = useCallback(
    (v: CrmPipelineViewMode) => {
      if (v === "atendimentos") {
        router.push("/crm/atendimentos");
        return;
      }
      setView(v);
      const p = new URLSearchParams(searchParams.toString());
      p.set("view", v);
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const pipelineToolbar = (
    <CrmPipelinePageToolbar
      pipelines={pipelines}
      activePipelineId={pipelineId}
      onSelectPipeline={setPipelineId}
      pipelinesLoading={pipelinesLeadQuery.isPending && pipelines.length === 0}
      pipelineCount={pipelineCount}
      view={view}
      onViewChange={onViewChange}
      sectionLabel={view === "lista" ? "LISTA" : "KANBAN"}
      showListFilters={view === "lista"}
      searchValue={busca}
      onSearchChange={setBusca}
      searchPlaceholder="Buscar nome, telefone ou código…"
      stageValue={filtroEstagio}
      onStageChange={setFiltroEstagio}
      stages={estagiosKanban}
      stageFilterLabel="Todos os estágios"
      showingCount={filtrados.length}
      showingLabel="leads"
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

  if (leadsInitialLoading) {
    return <CrmLeadsPageSkeleton />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">

      {sucessoLead && (
        <div
          role="status"
          className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-lg border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] px-3 py-2 text-sm text-[#3fb950]"
        >
          <span>{sucessoLead}</span>
          <button
            type="button"
            onClick={() => setSucessoLead(null)}
            className="border-0 bg-transparent text-lg leading-none text-[#5d7a67] hover:text-white"
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      )}

      {pipelineToolbar}

      {isMobile && (
        <div className="sticky top-0 z-20 shrink-0 border-b border-[#dcebd8] bg-[#ffffff] px-3 py-3">
          {botaoNovoLead}
        </div>
      )}

      {/* ─── METRICS ─── */}
      <div className={`shrink-0 border-b border-[#dcebd8] bg-[#f8fcf6] py-3 ${crmRetrofitPageXClass}`}>
        <CrmMetricsGrid cols={4}>
          <CrmMetricCard
            label="Leads no funil"
            valor={leadsDoPipeline.length}
            tone="default"
            sub={pipelineTitulo}
            sparkline={stageSparkline}
          />
          <CrmMetricCard
            label="Pipeline"
            valor={moeda(pipeline)}
            tone="success"
            sub="Valor em aberto"
            sparkline={sparklineFromSeed(Math.round(pipeline / 1000) + 1)}
          />
          <CrmMetricCard
            label="Sem resposta +24h"
            valor={semResposta}
            tone={semResposta > 0 ? "danger" : "muted"}
            sub="Precisam de follow-up"
            sparkline={sparklineFromSeed(semResposta + 7)}
            trend={
              leadsDoPipeline.length > 0 && semResposta > 0
                ? {
                    label: trendLabel(semResposta, leadsDoPipeline.length) ?? "—",
                    positive: false,
                  }
                : undefined
            }
          />
          <CrmMetricCard
            label="Atendimento aberto"
            valor={atendimentoAberto}
            tone="success"
            sub="Fora de Fechado"
            progress={{
              value: atendimentoAberto,
              max: Math.max(leadsDoPipeline.length, 1),
              hint: `${atendimentoAberto} leads`,
            }}
          />
        </CrmMetricsGrid>
      </div>

      {/* ─── MAIN ─── */}
      <div className="flex-1 overflow-hidden">
        {view === "kanban" ? (

          /* KANBAN */
          <CrmKanbanBoardScroll isMobile={isMobile}>
            {estagiosKanban.map(est => {
              const col = filtrados.filter((l) => colunaKanbanLead(l) === est.id);
              const total = col.reduce((s, l) => s + l.valor_estimado, 0);
              return (
                <CrmKanbanColumn
                  key={est.id}
                  stageId={est.id}
                  label={est.label}
                  color={est.color}
                  count={col.length}
                  totalValue={total > 0 ? moeda(total) : null}
                  dragOver={dragOver === est.id}
                  isMobile={isMobile}
                    onDragOver={e => { e.preventDefault(); setDragOver(est.id); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                  onDrop={e => { e.preventDefault(); const lid = e.dataTransfer.getData("leadId"); if (lid) void moverEstagio(lid, est.id, undefined, { optimistic: true }); setLeadDragId(null); setDragOver(null); }}
                >
                    {col.map(lead => (
                      <LeadKanbanCard
                        key={lead.id}
                        lead={lead}
                        notas={notasParaLead(notasMap, lead.id)}
                        stageLabel={est.label}
                        stageColor={est.color}
                        dragging={leadDragId === lead.id}
                        isMobile={isMobile}
                        draggable={!isMobile}
                        onDragStart={e => {
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
                    {col.length === 0 && <p className="py-4 text-center text-xs text-[#484f58]">vazio</p>}
                </CrmKanbanColumn>
              );
            })}
          </CrmKanbanBoardScroll>

        ) : (

          /* LISTA */
          <div className={`h-full overflow-y-auto pb-4 pt-3 ${crmRetrofitPageXClass}`}>
            <CrmRetrofitTablePanel
              tableId="crm-leads-lista"
              columns={colunasLeads}
              rows={filtrados}
              rowKey={(lead) => lead.id}
              emptyMessage="Nenhum lead encontrado"
              footerSummary={leadsFooterSummary}
              onRowClick={abrirEditLead}
              onEditRow={abrirEditLead}
              onViewRow={abrirEditLead}
              exportConfig={leadsExportConfig}
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
                    <CrmRetrofitFilterField label="Score mínimo">
                  <input
                        type="number"
                        min={0}
                        max={100}
                        value={filtroScoreMin}
                        onChange={(e) => setFiltroScoreMin(e.target.value)}
                        placeholder="0"
                        className={crmRetrofitFilterInputClass}
                      />
                    </CrmRetrofitFilterField>
                    <CrmRetrofitFilterField label="Score máximo">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={filtroScoreMax}
                        onChange={(e) => setFiltroScoreMax(e.target.value)}
                        placeholder="100"
                        className={crmRetrofitFilterInputClass}
                      />
                    </CrmRetrofitFilterField>
                    <CrmRetrofitFilterField label="Criado a partir de">
                      <input
                        type="date"
                        value={filtroDataInicio}
                        onChange={(e) => setFiltroDataInicio(e.target.value)}
                        className={crmRetrofitFilterInputClass}
                      />
                    </CrmRetrofitFilterField>
                    <CrmRetrofitFilterField label="Criado até">
                      <input
                        type="date"
                        value={filtroDataFim}
                        onChange={(e) => setFiltroDataFim(e.target.value)}
                        className={crmRetrofitFilterInputClass}
                      />
                    </CrmRetrofitFilterField>
                  </CrmRetrofitAdvancedFiltersGrid>
                ),
              }}
            />
          </div>
        )}
      </div>

      <LeadEditSideover
        open={!!editLead}
        lead={editLead}
        estagios={estagiosKanban}
        initialTab={sideoverInitialTab}
        context="vendas"
        salesTimelineOnly
        isMobile={isMobile}
        onClose={() => {
          setEditLead(null);
          setSideoverInitialTab(undefined);
        }}
        onUpdated={(updated) => {
          patchLeads((prev) =>
            prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
          );
          setEditLead((prev) =>
            prev?.id === updated.id ? { ...prev, ...updated } : prev
          );
        }}
        onNotasChanged={recarregarNotasPreviews}
        onEncaminhado={(lead) => {
          void moverEstagio(lead.id, "encaminhado");
          refreshLeads();
        }}
        onNegocioCreated={(lead, negocioId) => void onNegocioCreated(lead as Lead, negocioId)}
        onOpenNegocio={(negocioId) => setSelectedNegocioId(negocioId)}
      />

      <NegocioDetailSideover
        open={!!selectedNegocioId}
        negocioId={selectedNegocioId}
        onClose={() => setSelectedNegocioId(null)}
      />

      {leadRapidoOpen && (
        <LeadRapidoSideover
          open={leadRapidoOpen}
          activePipelineId={pipelineId}
          onClose={() => setLeadRapidoOpen(false)}
          onSaved={(lead) => {
            const cod = lead.codigo ? ` (${lead.codigo})` : "";
            setSucessoLead(`Lead criado${cod}.`);
            refreshLeads();
          }}
        />
      )}

      <PipelineConfigSideover
        open={pipelineConfigOpen}
        onClose={() => {
          setPipelineConfigOpen(false);
          setPipelineConfigFocusCreate(false);
        }}
        tipo="lead"
        pipelineId={pipelineId}
        focusCreate={pipelineConfigFocusCreate}
        onSelectPipeline={(id) => setPipelineId(id)}
        onUpdated={() => {
          void invalidateCrmPipelines(queryClient, "lead");
        }}
      />
    </div>
  );
}

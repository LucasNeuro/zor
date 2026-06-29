"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import {
  CrmPipelinePageToolbar,
  type CrmPipelineViewMode,
} from "@/components/crm/pipelines/CrmPipelinePageToolbar";
import { CrmKanbanBoardScroll } from "@/components/crm/pipelines/CrmKanbanBoardScroll";
import { CrmKanbanColumn } from "@/components/crm/pipelines/CrmKanbanColumn";
import type { CrmResizableColumn } from "@/components/crm/CrmResizableDataTable";
import {
  CrmRetrofitTablePanel,
  crmRetrofitPageXClass,
  crmTableIdBadge,
  crmTableStagePill,
} from "@/components/crm/CrmRetrofitTablePanel";
import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import { CrmSegmentedPills } from "@/components/crm/CrmSegmentedPills";
import { CrmTableNotesCell } from "@/components/crm/CrmTableNotesCell";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import {
  formatDataAtendimento,
  leadEmAtendimentoAberto,
  estagioAtendimentoColuna,
  estagiosAtendimentoFromPipeline,
  tempo,
  type AtendimentoCanalFilter,
} from "@/lib/crm/atendimento-shared";
import { useCrmToast } from "@/lib/crm/crm-feedback";
import { leadEhCanalEmail, leadEhCanalWhatsapp } from "@/lib/crm/lead-canal";
import {
  loadNotasPreviewMap,
  notasParaLead,
} from "@/lib/crm/load-notas-preview";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { sparklineFromCounts, sparklineFromSeed } from "@/lib/crm/metric-visuals";
import {
  effectiveHumanoResponsavel,
  formatHumanoDisplayName,
} from "@/lib/crm/resolve-crm-actor";
import { isEmailChannelEnabledClient } from "@/lib/feature-flags";
import type { NotaPreview } from "@/components/crm/CrmKanbanNotesSection";
import {
  invalidateCrmLeadsList,
  patchCrmLeadsListCache,
  useCrmLeadsList,
  type CrmLeadRow,
} from "@/hooks/useCrmLeadsQueries";
import { invalidateCrmPipelines, useCrmPipelines } from "@/hooks/useCrmDataQueries";
import { CrmLeadsPageSkeleton } from "@/components/crm/leads/CrmLeadsPageSkeleton";

const AtendimentoKanbanCard = dynamic(
  () =>
    import("@/components/crm/atendimento/AtendimentoKanbanCard").then((m) => ({
      default: m.AtendimentoKanbanCard,
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

type Lead = CrmLeadRow;

type AtendimentoViewMode = Extract<CrmPipelineViewMode, "kanban" | "lista">;

export function AtendimentosCrmPage() {
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
  const initialLoading = leadsQuery.isPending && leadsQuery.data === undefined;
  const pipelinesQuery = useCrmPipelines("atendimento");

  const patchLeads = useCallback(
    (updater: (prev: Lead[]) => Lead[]) => patchCrmLeadsListCache(queryClient, updater),
    [queryClient]
  );

  const [view, setView] = useState<AtendimentoViewMode>("kanban");
  const [busca, setBusca] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState("");
  const [atendimentoCanal, setAtendimentoCanal] = useState<AtendimentoCanalFilter>("whatsapp");
  const [emailAtendimentos, setEmailAtendimentos] = useState<Lead[]>([]);
  const [loadingEmailAtendimentos, setLoadingEmailAtendimentos] = useState(false);
  const [notasMap, setNotasMap] = useState<Map<string, NotaPreview[]>>(new Map());
  const [leadDragId, setLeadDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pipelineConfigOpen, setPipelineConfigOpen] = useState(false);
  const [pipelineConfigFocusCreate, setPipelineConfigFocusCreate] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const pendingStageMovesRef = useRef(new Set<string>());
  const realtimeInvalidateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pipelines = useMemo(() => pipelinesQuery.data ?? [], [pipelinesQuery.data]);

  const estagiosAtendimento = useMemo(() => {
    const pipe = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];
    return estagiosAtendimentoFromPipeline(pipe?.estagios);
  }, [pipelines, pipelineId]);

  useEffect(() => {
    if (!pipelines.length) return;
    setPipelineId((prev) => {
      if (prev && pipelines.some((p) => p.id === prev)) return prev;
      return pipelines[0]?.id ?? null;
    });
  }, [pipelines]);

  useEffect(() => {
    const v = searchParams.get("view");
    const est = searchParams.get("estagio");
    if (v === "kanban" || v === "lista") setView(v);
    if (est) setFiltroEstagio(est);
  }, [searchParams]);

  useEffect(() => {
    const ch = supabase
      .channel("atendimentos_rt")
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

  const carregarEmailAtendimentos = useCallback(async () => {
    if (!isEmailChannelEnabledClient()) return;
    setLoadingEmailAtendimentos(true);
    try {
      const headers = await crmApiHeaders();
      const params = new URLSearchParams();
      if (filtroEstagio) params.set("estagio_atendimento", filtroEstagio);
      const q = params.toString();
      const res = await fetch(`/api/crm/atendimento/email${q ? `?${q}` : ""}`, { headers });
      const json = (await res.json()) as { leads?: Lead[] };
      if (res.ok) setEmailAtendimentos(json.leads ?? []);
    } catch {
      setEmailAtendimentos([]);
    } finally {
      setLoadingEmailAtendimentos(false);
    }
  }, [filtroEstagio]);

  useEffect(() => {
    if (atendimentoCanal === "email") void carregarEmailAtendimentos();
  }, [atendimentoCanal, carregarEmailAtendimentos]);

  const leadsAbertosWhatsapp = useMemo(
    () =>
      leads.filter(
        (l) =>
          leadEmAtendimentoAberto(l) &&
          leadEhCanalWhatsapp(l) &&
          !leadEhCanalEmail(l)
      ),
    [leads]
  );

  const filtradosWhatsapp = useMemo(
    () =>
      leadsAbertosWhatsapp.filter((l) => {
        if (filtroEstagio && estagioAtendimentoColuna(l) !== filtroEstagio) return false;
        if (!busca.trim()) return true;
        const hay = [l.nome, l.telefone, l.codigo, l._pessoa_codigo, l.agente_responsavel]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(busca.trim().toLowerCase());
      }),
    [leadsAbertosWhatsapp, filtroEstagio, busca]
  );

  const filtradosEmail = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return emailAtendimentos.filter((l) => {
      if (!leadEmAtendimentoAberto(l)) return false;
      if (filtroEstagio && estagioAtendimentoColuna(l) !== filtroEstagio) return false;
      if (!termo) return true;
      const hay = [
        l.nome,
        l.email,
        l._email_exibicao,
        l.ultima_mensagem_email,
        l.ultimo_assunto_email,
        l.agente_responsavel,
        l.humano_responsavel,
        l.codigo,
        l._pessoa_codigo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(termo);
    });
  }, [emailAtendimentos, busca, filtroEstagio]);

  const rows = atendimentoCanal === "email" ? filtradosEmail : filtradosWhatsapp;
  const totalAbertos =
    atendimentoCanal === "email"
      ? emailAtendimentos.filter(leadEmAtendimentoAberto).length
      : leadsAbertosWhatsapp.length;

  const filtradosIdsKey = useMemo(() => rows.map((l) => l.id).join(","), [rows]);

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

  const abrirAtendimento = useCallback(
    (lead: Lead, tab?: "chat" | "conversas_email") => {
      const q = tab ? `?tab=${tab}` : "";
      router.push(`/crm/atendimentos/${lead.id}${q}`);
    },
    [router]
  );

  async function moverEstagioAtendimento(
    leadId: string,
    novoEstagio: string,
    options?: { optimistic?: boolean }
  ) {
    const leadAtual = leads.find((l) => l.id === leadId);
    const estagioAnterior = leadAtual?.estagio_atendimento || "novo";

    if (options?.optimistic) {
      if (estagioAnterior === novoEstagio) return true;
      pendingStageMovesRef.current.add(leadId);
      patchLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, estagio_atendimento: novoEstagio } : l
        )
      );
    }

    const res = await patchLeadCrm(leadId, { estagio_atendimento: novoEstagio });

    if (options?.optimistic) pendingStageMovesRef.current.delete(leadId);

    if (!res.ok) {
      if (options?.optimistic) {
        patchLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, estagio_atendimento: estagioAnterior } : l
          )
        );
      }
      toastError(res.error);
      return false;
    }

    const data = res.data as { estagio_atendimento?: string };
    patchLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, estagio_atendimento: String(data.estagio_atendimento ?? novoEstagio) }
          : l
      )
    );
    return true;
  }

  const emHumano = rows.filter((l) => effectiveHumanoResponsavel(l.humano_responsavel)).length;
  const semResposta24h = rows.filter((l) => {
    const iso = l.ultima_mensagem_fila_em || l.atualizado_em;
    return iso && Date.now() - new Date(iso).getTime() > 86_400_000;
  }).length;

  const stageSparkline = useMemo(() => {
    const buckets = estagiosAtendimento
      .filter((e) => e.id !== "fechado")
      .slice(0, 5)
      .map((est) => rows.filter((l) => estagioAtendimentoColuna(l) === est.id).length);
    return sparklineFromCounts(buckets);
  }, [estagiosAtendimento, rows]);

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      subtitle: `Atendimentos · ${totalAbertos} abertos`,
      actions: null,
    });
    return () => setSlot(null);
  }, [pathname, setSlot, totalAbertos, isMobile]);

  const onViewChange = useCallback(
    (v: CrmPipelineViewMode) => {
      if (v === "atendimentos") return;
      const next = v as AtendimentoViewMode;
      setView(next);
      const p = new URLSearchParams(searchParams.toString());
      p.set("view", next);
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const colunasWhatsapp = useMemo((): CrmResizableColumn<Lead>[] => {
    const estagioInfo = (lead: Lead) =>
      estagiosAtendimento.find((e) => e.id === estagioAtendimentoColuna(lead));

    return [
      {
        id: "nome",
        label: "Lead",
        defaultWidth: 180,
        minWidth: 130,
        render: (lead) => <span className="font-semibold text-[#0b2210]">{lead.nome}</span>,
      },
      {
        id: "estagio",
        label: "Estágio",
        defaultWidth: 130,
        minWidth: 100,
        render: (lead) => {
          const est = estagioInfo(lead);
          return est ? crmTableStagePill(est.label, est.color) : "—";
        },
      },
      {
        id: "humano",
        label: "Consultor",
        defaultWidth: 130,
        minWidth: 100,
        render: (lead) => {
          const h = effectiveHumanoResponsavel(lead.humano_responsavel);
          return h ? formatHumanoDisplayName(h) : "—";
        },
      },
      {
        id: "ultima_msg",
        label: "Última mensagem",
        defaultWidth: 220,
        minWidth: 140,
        render: (lead) => {
          const txt = lead.ultima_mensagem_fila?.trim();
          if (!txt) return <span className="text-[#6b8a76]">—</span>;
          return (
            <span className="line-clamp-2 text-[13px] text-[#374151]" title={txt}>
              {txt}
            </span>
          );
        },
      },
      {
        id: "agente",
        label: "Agente IA",
        defaultWidth: 120,
        minWidth: 90,
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
        render: (lead) => {
          const iso = lead.ultima_mensagem_fila_em || lead.atualizado_em;
          return (
            <span className="text-[#6b8a76]" title={formatDataAtendimento(iso)}>
              {tempo(iso)}
            </span>
          );
        },
      },
      {
        id: "observacoes",
        label: "Observações",
        defaultWidth: 140,
        minWidth: 100,
        render: (lead) => <CrmTableNotesCell notas={notasParaLead(notasMap, lead.id)} />,
      },
    ];
  }, [estagiosAtendimento, notasMap]);

  const colunasEmail = useMemo((): CrmResizableColumn<Lead>[] => {
    const estagioInfo = (lead: Lead) =>
      estagiosAtendimento.find((e) => e.id === estagioAtendimentoColuna(lead));

    return [
      {
        id: "nome",
        label: "Lead",
        defaultWidth: 160,
        minWidth: 120,
        render: (lead) => <span className="font-semibold text-[#0b2210]">{lead.nome}</span>,
      },
      {
        id: "email",
        label: "E-mail",
        defaultWidth: 180,
        minWidth: 140,
        render: (lead) => lead.email || lead._email_exibicao || "—",
      },
      {
        id: "assunto",
        label: "Assunto",
        defaultWidth: 160,
        minWidth: 120,
        render: (lead) => lead.ultimo_assunto_email || "—",
      },
      {
        id: "estagio",
        label: "Estágio",
        defaultWidth: 120,
        minWidth: 100,
        render: (lead) => {
          const est = estagioInfo(lead);
          return est ? crmTableStagePill(est.label, est.color) : "—";
        },
      },
      {
        id: "humano",
        label: "Consultor",
        defaultWidth: 120,
        minWidth: 100,
        render: (lead) => {
          const h = effectiveHumanoResponsavel(lead.humano_responsavel);
          return h ? formatHumanoDisplayName(h) : "—";
        },
      },
      {
        id: "ultima_msg",
        label: "Última mensagem",
        defaultWidth: 220,
        minWidth: 140,
        render: (lead) => {
          const txt = lead.ultima_mensagem_email?.trim();
          if (!txt) return <span className="text-[#6b8a76]">—</span>;
          return (
            <span className="line-clamp-2 text-[13px] text-[#374151]" title={txt}>
              {txt}
            </span>
          );
        },
      },
      {
        id: "atualizado",
        label: "Atualizado",
        defaultWidth: 110,
        minWidth: 90,
        render: (lead) => (
          <span className="text-[#6b8a76]" title={formatDataAtendimento(lead.atualizado_em)}>
            {tempo(lead.atualizado_em)}
          </span>
        ),
      },
    ];
  }, [estagiosAtendimento]);

  const exportConfig = useMemo(
    () => ({
      filename: `atendimentos-${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        "Lead",
        "Estágio",
        "Consultor",
        "Agente",
        "Telefone",
        "Código",
        "Última mensagem",
        "Atualizado",
      ],
      rowValues: (lead: Lead) => {
        const est = estagiosAtendimento.find((e) => e.id === estagioAtendimentoColuna(lead));
        const humano = effectiveHumanoResponsavel(lead.humano_responsavel);
        return [
          lead.nome,
          est?.label || estagioAtendimentoColuna(lead),
          humano ? formatHumanoDisplayName(humano) : "",
          lead.agente_responsavel || "",
          lead.telefone || "",
          lead.codigo || lead._pessoa_codigo || "",
          lead.ultima_mensagem_fila || lead.ultima_mensagem_email || "",
          formatDataAtendimento(lead.ultima_mensagem_fila_em || lead.atualizado_em),
        ];
      },
    }),
    [estagiosAtendimento]
  );

  const footerSummary =
    rows.length > 0
      ? `Exibindo 1-${rows.length} de ${totalAbertos} atendimentos abertos${
          atendimentoCanal === "email" ? " (e-mail)" : " (WhatsApp)"
        }`
      : `Exibindo 0 de ${totalAbertos} atendimentos abertos${
          atendimentoCanal === "email" ? " (e-mail)" : " (WhatsApp)"
        }`;

  const estagiosKanban = estagiosAtendimento.filter((e) => e.id !== "fechado");

  if (initialLoading) {
    return <CrmLeadsPageSkeleton />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">
      <CrmPipelinePageToolbar
        pipelines={pipelines.map((p) => ({
          id: p.id,
          slug: p.slug,
          nome: p.nome,
          mercado_sigla: p.mercado_sigla,
        }))}
        activePipelineId={pipelineId}
        onSelectPipeline={setPipelineId}
        pipelinesLoading={pipelinesQuery.isPending && pipelines.length === 0}
        view={view}
        onViewChange={onViewChange}
        hidePipelines={pipelines.length <= 1}
        sectionLabel={view === "lista" ? "LISTA" : "KANBAN"}
        showListFilters={view === "lista"}
        searchValue={busca}
        onSearchChange={setBusca}
        searchPlaceholder={
          atendimentoCanal === "email"
            ? "Buscar lead, e-mail ou assunto…"
            : "Buscar lead em atendimento…"
        }
        stageValue={filtroEstagio}
        onStageChange={setFiltroEstagio}
        stages={estagiosAtendimento.filter((e) => e.id !== "fechado")}
        stageFilterLabel="Todos os estágios de atendimento"
        showingCount={rows.length}
        showingLabel="atendimentos"
        extra={
          isEmailChannelEnabledClient() ? (
            <CrmSegmentedPills
              items={[
                {
                  key: "whatsapp",
                  label: "WhatsApp",
                  active: atendimentoCanal === "whatsapp",
                  onClick: () => setAtendimentoCanal("whatsapp"),
                },
                {
                  key: "email",
                  label: "E-mail",
                  active: atendimentoCanal === "email",
                  onClick: () => setAtendimentoCanal("email"),
                },
              ]}
              aria-label="Canal de atendimento"
            />
          ) : null
        }
        onOpenStages={() => {
          setPipelineConfigFocusCreate(false);
          setPipelineConfigOpen(true);
        }}
        onCreatePipeline={() => {
          setPipelineConfigFocusCreate(true);
          setPipelineConfigOpen(true);
        }}
      />

      <div className={`shrink-0 border-b border-[#dcebd8] bg-[#f8fcf6] py-3 ${crmRetrofitPageXClass}`}>
        <CrmMetricsGrid cols={4}>
          <CrmMetricCard
            label="Abertos"
            valor={totalAbertos}
            tone="success"
            sub={atendimentoCanal === "email" ? "Canal e-mail" : "Canal WhatsApp"}
            sparkline={stageSparkline}
          />
          <CrmMetricCard
            label="Na fila"
            valor={rows.length}
            tone="default"
            sub="Após filtros"
            sparkline={sparklineFromSeed(rows.length + 3)}
          />
          <CrmMetricCard
            label="Com consultor"
            valor={emHumano}
            tone={emHumano > 0 ? "success" : "muted"}
            sub="Atendimento humano"
            sparkline={sparklineFromSeed(emHumano + 2)}
          />
          <CrmMetricCard
            label="Sem resposta +24h"
            valor={semResposta24h}
            tone={semResposta24h > 0 ? "danger" : "muted"}
            sub="Precisam de follow-up"
            sparkline={sparklineFromSeed(semResposta24h + 5)}
          />
        </CrmMetricsGrid>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === "kanban" ? (
          <CrmKanbanBoardScroll isMobile={isMobile}>
            {estagiosKanban.map((est) => {
              const col = rows.filter((l) => estagioAtendimentoColuna(l) === est.id);
              return (
                <CrmKanbanColumn
                  key={est.id}
                  stageId={est.id}
                  label={est.label}
                  color={est.color}
                  count={col.length}
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
                    if (lid) void moverEstagioAtendimento(lid, est.id, { optimistic: true });
                    setLeadDragId(null);
                    setDragOver(null);
                  }}
                >
                  {col.map((lead) => (
                    <AtendimentoKanbanCard
                      key={lead.id}
                      lead={lead}
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
                      onOpen={() => abrirAtendimento(lead)}
                      onOpenChat={() =>
                        abrirAtendimento(
                          lead,
                          atendimentoCanal === "email" ? "conversas_email" : "chat"
                        )
                      }
                    />
                  ))}
                  {col.length === 0 && (
                    <p className="py-4 text-center text-xs text-[#484f58]">vazio</p>
                  )}
                </CrmKanbanColumn>
              );
            })}
          </CrmKanbanBoardScroll>
        ) : (
          <div className={`h-full overflow-y-auto pb-4 pt-3 ${crmRetrofitPageXClass}`}>
            {atendimentoCanal === "email" && loadingEmailAtendimentos ? (
              <p className="px-4 py-8 text-center text-sm text-[#6b8a76]">
                A carregar atendimentos de e-mail…
              </p>
            ) : (
              <CrmRetrofitTablePanel
                tableId={
                  atendimentoCanal === "email"
                    ? "crm-atendimentos-email"
                    : "crm-atendimentos-whatsapp"
                }
                columns={atendimentoCanal === "email" ? colunasEmail : colunasWhatsapp}
                rows={rows}
                rowKey={(lead) => lead.id}
                emptyMessage={
                  atendimentoCanal === "email"
                    ? "Nenhum atendimento de e-mail aberto"
                    : "Nenhum atendimento aberto"
                }
                footerSummary={footerSummary}
                onRowClick={(lead) =>
                  abrirAtendimento(
                    lead,
                    atendimentoCanal === "email" ? "conversas_email" : "chat"
                  )
                }
                onEditRow={(lead) =>
                  abrirAtendimento(
                    lead,
                    atendimentoCanal === "email" ? "conversas_email" : "chat"
                  )
                }
                onViewRow={(lead) =>
                  abrirAtendimento(
                    lead,
                    atendimentoCanal === "email" ? "conversas_email" : "chat"
                  )
                }
                exportConfig={exportConfig}
              />
            )}
          </div>
        )}
      </div>

      <PipelineConfigSideover
        open={pipelineConfigOpen}
        onClose={() => {
          setPipelineConfigOpen(false);
          setPipelineConfigFocusCreate(false);
        }}
        tipo="atendimento"
        pipelineId={pipelineId}
        focusCreate={pipelineConfigFocusCreate}
        onUpdated={() => {
          void invalidateCrmPipelines(queryClient, "atendimento");
          void invalidateCrmLeadsList(queryClient);
        }}
      />
    </div>
  );
}

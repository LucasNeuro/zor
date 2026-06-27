"use client";

import type { ReactNode } from "react";
import { labelPipelineTab } from "@/lib/crm/tenant-pipelines";
import { CRM_LIST_SECTION_LABEL, crmListSearchStyle, crmListSelectStyle } from "@/lib/crm/crm-list-pill-styles";
import { CrmSegmentedPills } from "@/components/crm/CrmSegmentedPills";
import type { PipelineTabItem } from "@/components/crm/pipelines/PipelineTabsBar";

export type CrmPipelineViewMode = "kanban" | "lista" | "atendimentos";

export type CrmPipelineStageOption = { id: string; label: string };

type Props = {
  pipelines: PipelineTabItem[];
  activePipelineId: string | null;
  onSelectPipeline: (id: string) => void;
  pipelineCount?: (pipelineId: string) => number | undefined;
  view: CrmPipelineViewMode;
  onViewChange: (view: CrmPipelineViewMode) => void;
  onOpenStages?: () => void;
  onCreatePipeline?: () => void;
  /** Oculta tabs de pipeline e botão + Pipeline (ex.: Negócios = funil único). */
  hidePipelines?: boolean;
  /** Exibe botão «Atendimentos» (tabela de fila de atendimento). */
  showAtendimentosView?: boolean;
  sectionLabel?: string;
  /** Busca e filtro de estágio (modo lista). */
  showListFilters?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  stageValue?: string;
  onStageChange?: (value: string) => void;
  stages?: CrmPipelineStageOption[];
  stageFilterLabel?: string;
  showingCount?: number;
  showingLabel?: string;
  /** Evita «Nenhum pipeline» enquanto a lista ainda carrega. */
  pipelinesLoading?: boolean;
  extra?: ReactNode;
};

export function CrmPipelinePageToolbar({
  pipelines,
  activePipelineId,
  onSelectPipeline,
  pipelineCount,
  view,
  onViewChange,
  onOpenStages,
  onCreatePipeline,
  hidePipelines = false,
  showAtendimentosView = false,
  sectionLabel = "LISTA",
  showListFilters = false,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar…",
  stageValue = "",
  onStageChange,
  stages = [],
  stageFilterLabel = "Todos os estágios",
  showingCount,
  showingLabel = "registos",
  pipelinesLoading = false,
  extra,
}: Props) {
  const pipelineItems = pipelines.map((pipe) => {
    const count = pipelineCount?.(pipe.id);
    const label = labelPipelineTab(pipe) || "Pipeline";
    return {
      key: pipe.id,
      label: `${label}${typeof count === "number" ? ` (${count})` : ""}`,
      active: activePipelineId === pipe.id,
      onClick: () => onSelectPipeline(pipe.id),
      title: pipe.nome,
    };
  });

  const configItems = [
    ...(!hidePipelines && onCreatePipeline
      ? [
          {
            key: "create-pipeline",
            label: "+ Pipeline",
            active: false,
            onClick: onCreatePipeline,
            title: "Criar novo pipeline",
          },
        ]
      : []),
    ...(onOpenStages
      ? [
          {
            key: "stages",
            label: "Estágios",
            active: false,
            onClick: onOpenStages,
            title: "Configurar estágios do pipeline activo",
          },
        ]
      : []),
  ];

  return (
    <div className="shrink-0 border-b border-[#dcebd8] bg-[#f8fcf6] px-6 py-6">
      <p style={CRM_LIST_SECTION_LABEL}>{sectionLabel}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {!hidePipelines && pipelineItems.length > 0 ? (
          <CrmSegmentedPills items={pipelineItems} aria-label="Pipelines" />
        ) : null}
        {!hidePipelines && pipelinesLoading ? (
          <span style={{ fontSize: 12, color: "#6b8a76" }}>Carregando pipelines…</span>
        ) : null}
        {!hidePipelines && !pipelinesLoading && pipelineItems.length === 0 ? (
          <span style={{ fontSize: 12, color: "#6b8a76" }}>Nenhum pipeline — crie o primeiro abaixo.</span>
        ) : null}

        <CrmSegmentedPills
          items={[
            { key: "kanban", label: "Kanban", active: view === "kanban", onClick: () => onViewChange("kanban") },
            { key: "lista", label: "Lista", active: view === "lista", onClick: () => onViewChange("lista") },
            ...(showAtendimentosView
              ? [
                  {
                    key: "atendimentos",
                    label: "Atendimentos",
                    active: view === "atendimentos",
                    onClick: () => onViewChange("atendimentos"),
                  },
                ]
              : []),
          ]}
          aria-label="Visualização"
        />

        {configItems.length > 0 ? (
          <CrmSegmentedPills items={configItems} aria-label="Configuração de pipeline" />
        ) : null}

        {extra}

        {showListFilters ? (
          <>
            <select
              aria-label="Filtrar por estágio"
              value={stageValue}
              onChange={(e) => onStageChange?.(e.target.value)}
              style={{ ...crmListSelectStyle(), marginLeft: 4 }}
            >
              <option value="">{stageFilterLabel}</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              style={{ ...crmListSearchStyle(), marginLeft: 4, flex: "1 1 220px" }}
            />
            {typeof showingCount === "number" ? (
              <span style={{ fontSize: 12, color: "#6b8a76", marginLeft: 6 }}>
                mostrando: {showingCount} {showingLabel}
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

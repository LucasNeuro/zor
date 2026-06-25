"use client";

import type { CSSProperties } from "react";
import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Bell,
  CheckCircle2,
  Image as ImageIcon,
  LocateFixed,
  MessageSquare,
  Play,
  Save,
  Workflow,
} from "lucide-react";
import { formatarGatilhoConfig } from "@/lib/hub/followup-types";
import type { FollowupTipoConteudo, HubAgenteFollowupConfig, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { buildFollowupPanelStyles, followupToolbarGroup } from "./followup-flow-panel-styles";
import type { FollowupFlowCanvasApi } from "./FollowupFlowCanvas";

const FollowupFlowCanvas = dynamic(
  () => import("./FollowupFlowCanvas").then((m) => m.FollowupFlowCanvas),
  {
    ssr: false,
    loading: () => (
      <div style={loadingStyle}>
        <Workflow size={20} style={{ opacity: 0.35 }} />
        <span>A carregar diagrama…</span>
      </div>
    ),
  }
);

export type { FollowupFlowCanvasApi };

type Props = {
  agenteSlug: string;
  config: HubAgenteFollowupConfig;
  passos: HubAgenteFollowupPasso[];
  saving: boolean;
  uploadingId: string | null;
  disabled?: boolean;
  theme?: "dark" | "light";
  toolbarTheme?: "dark" | "light";
  fullscreen?: boolean;
  hasUnsavedChanges?: boolean;
  onCanvasDirty?: () => void;
  onSaveDraft?: () => void | Promise<void>;
  onSaveDraftAndClose?: () => void | Promise<void>;
  onIniciarEmBranco?: () => void | Promise<void>;
  onSalvarConfig: (patch: Partial<HubAgenteFollowupConfig>) => Promise<void>;
  onAtualizarConfigLocal: (patch: Partial<HubAgenteFollowupConfig>) => void;
  onAdicionarPasso: (tipo: FollowupTipoConteudo) => Promise<void>;
  onSalvarPasso: (passo: HubAgenteFollowupPasso) => Promise<void>;
  onExcluirPasso: (id: string) => Promise<void>;
  onReorder: (reordered: HubAgenteFollowupPasso[]) => Promise<void>;
  onUploadImagem: (passoId: string, file: File) => Promise<void>;
  onAtualizarLocal: (id: string, patch: Partial<HubAgenteFollowupPasso>) => void;
};

export function FollowupFlowReactFlowPanel({
  agenteSlug,
  config,
  passos,
  saving,
  uploadingId,
  disabled,
  theme = "light",
  toolbarTheme = "dark",
  fullscreen = false,
  hasUnsavedChanges = false,
  onCanvasDirty,
  onSaveDraft,
  onSaveDraftAndClose,
  onIniciarEmBranco,
  onSalvarConfig,
  onAtualizarConfigLocal,
  onAdicionarPasso,
  onSalvarPasso,
  onExcluirPasso,
  onReorder,
  onUploadImagem,
  onAtualizarLocal,
}: Props) {
  const canvasApiRef = useRef<FollowupFlowCanvasApi | null>(null);
  const toolbarStyles = useMemo(() => buildFollowupPanelStyles(toolbarTheme === "dark"), [toolbarTheme]);
  const passosAtivos = passos.filter((p) => p.ativo).length;
  const cadenciaOk = passos.length > 0 && passosAtivos > 0;
  const canSave = hasUnsavedChanges;

  async function flushAndSave(action?: () => void | Promise<void>) {
    await canvasApiRef.current?.flushPendingEdit();
    if (action) await action();
  }

  return (
    <div
      style={{
        ...toolbarStyles.panelStyle,
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div style={toolbarStyles.toolbarStyle}>
        <div style={followupToolbarGroup}>
          <span style={toolbarStyles.metaItem}>
            <Workflow size={12} />
            {passos.length} passo{passos.length === 1 ? "" : "s"}
          </span>
          <span style={toolbarStyles.metaDivider} />
          <span style={toolbarStyles.metaItem}>
            Gatilho: <strong style={toolbarStyles.metaStrong}>{formatarGatilhoConfig(config)}</strong>
          </span>
          <span style={toolbarStyles.metaDivider} />
          <span style={toolbarStyles.metaItem} title="Dias sem resposta até arquivar o lead">
            Arquivar: <strong style={toolbarStyles.metaStrong}>{config.arquivar_apos_dias ?? 7}d</strong>
          </span>
          {passosAtivos > 0 ? (
            <>
              <span style={toolbarStyles.metaDivider} />
              <span style={toolbarStyles.metaItem}>
                <Bell size={12} />
                {passosAtivos} activo{passosAtivos === 1 ? "" : "s"}
              </span>
            </>
          ) : null}
        </div>

        <div style={followupToolbarGroup}>
          <button
            type="button"
            disabled={disabled || saving}
            style={toolbarStyles.toolButtonStyle}
            onClick={() => canvasApiRef.current?.openTriggerEditor()}
            title="Editar gatilho e arquivamento"
          >
            <Play size={13} strokeWidth={2.2} />
            Gatilho
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            style={toolbarStyles.toolButtonStyle}
            onClick={() => {
              onCanvasDirty?.();
              void onAdicionarPasso("texto");
            }}
          >
            <MessageSquare size={13} strokeWidth={2.2} />
            Mensagem
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            style={toolbarStyles.toolButtonStyle}
            onClick={() => {
              onCanvasDirty?.();
              void onAdicionarPasso("imagem");
            }}
          >
            <ImageIcon size={13} strokeWidth={2.2} />
            Imagem
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            style={toolbarStyles.toolButtonStyle}
            onClick={() => {
              onCanvasDirty?.();
              void onAdicionarPasso("texto_imagem");
            }}
          >
            <ImageIcon size={13} strokeWidth={2.2} />
            Imagem + legenda
          </button>
          <button
            type="button"
            style={toolbarStyles.toolButtonStyle}
            onClick={() => canvasApiRef.current?.fitCanvas()}
            title="Centralizar diagrama"
          >
            <LocateFixed size={13} strokeWidth={2.2} />
            Centralizar
          </button>
        </div>

        <div style={{ ...followupToolbarGroup, marginLeft: "auto" }}>
          {onSaveDraft ? (
            <button
              type="button"
              disabled={disabled || saving || !canSave}
              onClick={() => void flushAndSave(onSaveDraft)}
              style={{
                ...toolbarStyles.saveButtonStyle,
                opacity: disabled || saving || !canSave ? 0.55 : 1,
              }}
              title="Grava alterações pendentes"
            >
              <Save size={12} />
              Salvar rascunho
            </button>
          ) : null}
          {onSaveDraftAndClose ? (
            <button
              type="button"
              disabled={disabled || saving || !canSave}
              onClick={() => void flushAndSave(onSaveDraftAndClose)}
              style={{
                ...toolbarStyles.saveAndCloseButtonStyle,
                opacity: disabled || saving || !canSave ? 0.55 : 1,
              }}
              title="Grava e fecha o editor"
            >
              Salvar e voltar
            </button>
          ) : null}
          <span
            style={{
              ...toolbarStyles.validationBadge,
              borderColor: cadenciaOk ? "#81c784" : "#e6c06a",
              color: cadenciaOk ? "#2e7d32" : "#bb8009",
              background: cadenciaOk ? "#e8f5e9" : "rgba(187, 128, 9, 0.14)",
            }}
          >
            <CheckCircle2 size={11} strokeWidth={2.2} />
            {cadenciaOk ? "Cadência válida" : "Adicione passos activos"}
          </span>
        </div>
      </div>

      <div
        style={{
          ...toolbarStyles.canvasWrapper,
          minHeight: fullscreen ? 0 : 420,
          flex: fullscreen ? 1 : undefined,
          border: fullscreen ? "1px solid #dcebd8" : toolbarStyles.canvasWrapper.border,
        }}
      >
        <FollowupFlowCanvas
          agenteSlug={agenteSlug}
          config={config}
          passos={passos}
          saving={saving}
          uploadingId={uploadingId}
          disabled={disabled}
          theme={theme}
          fullHeight={fullscreen}
          onExposeApi={(api) => {
            canvasApiRef.current = api;
          }}
          onSalvarConfig={onSalvarConfig}
          onAtualizarConfigLocal={(patch) => {
            onCanvasDirty?.();
            onAtualizarConfigLocal(patch);
          }}
          onSalvarPasso={async (p) => {
            onCanvasDirty?.();
            await onSalvarPasso(p);
          }}
          onExcluirPasso={onExcluirPasso}
          onReorder={onReorder}
          onUploadImagem={onUploadImagem}
          onAtualizarLocal={(id, patch) => {
            onCanvasDirty?.();
            onAtualizarLocal(id, patch);
          }}
        />
      </div>
    </div>
  );
}

const loadingStyle: CSSProperties = {
  flex: 1,
  minHeight: 420,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  color: "#5d7a67",
  fontSize: 12,
};

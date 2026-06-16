"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  List,
  LocateFixed,
  MessageSquare,
  PencilLine,
  Save,
  Workflow,
} from "lucide-react";
import { parsePlaybookFlowFromMarkdown } from "@/lib/playbook/flow-parse";
import { upsertPlaybookFlowBlockInMarkdown } from "@/lib/playbook/playbook-flow-markdown";
import { emitFlowVisualTelemetry } from "@/lib/playbook/flow-visual-telemetry";
import { validatePlaybookFlowDefinition } from "@/lib/playbook/flow-validate";
import type { FlowCanvasApi } from "@/components/crm/playbook-flow-visual/FlowCanvas";
import type { FlowCanvasSnapshot, FlowNodeKind } from "@/components/crm/playbook-flow-visual/types";

const FlowCanvas = dynamic(
  () => import("@/components/crm/playbook-flow-visual/FlowCanvas").then((m) => m.FlowCanvas),
  {
    ssr: false,
    loading: () => (
      <div style={loadingStyle}>
        <Workflow size={20} style={{ opacity: 0.3 }} />
        <span>A carregar diagrama…</span>
      </div>
    ),
  }
);

type Props = {
  markdown: string;
  onMarkdownChange: (next: string) => void;
  agenteSlug: string;
  disabled?: boolean;
  theme?: "dark" | "light";
  /** Barra de ferramentas pode usar tema diferente do canvas. */
  toolbarTheme?: "dark" | "light";
  hasUnsavedChanges?: boolean;
  onCanvasDirty?: () => void;
  onSaveDraft?: (markdownAtual: string) => void;
  onSaveDraftAndClose?: (markdownAtual: string) => void;
};

function formatEntryLabel(stepId: string): string {
  return stepId.replace(/_/g, " ");
}

export function PlaybookFlowReactFlowPanel({
  markdown,
  onMarkdownChange,
  agenteSlug,
  disabled,
  theme = "light",
  toolbarTheme = "dark",
  hasUnsavedChanges = false,
  onCanvasDirty,
  onSaveDraft,
  onSaveDraftAndClose,
}: Props) {
  const isDark = theme === "dark";
  const styles = useMemo(() => buildPanelStyles(isDark), [isDark]);
  const toolbarStyles = useMemo(() => buildPanelStyles(toolbarTheme === "dark"), [toolbarTheme]);
  const canSave = hasUnsavedChanges;
  const parsed = useMemo(() => parsePlaybookFlowFromMarkdown(markdown), [markdown]);
  const canvasApiRef = useRef<FlowCanvasApi | null>(null);

  const validation = useMemo(
    () => (parsed.ok ? validatePlaybookFlowDefinition(parsed.definition) : null),
    [parsed]
  );

  const lastCanvasMarkdownRef = useRef<string>(markdown);
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    if (markdown !== lastCanvasMarkdownRef.current) {
      lastCanvasMarkdownRef.current = markdown;
      setMountKey((k) => k + 1);
    }
  }, [markdown]);

  function applySnapshot(snapshot: FlowCanvasSnapshot) {
    const next = upsertPlaybookFlowBlockInMarkdown(markdown, snapshot.definition);
    lastCanvasMarkdownRef.current = next;
    onMarkdownChange(next);
    void emitFlowVisualTelemetry({
      event: "playbook.flow_visual.markdown_applied",
      agente_slug: agenteSlug,
      metadata: {
        source: "react_flow_canvas",
        steps_count: snapshot.nodeCount,
      },
    });
  }

  function handleChange(snapshot: FlowCanvasSnapshot) {
    applySnapshot(snapshot);
  }

  function flushCanvasToMarkdown(): string {
    const snapshot = canvasApiRef.current?.flushAndSnapshot();
    if (snapshot) {
      const next = upsertPlaybookFlowBlockInMarkdown(markdown, snapshot.definition);
      lastCanvasMarkdownRef.current = next;
      onMarkdownChange(next);
      return next;
    }
    return markdown;
  }

  function handleSaveDraft() {
    if (!onSaveDraft) return;
    const next = flushCanvasToMarkdown();
    onSaveDraft(next);
  }

  function handleSaveDraftAndClose() {
    if (!onSaveDraftAndClose) return;
    const next = flushCanvasToMarkdown();
    onSaveDraftAndClose(next);
  }

  function addNode(kind: FlowNodeKind) {
    canvasApiRef.current?.addNode(kind);
  }

  function centerCanvas() {
    canvasApiRef.current?.fitCanvas();
  }

  const orphanWarning = useMemo(() => {
    if (!validation || validation.ok) return null;
    return validation.errors.find((error) => error.includes("órfãos")) ?? null;
  }, [validation]);

  if (!markdown.trim()) {
    return (
      <div style={emptyState}>
        <Workflow size={32} style={{ opacity: 0.2 }} />
        <p style={emptyText}>Carregue um playbook para visualizar o fluxo.</p>
      </div>
    );
  }

  if (!parsed.ok) {
    const isMissingBlock = parsed.reason === "not_found";
    return (
      <div style={emptyState}>
        {isMissingBlock ? (
          <Workflow size={32} style={{ opacity: 0.35, color: "#7a9a7e" }} />
        ) : (
          <AlertTriangle size={26} style={{ color: "#c47f17" }} />
        )}
        <p style={{ ...emptyText, color: isMissingBlock ? "#5d7a67" : "#c47f17" }}>
          {isMissingBlock
            ? "Ainda não há fluxo configurado neste playbook."
            : "O fluxo encontrado está inválido."}
        </p>
        <p style={hintText}>
          {isMissingBlock ? (
            <>
              Feche este editor, volte à calibração e clique em <strong>Gerar fluxo da empresa</strong> para criar o
              fluxo automaticamente. Depois reabra «Editar fluxo visual».
            </>
          ) : (
            <>Corrija o fluxo no editor textual ou regenere com «Gerar fluxo da empresa».</>
          )}
        </p>
        {!isMissingBlock && parsed.errors.length > 0 && (
          <ul style={errorList}>
            {parsed.errors.slice(0, 3).map((e, i) => (
              <li key={i} style={errorItem}>
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const { definition } = parsed;

  return (
    <div style={{ ...styles.panelStyle, opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <div style={toolbarStyles.toolbarStyle}>
        <div style={toolbarGroup}>
          <span style={toolbarStyles.metaItem}>
            <Workflow size={12} />
            {definition.steps.length} passos
          </span>
          <span style={toolbarStyles.metaDivider} />
          <span style={toolbarStyles.metaItem}>
            Início: <strong style={toolbarStyles.metaStrong}>{formatEntryLabel(definition.entry_step_id)}</strong>
          </span>
        </div>

        <div style={toolbarGroup}>
          <button type="button" style={toolbarStyles.toolButtonStyle} onClick={() => addNode("message")}>
            <MessageSquare size={13} strokeWidth={2.2} />
            Mensagem
          </button>
          <button type="button" style={toolbarStyles.toolButtonStyle} onClick={() => addNode("input")}>
            <PencilLine size={13} strokeWidth={2.2} />
            Entrada
          </button>
          <button type="button" style={toolbarStyles.toolButtonStyle} onClick={() => addNode("menu")}>
            <List size={13} strokeWidth={2.2} />
            Menu
          </button>
          <button type="button" style={toolbarStyles.toolButtonStyle} onClick={() => addNode("complete")}>
            <CheckCircle2 size={13} strokeWidth={2.2} />
            Fim
          </button>
          <button type="button" style={toolbarStyles.toolButtonStyle} onClick={() => addNode("transfer")}>
            <Link2 size={13} strokeWidth={2.2} />
            Transferir
          </button>
          <button type="button" style={toolbarStyles.toolButtonStyle} onClick={() => centerCanvas()}>
            <LocateFixed size={13} strokeWidth={2.2} />
            Centralizar
          </button>
        </div>

        <div style={{ ...toolbarGroup, marginLeft: "auto" }}>
          {onSaveDraft ? (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={disabled || !canSave}
              style={{
                ...toolbarStyles.saveButtonStyle,
                opacity: disabled || !canSave ? 0.55 : 1,
              }}
              title="Salva as alterações no rascunho"
            >
              <Save size={12} />
              Salvar rascunho
            </button>
          ) : null}
          {onSaveDraftAndClose ? (
            <button
              type="button"
              onClick={handleSaveDraftAndClose}
              disabled={disabled || !canSave}
              style={{
                ...toolbarStyles.saveAndCloseButtonStyle,
                opacity: disabled || !canSave ? 0.55 : 1,
              }}
              title="Salva e volta para o playbook"
            >
              Salvar e voltar
            </button>
          ) : null}
          {orphanWarning ? (
            <span
              style={
                toolbarTheme === "dark"
                  ? { ...toolbarStyles.validationBadge, ...darkBadgeWarning }
                  : {
                      ...toolbarStyles.validationBadge,
                      borderColor: "#e6c06a",
                      color: "#bb8009",
                      background: "rgba(187, 128, 9, 0.14)",
                    }
              }
              title={orphanWarning}
            >
              <AlertTriangle size={11} strokeWidth={2.2} />
              Passos órfãos
            </span>
          ) : null}
          {validation && !validation.ok ? (
            <span
              style={
                toolbarTheme === "dark"
                  ? { ...toolbarStyles.validationBadge, ...darkBadgeError }
                  : { ...toolbarStyles.validationBadge, borderColor: "#e57373", color: "#c62828", background: "#ffebee" }
              }
            >
              <AlertTriangle size={11} strokeWidth={2.2} />
              {validation.errors.length} {validation.errors.length === 1 ? "aviso" : "avisos"}
            </span>
          ) : (
            <span
              style={
                toolbarTheme === "dark"
                  ? { ...toolbarStyles.validationBadge, ...darkBadgeOk }
                  : { ...toolbarStyles.validationBadge, borderColor: "#81c784", color: "#2e7d32", background: "#e8f5e9" }
              }
            >
              <CheckCircle2 size={11} strokeWidth={2.2} />
              Fluxo válido
            </span>
          )}
        </div>
      </div>

      <div style={canvasWrapper}>
        <FlowCanvas
          key={mountKey}
          initialDefinition={definition}
          onChange={handleChange}
          onDirty={onCanvasDirty}
          theme={theme}
          toolbarPlacement="external"
          onExposeApi={(api) => {
            canvasApiRef.current = api;
          }}
        />
      </div>
    </div>
  );
}

function buildPanelStyles(isDark: boolean) {
  const toolbarBlack = {
    panel: "#060d08",
    panelBorder: "rgba(255, 255, 255, 0.08)",
    text: "#e5e7eb",
    textMuted: "#9ca3af",
    buttonBg: "#141414",
    buttonBorder: "rgba(255, 255, 255, 0.12)",
    divider: "rgba(255, 255, 255, 0.1)",
  };

  return {
    panelStyle: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      flex: 1,
      minHeight: 0,
      height: "100%",
      overflow: "hidden",
    } satisfies CSSProperties,
    toolbarStyle: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      background: isDark ? toolbarBlack.panel : "#ffffff",
      border: isDark ? `1px solid ${toolbarBlack.panelBorder}` : "1px solid #dcebd8",
      borderRadius: 12,
      boxShadow: isDark ? "0 4px 16px rgba(0, 0, 0, 0.45)" : "0 2px 8px rgba(11, 34, 16, 0.06)",
      flexShrink: 0,
    } satisfies CSSProperties,
    metaItem: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 11.5,
      color: isDark ? toolbarBlack.textMuted : "#5d7a67",
    } satisfies CSSProperties,
    metaStrong: {
      color: isDark ? toolbarBlack.text : "#0b2210",
      fontWeight: 700,
    } satisfies CSSProperties,
    metaDivider: {
      width: 1,
      height: 18,
      background: isDark ? toolbarBlack.divider : "#dcebd8",
      flexShrink: 0,
    } satisfies CSSProperties,
    toolButtonStyle: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: isDark ? toolbarBlack.buttonBg : "#f4faf2",
      color: isDark ? toolbarBlack.text : "#2d4a35",
      border: isDark ? `1px solid ${toolbarBlack.buttonBorder}` : "1px solid #b8d4bc",
      borderRadius: 8,
      padding: "6px 10px",
      fontSize: 11.5,
      fontWeight: 600,
      lineHeight: 1.1,
      cursor: "pointer",
    } satisfies CSSProperties,
    validationBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 10.5,
      fontWeight: 700,
      border: "1px solid",
      borderRadius: 20,
      padding: "4px 9px",
    } satisfies CSSProperties,
    saveButtonStyle: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      border: isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid #90caf9",
      background: isDark ? "#1a1a1a" : "#e3f2fd",
      color: isDark ? "#d1d5db" : "#1565c0",
      borderRadius: 8,
      padding: "6px 10px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
    } satisfies CSSProperties,
    saveAndCloseButtonStyle: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      border: isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid #a5d6a7",
      background: isDark ? "#1a1a1a" : "#e8f5e9",
      color: isDark ? "#d1d5db" : "#2e7d32",
      borderRadius: 8,
      padding: "6px 10px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
    } satisfies CSSProperties,
  };
}

const toolbarGroup: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 6,
};

const canvasWrapper: CSSProperties = {
  width: "100%",
  flex: 1,
  minHeight: 420,
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
};

const darkBadgeOk: CSSProperties = {
  borderColor: "rgba(255, 255, 255, 0.14)",
  color: "#d1d5db",
  background: "rgba(255, 255, 255, 0.06)",
};

const darkBadgeWarning: CSSProperties = {
  borderColor: "rgba(251, 191, 36, 0.35)",
  color: "#fbbf24",
  background: "rgba(251, 191, 36, 0.1)",
};

const darkBadgeError: CSSProperties = {
  borderColor: "rgba(248, 113, 113, 0.35)",
  color: "#fca5a5",
  background: "rgba(248, 113, 113, 0.1)",
};

const emptyState: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: 40,
  height: "100%",
  minHeight: 300,
};

const emptyText: CSSProperties = {
  margin: 0,
  color: "#2d4a35",
  fontSize: 13.5,
  textAlign: "center",
};

const hintText: CSSProperties = {
  margin: 0,
  color: "#5d7a67",
  fontSize: 11,
  textAlign: "center",
  maxWidth: 420,
  lineHeight: 1.6,
};

const errorList: CSSProperties = {
  margin: 0,
  padding: "0 0 0 16px",
  listStyle: "disc",
};

const errorItem: CSSProperties = {
  fontSize: 11,
  color: "#c62828",
  lineHeight: 1.5,
};

const loadingStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  height: "100%",
  minHeight: 300,
  color: "#5d7a67",
  fontSize: 12,
};

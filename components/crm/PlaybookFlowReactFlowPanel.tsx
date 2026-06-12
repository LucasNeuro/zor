"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, CheckCircle2, Save, Workflow } from "lucide-react";
import { parsePlaybookFlowFromMarkdown } from "@/lib/playbook/flow-parse";
import { upsertPlaybookFlowBlockInMarkdown } from "@/lib/playbook/playbook-flow-markdown";
import { emitFlowVisualTelemetry } from "@/lib/playbook/flow-visual-telemetry";
import { validatePlaybookFlowDefinition } from "@/lib/playbook/flow-validate";
import { PLAYBOOK_FLOW_FENCE_TAG } from "@/lib/playbook/flow-schema";
import type { FlowCanvasSnapshot } from "@/components/crm/playbook-flow-visual/types";

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
  hasUnsavedChanges?: boolean;
  onCanvasDirty?: () => void;
  onSaveDraft?: () => void;
  onSaveDraftAndClose?: () => void;
};

export function PlaybookFlowReactFlowPanel({
  markdown,
  onMarkdownChange,
  agenteSlug,
  disabled,
  hasUnsavedChanges = false,
  onCanvasDirty,
  onSaveDraft,
  onSaveDraftAndClose,
}: Props) {
  const canSave = hasUnsavedChanges;
  const parsed = useMemo(() => parsePlaybookFlowFromMarkdown(markdown), [markdown]);

  const validation = useMemo(
    () => (parsed.ok ? validatePlaybookFlowDefinition(parsed.definition) : null),
    [parsed]
  );

  // Track markdown written BY the canvas so we don't remount on canvas-driven changes.
  const lastCanvasMarkdownRef = useRef<string>(markdown);
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    if (markdown !== lastCanvasMarkdownRef.current) {
      // External change (e.g. user clicked Recarregar) — remount canvas with fresh data.
      lastCanvasMarkdownRef.current = markdown;
      setMountKey((k) => k + 1);
    }
  }, [markdown]);

  function handleChange(snapshot: FlowCanvasSnapshot) {
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

  // ── No playbook loaded ──
  if (!markdown.trim()) {
    return (
      <div style={emptyState}>
        <Workflow size={32} style={{ opacity: 0.2 }} />
        <p style={emptyText}>Carregue um playbook para visualizar o fluxo.</p>
      </div>
    );
  }

  // ── No flow block found ──
  if (!parsed.ok) {
    const isMissingBlock = parsed.reason === "not_found";
    return (
      <div style={emptyState}>
        {isMissingBlock ? (
          <Workflow size={32} style={{ opacity: 0.35, color: "#94a3b8" }} />
        ) : (
          <AlertTriangle size={26} style={{ color: "#d29922" }} />
        )}
        <p style={{ ...emptyText, color: isMissingBlock ? "#94a3b8" : "#d29922" }}>
          {isMissingBlock ? (
            <>
              Ainda não há bloco <code>{PLAYBOOK_FLOW_FENCE_TAG}</code> neste playbook.
            </>
          ) : (
            <>
              Bloco <code>{PLAYBOOK_FLOW_FENCE_TAG}</code> encontrado, mas inválido.
            </>
          )}
        </p>
        <p style={hintText}>
          {isMissingBlock ? (
            <>
              Feche este editor, volte à calibração e clique em <strong>Gerar fluxo da empresa</strong> para gerar o JSON
              automaticamente. Depois reabra «Editar fluxo visual».
            </>
          ) : (
            <>Corrija o JSON no editor textual ou regenere com «Gerar fluxo da empresa».</>
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
    <div style={{ ...panelStyle, opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      {/* Meta bar */}
      <div style={metaBar}>
        <span style={metaItem}>
          <Workflow size={12} />
          {definition.steps.length} passos
        </span>
        <span style={metaItem}>
          entrada: <code style={metaCode}>{definition.entry_step_id}</code>
        </span>
        {definition.id && (
          <span style={metaItem}>
            id: <code style={metaCode}>{definition.id}</code>
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 8 }}>
            {onSaveDraft ? (
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={disabled || !canSave}
                style={{
                  ...saveButtonStyle,
                  opacity: disabled || !canSave ? 0.55 : 1,
                }}
                title="Salva o JSON atual no rascunho do drawer"
              >
                <Save size={12} />
                Salvar rascunho
              </button>
            ) : null}
            {onSaveDraftAndClose ? (
              <button
                type="button"
                onClick={onSaveDraftAndClose}
                disabled={disabled || !canSave}
                style={{
                  ...saveAndCloseButtonStyle,
                  opacity: disabled || !canSave ? 0.55 : 1,
                }}
                title="Salva no rascunho e volta para o drawer"
              >
                Salvar e voltar
              </button>
            ) : null}
          </span>
          {validation && !validation.ok ? (
            <span style={{ ...validationBadge, borderColor: "#f85149", color: "#ff7b72", background: "#f851491a" }}>
              <AlertTriangle size={11} strokeWidth={2.2} />
              {validation.errors.length} {validation.errors.length === 1 ? "aviso" : "avisos"}
            </span>
          ) : (
            <span style={{ ...validationBadge, borderColor: "#2ea043", color: "#3fb950", background: "#2ea0431a" }}>
              <CheckCircle2 size={11} strokeWidth={2.2} />
              Fluxo válido
            </span>
          )}
        </span>
      </div>

      {/* Canvas */}
      <div style={canvasWrapper}>
        <FlowCanvas
          key={mountKey}
          initialDefinition={definition}
          onChange={handleChange}
          onDirty={onCanvasDirty}
        />
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  flex: 1,
  minHeight: 0,
};

const metaBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  background: "#0b1425",
  border: "1px solid #23314a",
  borderRadius: 10,
  boxShadow: "0 6px 18px #02061780",
  flexShrink: 0,
};

const metaItem: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11.5,
  color: "#cbd5e1",
};

const metaCode: CSSProperties = {
  fontSize: 10,
  color: "#93c5fd",
  fontFamily: "monospace",
};

const validationBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10.5,
  fontWeight: 700,
  border: "1px solid",
  borderRadius: 20,
  padding: "2px 8px",
};

const saveButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  border: "1px solid #2f81f7",
  background: "#1f6feb2a",
  color: "#9ecbff",
  borderRadius: 8,
  padding: "5px 9px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const saveAndCloseButtonStyle: CSSProperties = {
  ...saveButtonStyle,
  borderColor: "#3fb95055",
  background: "#2386361f",
  color: "#7ee787",
};

const canvasWrapper: CSSProperties = {
  width: "100%",
  flex: 1,
  minHeight: 520,
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
  color: "#cbd5e1",
  fontSize: 13.5,
  textAlign: "center",
};

const hintText: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: 11,
  textAlign: "center",
  maxWidth: 380,
  lineHeight: 1.6,
};

const errorList: CSSProperties = {
  margin: 0,
  padding: "0 0 0 16px",
  listStyle: "disc",
};

const errorItem: CSSProperties = {
  fontSize: 11,
  color: "#ff7b72",
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
  color: "#94a3b8",
  fontSize: 12,
};

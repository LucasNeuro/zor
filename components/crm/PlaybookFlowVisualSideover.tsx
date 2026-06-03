"use client";

import type { CSSProperties, ReactNode } from "react";
import { Component, useEffect, useMemo, useState } from "react";
import { CrmSideoverShell } from "@/components/crm/CrmSideoverShell";
import { PlaybookFlowReactFlowPanel } from "@/components/crm/PlaybookFlowReactFlowPanel";
import { emitFlowVisualTelemetry } from "@/lib/playbook/flow-visual-telemetry";

type Props = {
  open: boolean;
  onClose: () => void;
  markdown: string;
  onMarkdownChange: (next: string) => void;
  agenteSlug: string;
  agenteNome: string;
  disabled?: boolean;
  onBuilderError?: (message: string) => void;
};

type BuilderErrorBoundaryProps = {
  children: ReactNode;
  onError: (message: string) => void;
};

type BuilderErrorBoundaryState = {
  hasError: boolean;
};

class BuilderErrorBoundary extends Component<BuilderErrorBoundaryProps, BuilderErrorBoundaryState> {
  state: BuilderErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): BuilderErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error && error.message ? error.message : "Erro inesperado no editor visual.";
    this.props.onError(message);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function PlaybookFlowVisualSideover({
  open,
  onClose,
  markdown,
  onMarkdownChange,
  agenteSlug,
  agenteNome,
  disabled = false,
  onBuilderError,
}: Props) {
  const [draftMarkdown, setDraftMarkdown] = useState(markdown);
  const [saveNotice, setSaveNotice] = useState("");
  const subtitle = useMemo(
    () => `Ajuste o bloco de fluxo dinamico com React Flow para ${agenteNome}.`,
    [agenteNome]
  );
  const hasUnsavedChanges = draftMarkdown.trim() !== markdown.trim();

  useEffect(() => {
    if (!open) return;
    setDraftMarkdown(markdown);
    setSaveNotice("");
  }, [open, markdown]);

  function markSavedNotice(message: string) {
    setSaveNotice(message);
    window.setTimeout(() => {
      setSaveNotice((current) => (current === message ? "" : current));
    }, 2500);
  }

  return (
    <CrmSideoverShell
      open={open}
      onClose={onClose}
      title="Editor visual do fluxo"
      subtitle={subtitle}
      width={1180}
    >
      <div style={rootStyle}>
        <p style={hintStyle}>
          Se este modo apresentar erro, o editor textual continua disponivel para edicao e publicacao.
          {saveNotice ? <span style={savedHintStyle}> {saveNotice}</span> : null}
        </p>
        <BuilderErrorBoundary
          onError={(message) => {
            onBuilderError?.(message);
            onClose();
          }}
        >
          <PlaybookFlowReactFlowPanel
            markdown={draftMarkdown}
            onMarkdownChange={setDraftMarkdown}
            agenteSlug={agenteSlug}
            disabled={disabled}
            hasUnsavedChanges={hasUnsavedChanges}
            onSaveDraft={() => {
              if (!hasUnsavedChanges) return;
              onMarkdownChange(draftMarkdown);
              void emitFlowVisualTelemetry({
                event: "playbook.flow_visual.draft_saved",
                agente_slug: agenteSlug,
                metadata: {
                  source: "visual_sideover",
                  action: "save_draft",
                },
              });
              markSavedNotice("Rascunho salvo no drawer.");
            }}
            onSaveDraftAndClose={() => {
              if (hasUnsavedChanges) {
                onMarkdownChange(draftMarkdown);
                void emitFlowVisualTelemetry({
                  event: "playbook.flow_visual.draft_saved",
                  agente_slug: agenteSlug,
                  metadata: {
                    source: "visual_sideover",
                    action: "save_and_close",
                  },
                });
              }
              onClose();
            }}
          />
        </BuilderErrorBoundary>
      </div>
    </CrmSideoverShell>
  );
}

const rootStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  height: "100%",
  minHeight: 0,
};

const hintStyle: CSSProperties = {
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#8b949e",
  fontSize: 11,
  lineHeight: 1.45,
};

const savedHintStyle: CSSProperties = {
  color: "#3fb950",
  fontWeight: 700,
};

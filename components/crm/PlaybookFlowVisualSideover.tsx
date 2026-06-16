"use client";

import type { CSSProperties, ReactNode } from "react";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  RF_LIGHT_BG,
  RF_LIGHT_BORDER,
  RF_LIGHT_PANEL,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
  rfCloseButtonStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
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
  /** Grava o markdown no bucket (playbook.md) sem fechar o editor. */
  onPersistDraft?: (markdown: string) => Promise<void>;
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
    if (this.state.hasError) {
      return (
        <p style={{ margin: 0, color: "#c62828", fontSize: 12, lineHeight: 1.5 }}>
          O editor visual falhou ao renderizar. Use o editor textual ou regenere o fluxo da empresa.
        </p>
      );
    }
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
  onPersistDraft,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState(markdown);
  const [canvasDirty, setCanvasDirty] = useState(false);
  const [editorSessionKey, setEditorSessionKey] = useState(0);
  const baselineMarkdownRef = useRef(markdown);
  const wasOpenRef = useRef(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const subtitle = useMemo(
    () => `Monte e ajuste o fluxo de conversa de ${agenteNome}.`,
    [agenteNome]
  );
  const hasUnsavedChanges =
    canvasDirty || draftMarkdown.trim() !== baselineMarkdownRef.current.trim();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      baselineMarkdownRef.current = markdown;
      setDraftMarkdown(markdown);
      setCanvasDirty(false);
      setSaveNotice("");
      setEditorSessionKey((k) => k + 1);
    }
  }, [open, markdown]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function markSavedNotice(message: string) {
    setSaveNotice(message);
    window.setTimeout(() => {
      setSaveNotice((current) => (current === message ? "" : current));
    }, 2500);
  }

  if (!open || !mounted) return null;

  const shell = (
    <div role="dialog" aria-modal="true" aria-labelledby="playbook-flow-fullscreen-title" style={shellStyle}>
      <header style={headerStyle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 id="playbook-flow-fullscreen-title" style={titleStyle}>
            Editor visual do fluxo
          </h2>
          <p style={subtitleStyle}>
            {subtitle}
            {saveNotice ? <span style={savedHintStyle}> · {saveNotice}</span> : null}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar editor" style={rfCloseButtonStyle("light")}>
          <X size={18} />
        </button>
      </header>

      <main style={mainStyle}>
        <BuilderErrorBoundary
          onError={(message) => {
            onBuilderError?.(message);
            onClose();
          }}
        >
          <PlaybookFlowReactFlowPanel
            key={editorSessionKey}
            markdown={draftMarkdown}
            onMarkdownChange={(next) => {
              setDraftMarkdown(next);
              onMarkdownChange(next);
            }}
            agenteSlug={agenteSlug}
            disabled={disabled || savingDraft}
            theme="light"
            toolbarTheme="dark"
            hasUnsavedChanges={hasUnsavedChanges}
            onCanvasDirty={() => setCanvasDirty(true)}
            onSaveDraft={(nextMd) => {
              void (async () => {
                setSavingDraft(true);
                try {
                  setDraftMarkdown(nextMd);
                  onMarkdownChange(nextMd);
                  if (onPersistDraft) {
                    await onPersistDraft(nextMd);
                  }
                  baselineMarkdownRef.current = nextMd;
                  setCanvasDirty(false);
                  void emitFlowVisualTelemetry({
                    event: "playbook.flow_visual.draft_saved",
                    agente_slug: agenteSlug,
                    metadata: {
                      source: "visual_fullscreen",
                      action: "save_draft",
                    },
                  });
                  markSavedNotice(
                    onPersistDraft ? "Fluxo gravado no playbook." : "Rascunho salvo na calibração."
                  );
                } finally {
                  setSavingDraft(false);
                }
              })();
            }}
            onSaveDraftAndClose={(nextMd) => {
              void (async () => {
                setSavingDraft(true);
                try {
                  setDraftMarkdown(nextMd);
                  onMarkdownChange(nextMd);
                  if (onPersistDraft) {
                    await onPersistDraft(nextMd);
                  }
                  baselineMarkdownRef.current = nextMd;
                  setCanvasDirty(false);
                  void emitFlowVisualTelemetry({
                    event: "playbook.flow_visual.draft_saved",
                    agente_slug: agenteSlug,
                    metadata: {
                      source: "visual_fullscreen",
                      action: "save_and_close",
                    },
                  });
                } finally {
                  setSavingDraft(false);
                  onClose();
                }
              })();
            }}
          />
        </BuilderErrorBoundary>
      </main>
    </div>
  );

  return createPortal(shell, document.body);
}

const shellStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 230,
  display: "flex",
  flexDirection: "column",
  background: RF_LIGHT_BG,
  color: RF_LIGHT_TEXT_PRIMARY,
};

const headerStyle: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  padding: "14px 18px 12px",
  borderBottom: `1px solid ${RF_LIGHT_BORDER}`,
  background: RF_LIGHT_PANEL,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: RF_LIGHT_TEXT_PRIMARY,
};

const subtitleStyle: CSSProperties = {
  margin: "5px 0 0",
  fontSize: 12,
  color: RF_LIGHT_TEXT_SECONDARY,
  lineHeight: 1.45,
};

const hintStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 11,
  color: RF_LIGHT_TEXT_MUTED,
  lineHeight: 1.4,
};

const savedHintStyle: CSSProperties = {
  color: RF_LIGHT_TEXT_SECONDARY,
  fontWeight: 700,
};

const mainStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  padding: "10px 14px 14px",
};

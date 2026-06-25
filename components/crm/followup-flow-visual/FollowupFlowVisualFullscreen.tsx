"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  RF_LIGHT_BG,
  RF_LIGHT_BORDER,
  RF_LIGHT_PANEL,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
  rfCloseButtonStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { FollowupFlowReactFlowPanel } from "@/components/crm/followup-flow-visual/FollowupFlowReactFlowPanel";
import type { HubAgenteFollowupConfig, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import type { FollowupTipoConteudo } from "@/lib/hub/followup-types";
import { configPersistenciaSnapshot, passoPersistenciaSnapshot } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  agenteSlug: string;
  agenteNome: string;
  config: HubAgenteFollowupConfig;
  passos: HubAgenteFollowupPasso[];
  saving: boolean;
  uploadingId: string | null;
  disabled?: boolean;
  onAdicionarPasso: (tipo: FollowupTipoConteudo) => Promise<void>;
  onSalvarPasso: (passo: HubAgenteFollowupPasso) => Promise<void>;
  onSalvarConfig: (patch: Partial<HubAgenteFollowupConfig>) => Promise<void>;
  onSalvarTudo: () => Promise<{ passos: HubAgenteFollowupPasso[]; config: HubAgenteFollowupConfig }>;
  onExcluirPasso: (id: string) => Promise<void>;
  onReorder: (reordered: HubAgenteFollowupPasso[]) => Promise<void>;
  onUploadImagem: (passoId: string, file: File) => Promise<void>;
  onAtualizarLocal: (id: string, patch: Partial<HubAgenteFollowupPasso>) => void;
  onAtualizarConfigLocal: (patch: Partial<HubAgenteFollowupConfig>) => void;
};

function fluxoSnapshot(config: HubAgenteFollowupConfig, passos: HubAgenteFollowupPasso[]) {
  return JSON.stringify({
    config: configPersistenciaSnapshot(config),
    passos: passos.map((p) => passoPersistenciaSnapshot(p)),
  });
}

export function FollowupFlowVisualFullscreen({
  open,
  onClose,
  agenteSlug,
  agenteNome,
  config,
  passos,
  saving,
  uploadingId,
  disabled,
  onAdicionarPasso,
  onSalvarPasso,
  onSalvarConfig,
  onSalvarTudo,
  onExcluirPasso,
  onReorder,
  onUploadImagem,
  onAtualizarLocal,
  onAtualizarConfigLocal,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [canvasDirty, setCanvasDirty] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const baselineRef = useRef<string>("[]");
  const wasOpenRef = useRef(false);

  const subtitle = useMemo(
    () => `Monte a cadência de follow-up WhatsApp de ${agenteNome}.`,
    [agenteNome]
  );

  const fluxoAtual = useMemo(() => fluxoSnapshot(config, passos), [config, passos]);

  const hasUnsavedChanges = canvasDirty || fluxoAtual !== baselineRef.current;

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
      baselineRef.current = fluxoAtual;
      setCanvasDirty(false);
      setSaveNotice("");
    }
  }, [open, fluxoAtual]);

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

  async function persistDraft(closeAfter = false) {
    setSavingDraft(true);
    try {
      const gravados = await onSalvarTudo();
      baselineRef.current = fluxoSnapshot(gravados.config, gravados.passos);
      setCanvasDirty(false);
      markSavedNotice("Cadência gravada.");
      if (closeAfter) onClose();
    } finally {
      setSavingDraft(false);
    }
  }

  function handleClose() {
    if (hasUnsavedChanges && !confirm("Há alterações não guardadas. Fechar mesmo assim?")) {
      return;
    }
    onClose();
  }

  if (!open || !mounted || !config) return null;

  const shell = (
    <div role="dialog" aria-modal="true" aria-labelledby="followup-flow-fullscreen-title" style={shellStyle}>
      <header style={headerStyle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 id="followup-flow-fullscreen-title" style={titleStyle}>
            Editor visual do fluxo
          </h2>
          <p style={subtitleStyle}>
            {subtitle}
            {saveNotice ? <span style={savedHintStyle}> · {saveNotice}</span> : null}
          </p>
        </div>
        <button type="button" onClick={handleClose} aria-label="Fechar editor" style={rfCloseButtonStyle("light")}>
          <X size={18} />
        </button>
      </header>

      <main style={mainStyle}>
        <FollowupFlowReactFlowPanel
          agenteSlug={agenteSlug}
          config={config}
          passos={passos}
          saving={saving || savingDraft}
          uploadingId={uploadingId}
          disabled={disabled || savingDraft}
          theme="light"
          toolbarTheme="dark"
          fullscreen
          hasUnsavedChanges={hasUnsavedChanges}
          onCanvasDirty={() => setCanvasDirty(true)}
          onSaveDraft={() => persistDraft(false)}
          onSaveDraftAndClose={() => persistDraft(true)}
          onIniciarEmBranco={() => onAdicionarPasso("texto")}
          onSalvarConfig={onSalvarConfig}
          onAtualizarConfigLocal={onAtualizarConfigLocal}
          onAdicionarPasso={onAdicionarPasso}
          onSalvarPasso={onSalvarPasso}
          onExcluirPasso={onExcluirPasso}
          onReorder={onReorder}
          onUploadImagem={onUploadImagem}
          onAtualizarLocal={onAtualizarLocal}
        />
      </main>
    </div>
  );

  return createPortal(shell, document.body);
}

const savedHintStyle: CSSProperties = {
  color: "#2e7d32",
  fontWeight: 700,
};

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

const mainStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  padding: "10px 14px 14px",
};

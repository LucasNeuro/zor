"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { HubAgenteFollowupConfig } from "@/lib/hub/followup-types";
import { configGatilhoPadrao } from "@/lib/hub/followup-types";
import {
  RF_LIGHT_BORDER,
  RF_LIGHT_BORDER_STRONG,
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_LABEL_STYLE,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type GatilhoDraft = Pick<HubAgenteFollowupConfig, "arquivar_apos_dias">;

type Props = {
  config: HubAgenteFollowupConfig;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: GatilhoDraft) => void | Promise<void>;
  onPatch: (patch: Partial<GatilhoDraft>) => void;
  onRegisterFlush?: (flush: () => Promise<void>) => void;
};

function draftFromConfig(config: HubAgenteFollowupConfig): GatilhoDraft {
  const padrao = configGatilhoPadrao();
  return {
    arquivar_apos_dias: config.arquivar_apos_dias ?? padrao.arquivar_apos_dias,
  };
}

function draftIgual(a: GatilhoDraft, b: GatilhoDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function FollowupTriggerEditorSideover({
  config,
  saving,
  onClose,
  onSave,
  onPatch,
  onRegisterFlush,
}: Props) {
  const [draft, setDraft] = useState<GatilhoDraft>(() => draftFromConfig(config));

  useEffect(() => {
    setDraft(draftFromConfig(config));
  }, [config]);

  const baseline = draftFromConfig(config);

  function update(patch: Partial<GatilhoDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onPatch(patch);
  }

  const flushDraft = useCallback(async () => {
    if (!draftIgual(draft, baseline)) {
      await onSave(draft);
    }
  }, [draft, baseline, onSave]);

  useEffect(() => {
    onRegisterFlush?.(flushDraft);
    return () => {
      onRegisterFlush?.(async () => undefined);
    };
  }, [onRegisterFlush, flushDraft]);

  async function handleClose() {
    await flushDraft();
    onClose();
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        bottom: 12,
        width: 320,
        zIndex: 20,
        borderRadius: 12,
        border: `1px solid ${RF_LIGHT_BORDER_STRONG}`,
        background: "rgba(255,255,255,0.98)",
        boxShadow: "0 12px 40px rgba(11,31,16,0.12)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "12px 14px",
          borderBottom: `1px solid ${RF_LIGHT_BORDER}`,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: RF_LIGHT_TEXT_PRIMARY }}>
            Arquivamento e cadência
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: RF_LIGHT_TEXT_MUTED }}>
            Tempos de cada passo no fluxo visual
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleClose()}
          aria-label="Fechar editor"
          style={{
            border: "none",
            background: "transparent",
            color: RF_LIGHT_TEXT_MUTED,
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 10, color: RF_LIGHT_TEXT_MUTED, lineHeight: 1.45 }}>
          Configure <strong>minutos sem resposta</strong> em cada passo no fluxo visual. Respostas do bot{" "}
          <strong>não</strong> reiniciam o relógio — só mensagens do cliente. Quando o cliente voltar a falar,
          a cadência recomeça do passo 1.
        </p>

        <div
          style={{
            padding: 10,
            borderRadius: 8,
            border: `1px solid ${RF_LIGHT_BORDER}`,
            background: "#f4faf2",
            fontSize: 11,
            color: RF_LIGHT_TEXT_SECONDARY,
            lineHeight: 1.45,
          }}
        >
          <strong style={{ color: "#2e7d32" }}>Dica:</strong> passo 1 = ex. 5 min · passo 2 = ex. 12 h ·
          passo 3 = ex. 2 dias.
        </div>

        <label>
          <span style={RF_LIGHT_LABEL_STYLE}>Arquivar lead após (dias sem resposta)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={draft.arquivar_apos_dias ?? 7}
            onChange={(e) =>
              update({
                arquivar_apos_dias: Math.min(365, Math.max(1, Number.parseInt(e.target.value, 10) || 7)),
              })
            }
            style={RF_LIGHT_INPUT_STYLE}
          />
          <span style={{ display: "block", marginTop: 4, fontSize: 10, color: RF_LIGHT_TEXT_MUTED }}>
            Após esgotar todos os passos, o lead é arquivado se continuar sem responder.
          </span>
        </label>
      </div>

      <div style={{ padding: "12px 14px", borderTop: `1px solid ${RF_LIGHT_BORDER}` }}>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave(draft)}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 8,
            border: "none",
            background: "#2e7d32",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 12,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.65 : 1,
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

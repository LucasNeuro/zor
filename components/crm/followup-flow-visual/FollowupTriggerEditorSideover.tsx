"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { FollowupGatilhoTipo, HubAgenteFollowupConfig } from "@/lib/hub/followup-types";
import {
  atrasoTotalMinutos,
  configGatilhoPadrao,
  formatarGatilhoConfig,
  validarAtrasoPasso,
  validarHoraDia,
} from "@/lib/hub/followup-types";
import {
  RF_LIGHT_BORDER,
  RF_LIGHT_BORDER_STRONG,
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_LABEL_STYLE,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type GatilhoDraft = Pick<
  HubAgenteFollowupConfig,
  | "gatilho_tipo"
  | "gatilho_dias"
  | "gatilho_horas"
  | "gatilho_minutos"
  | "gatilho_hora_dia"
  | "arquivar_apos_dias"
>;

type Props = {
  config: HubAgenteFollowupConfig;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: GatilhoDraft) => void | Promise<void>;
  onPatch: (patch: Partial<GatilhoDraft>) => void;
  onRegisterFlush?: (flush: () => Promise<void>) => void;
};

function clampDias(v: number): number {
  return Math.min(365, Math.max(0, Number.isFinite(v) ? v : 0));
}

function clampHoras(v: number): number {
  return Math.min(8760, Math.max(0, Number.isFinite(v) ? v : 0));
}

function clampMinutos(v: number): number {
  return Math.min(59, Math.max(0, Number.isFinite(v) ? v : 0));
}

function draftFromConfig(config: HubAgenteFollowupConfig): GatilhoDraft {
  const padrao = configGatilhoPadrao();
  return {
    gatilho_tipo: config.gatilho_tipo ?? padrao.gatilho_tipo,
    gatilho_dias: config.gatilho_dias ?? padrao.gatilho_dias,
    gatilho_horas: config.gatilho_horas ?? padrao.gatilho_horas,
    gatilho_minutos: config.gatilho_minutos ?? padrao.gatilho_minutos,
    gatilho_hora_dia: config.gatilho_hora_dia ?? padrao.gatilho_hora_dia,
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

  const preview = formatarGatilhoConfig(draft);
  const atrasoErr = validarAtrasoPasso(
    draft.gatilho_horas ?? 0,
    draft.gatilho_minutos ?? 0,
    draft.gatilho_dias ?? 0
  );
  const horaErr =
    draft.gatilho_tipo === "horario" ? validarHoraDia(draft.gatilho_hora_dia) : null;
  const podeGuardar =
    !atrasoErr &&
    !horaErr &&
    atrasoTotalMinutos({
      atraso_dias: draft.gatilho_dias,
      atraso_horas: draft.gatilho_horas ?? 0,
      atraso_minutos: draft.gatilho_minutos,
    }) >= 1;

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
            Gatilho de disparo
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: RF_LIGHT_TEXT_MUTED }}>
            Quando iniciar a cadência
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
        <label>
          <span style={RF_LIGHT_LABEL_STYLE}>Modo do gatilho</span>
          <select
            value={draft.gatilho_tipo ?? "silencio"}
            onChange={(e) =>
              update({ gatilho_tipo: e.target.value as FollowupGatilhoTipo })
            }
            style={RF_LIGHT_INPUT_STYLE}
          >
            <option value="silencio">Após silêncio do cliente</option>
            <option value="horario">Silêncio + hora do dia</option>
          </select>
        </label>

        <p style={{ margin: "8px 0 0", fontSize: 10, color: RF_LIGHT_TEXT_MUTED, lineHeight: 1.45 }}>
          Respostas do bot <strong>não</strong> reiniciam este relógio. Quando o cliente voltar a falar, a
          cadência recomeça do passo 1. No passo 1, use atraso <strong>0</strong> para enviar logo após o
          gatilho.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <label>
            <span style={RF_LIGHT_LABEL_STYLE}>Dias</span>
            <input
              type="number"
              min={0}
              max={365}
              value={draft.gatilho_dias ?? 0}
              onChange={(e) =>
                update({ gatilho_dias: clampDias(Number.parseInt(e.target.value, 10) || 0) })
              }
              style={RF_LIGHT_INPUT_STYLE}
            />
          </label>
          <label>
            <span style={RF_LIGHT_LABEL_STYLE}>Horas</span>
            <input
              type="number"
              min={0}
              max={8760}
              value={draft.gatilho_horas ?? 0}
              onChange={(e) =>
                update({ gatilho_horas: clampHoras(Number.parseInt(e.target.value, 10) || 0) })
              }
              style={RF_LIGHT_INPUT_STYLE}
            />
          </label>
          <label>
            <span style={RF_LIGHT_LABEL_STYLE}>Minutos</span>
            <input
              type="number"
              min={0}
              max={59}
              value={draft.gatilho_minutos ?? 0}
              onChange={(e) =>
                update({ gatilho_minutos: clampMinutos(Number.parseInt(e.target.value, 10) || 0) })
              }
              style={RF_LIGHT_INPUT_STYLE}
            />
          </label>
        </div>

        {draft.gatilho_tipo === "horario" ? (
          <label>
            <span style={RF_LIGHT_LABEL_STYLE}>Hora do dia (HH:MM)</span>
            <input
              type="time"
              value={draft.gatilho_hora_dia?.trim() || "09:00"}
              onChange={(e) => update({ gatilho_hora_dia: e.target.value || "09:00" })}
              style={RF_LIGHT_INPUT_STYLE}
            />
            <span style={{ display: "block", marginTop: 4, fontSize: 10, color: RF_LIGHT_TEXT_MUTED }}>
              Horário de Brasília. Só dispara após esta hora, se o silêncio já tiver sido atingido.
            </span>
          </label>
        ) : null}

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
          <strong style={{ color: "#2e7d32" }}>Resumo:</strong> {preview}
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

        {atrasoErr ? (
          <p style={{ margin: 0, fontSize: 11, color: "#c62828" }}>{atrasoErr}</p>
        ) : null}
        {horaErr ? <p style={{ margin: 0, fontSize: 11, color: "#c62828" }}>{horaErr}</p> : null}
      </div>

      <div style={{ padding: "12px 14px", borderTop: `1px solid ${RF_LIGHT_BORDER}` }}>
        <button
          type="button"
          disabled={saving || !podeGuardar}
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
            cursor: saving || !podeGuardar ? "not-allowed" : "pointer",
            opacity: saving || !podeGuardar ? 0.65 : 1,
          }}
        >
          Guardar gatilho
        </button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Upload, X } from "lucide-react";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import type { HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { esperaMinutosDoPasso, formatarEsperaMinutos } from "@/lib/hub/followup-types";
import { FollowupEsperaMinutosField, patchEsperaMinutos } from "./FollowupEsperaMinutosField";
import { passoPersistenciaIgual } from "./types";
import { TextareaComSugestaoIa } from "@/components/crm/TextareaComSugestaoIa";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_LIGHT_BORDER,
  RF_LIGHT_BORDER_STRONG,
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_LABEL_STYLE,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfInputStyle,
  rfLabelStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  agenteSlug: string;
  passosAnteriores?: string[];
  posicaoVisual?: number;
  theme?: "light" | "dark";
  passo: HubAgenteFollowupPasso;
  saving: boolean;
  uploading: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onClose: () => void;
  onSave: (passo: HubAgenteFollowupPasso) => void | Promise<void>;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPatch: (patch: Partial<HubAgenteFollowupPasso>) => void;
  onUploadImagem: (file: File) => void;
  onRegisterFlush?: (flush: () => Promise<void>) => void;
};

function esperaAtual(p: HubAgenteFollowupPasso): number {
  return esperaMinutosDoPasso(p, {}, Math.max(0, (p.ordem ?? 1) - 1));
}

export function FollowupStepEditorSideover({
  agenteSlug,
  passosAnteriores = [],
  posicaoVisual,
  theme = "dark",
  passo,
  saving,
  uploading,
  canMoveUp,
  canMoveDown,
  onClose,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  onPatch,
  onUploadImagem,
  onRegisterFlush,
}: Props) {
  const isLight = theme === "light";
  const colors = {
    border: isLight ? RF_LIGHT_BORDER : RF_BORDER,
    borderStrong: isLight ? RF_LIGHT_BORDER_STRONG : RF_BORDER_STRONG,
    textPrimary: isLight ? RF_LIGHT_TEXT_PRIMARY : RF_TEXT_PRIMARY,
    textSecondary: isLight ? RF_LIGHT_TEXT_SECONDARY : RF_TEXT_SECONDARY,
    textMuted: isLight ? RF_LIGHT_TEXT_MUTED : RF_TEXT_MUTED,
    panelBg: isLight ? "rgba(255,255,255,0.98)" : "rgba(6,13,8,0.96)",
    innerBg: isLight ? "#f4faf2" : "rgba(6,13,8,0.35)",
    accent: isLight ? "#2e7d32" : RF_ACCENT,
    accentText: isLight ? "#ffffff" : "#0b2210",
    miniBtnBg: isLight ? "#ffffff" : "rgba(6,13,8,0.55)",
  };
  const inputStyle = isLight ? RF_LIGHT_INPUT_STYLE : rfInputStyle();
  const labelStyle = isLight ? RF_LIGHT_LABEL_STYLE : rfLabelStyle();

  const [draft, setDraft] = useState(passo);

  useEffect(() => {
    setDraft(passo);
  }, [passo]);

  async function flushDraftIfDirty() {
    if (!passoPersistenciaIgual(draft, passo) && esperaAtual(draft) >= 1) {
      await onSave(draft);
    }
  }

  const flushDraft = useCallback(async () => {
    if (!passoPersistenciaIgual(draft, passo) && esperaAtual(draft) >= 1) {
      await onSave(draft);
    }
  }, [draft, passo, onSave]);

  useEffect(() => {
    onRegisterFlush?.(flushDraft);
    return () => {
      onRegisterFlush?.(async () => undefined);
    };
  }, [onRegisterFlush, flushDraft]);

  async function handleClose() {
    await flushDraftIfDirty();
    onClose();
  }

  function update(patch: Partial<HubAgenteFollowupPasso>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onPatch(patch);
  }

  function updateEsperaMinutos(raw: number) {
    const patch = patchEsperaMinutos(raw);
    const next = { ...draft, ...patch };
    setDraft(next);
    onPatch(patch);
  }

  const espera = esperaAtual(draft);

  const showImagem = draft.tipo_conteudo === "imagem" || draft.tipo_conteudo === "texto_imagem";
  const posicao = posicaoVisual ?? draft.ordem;

  const metaFollowup = {
    passo_ordem: posicao,
    tipo_conteudo: draft.tipo_conteudo,
    atraso_label: formatarEsperaMinutos(espera, posicao - 1),
    passos_anteriores: passosAnteriores,
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        bottom: 12,
        width: 300,
        zIndex: 20,
        borderRadius: 12,
        border: `1px solid ${colors.borderStrong}`,
        background: colors.panelBg,
        boxShadow: isLight ? "0 12px 40px rgba(11,31,16,0.12)" : "0 12px 40px rgba(0,0,0,0.45)",
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
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: colors.textPrimary }}>
            Passo {posicao}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: colors.textMuted }}>
            {posicao === 1 ? "Sem resposta do cliente" : "Após passo anterior"} ·{" "}
            {formatarEsperaMinutos(espera, posicao - 1)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleClose()}
          aria-label="Fechar editor"
          style={{
            border: "none",
            background: "transparent",
            color: colors.textMuted,
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: draft.ativo ? "#3fb950" : colors.textMuted }}>
            {draft.ativo ? "ACTIVO" : "INACTIVO"}
          </span>
          <CrmToggleSwitch
            checked={draft.ativo}
            disabled={saving}
            variant={isLight ? "light" : "dark"}
            labelledBy={`followup-editor-ativo-${draft.id}`}
            onCheckedChange={(v) => update({ ativo: v })}
          />
        </div>

        <label>
          <span style={labelStyle}>Tipo de conteúdo</span>
          <select
            value={draft.tipo_conteudo}
            onChange={(e) =>
              update({ tipo_conteudo: e.target.value as HubAgenteFollowupPasso["tipo_conteudo"] })
            }
            style={inputStyle}
          >
            <option value="texto">Só texto</option>
            <option value="imagem">Só imagem</option>
            <option value="texto_imagem">Imagem + legenda</option>
          </select>
        </label>

        <FollowupEsperaMinutosField
          posicao={posicao}
          esperaMinutos={espera}
          disabled={saving}
          theme={theme}
          onChange={updateEsperaMinutos}
        />

        <label>
          <span style={labelStyle}>Hora mínima do dia (opcional)</span>
          <input
            type="time"
            value={draft.disparo_hora_dia?.trim() || ""}
            onChange={(e) => update({ disparo_hora_dia: e.target.value || null })}
            style={inputStyle}
          />
        </label>

        {draft.tipo_conteudo === "texto" ? (
          <TextareaComSugestaoIa
            agenteSlug={agenteSlug}
            contexto="followup_passo"
            label="Mensagem"
            value={draft.texto_template || ""}
            onChange={(t) => update({ texto_template: t })}
            rows={3}
            placeholder="Olá {nome}, ainda posso ajudar?"
            disabled={saving}
            theme={theme}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
            meta={metaFollowup}
          />
        ) : null}

        {draft.tipo_conteudo === "texto_imagem" ? (
          <TextareaComSugestaoIa
            agenteSlug={agenteSlug}
            contexto="followup_passo"
            label="Legenda da imagem"
            value={draft.legenda_imagem || ""}
            onChange={(t) => update({ legenda_imagem: t })}
            rows={3}
            placeholder="Texto que acompanha a imagem"
            disabled={saving}
            theme={theme}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
            meta={metaFollowup}
          />
        ) : null}

        {draft.tipo_conteudo === "imagem" ? (
          <TextareaComSugestaoIa
            agenteSlug={agenteSlug}
            contexto="followup_passo"
            label="Legenda (opcional)"
            value={draft.legenda_imagem || ""}
            onChange={(t) => update({ legenda_imagem: t })}
            rows={2}
            disabled={saving}
            theme={theme}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
            meta={metaFollowup}
          />
        ) : null}

        {showImagem ? (
          <div>
            <span style={labelStyle}>Imagem (bucket agent-followup)</span>
            <label
              style={{
                display: "block",
                marginTop: 6,
                padding: "14px 10px",
                borderRadius: 10,
                border: `2px dashed ${colors.borderStrong}`,
                background: colors.innerBg,
                cursor: uploading ? "wait" : "pointer",
                textAlign: "center",
              }}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadImagem(f);
                  e.target.value = "";
                }}
              />
              {uploading ? (
                <Loader2 size={20} className="animate-spin" color={colors.accent} />
              ) : (
                <Upload size={20} color={colors.accent} />
              )}
              <span style={{ display: "block", marginTop: 6, fontSize: 11, fontWeight: 700, color: colors.textPrimary }}>
                {uploading ? "A enviar…" : "Clique para enviar imagem"}
              </span>
            </label>
            {draft.imagem_url ? (
              <div style={{ marginTop: 8, position: "relative" }}>
                <img
                  src={draft.imagem_url}
                  alt=""
                  style={{ width: "100%", borderRadius: 8, border: `1px solid ${colors.border}` }}
                />
                <button
                  type="button"
                  onClick={() => update({ imagem_url: null })}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    border: "none",
                    borderRadius: 6,
                    background: "rgba(0,0,0,0.65)",
                    color: "#fff",
                    cursor: "pointer",
                    padding: 4,
                  }}
                  aria-label="Remover imagem"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            disabled={!canMoveUp || saving}
            onClick={onMoveUp}
            style={miniBtnStyle(!canMoveUp || saving, colors)}
          >
            ↑ Subir
          </button>
          <button
            type="button"
            disabled={!canMoveDown || saving}
            onClick={onMoveDown}
            style={miniBtnStyle(!canMoveDown || saving, colors)}
          >
            ↓ Descer
          </button>
        </div>
      </div>

      <div
        style={{
          padding: "12px 14px",
          borderTop: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          type="button"
          disabled={saving || espera < 1}
          onClick={() => onSave(draft)}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 8,
            border: "none",
            background: colors.accent,
            color: colors.accentText,
            fontWeight: 800,
            fontSize: 12,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          Guardar passo
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onDelete(draft.id)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(248,81,73,0.45)",
            background: "transparent",
            color: "#f85149",
            fontWeight: 700,
            fontSize: 11,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Trash2 size={14} /> Excluir passo
        </button>
      </div>
    </div>
  );
}

function miniBtnStyle(
  disabled: boolean,
  colors: {
    borderStrong: string;
    miniBtnBg: string;
    textMuted: string;
    textPrimary: string;
  }
): React.CSSProperties {
  return {
    flex: 1,
    padding: "7px 8px",
    borderRadius: 8,
    border: `1px solid ${colors.borderStrong}`,
    background: colors.miniBtnBg,
    color: disabled ? colors.textMuted : colors.textPrimary,
    fontSize: 10,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

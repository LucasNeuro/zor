"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, Upload, X } from "lucide-react";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import type { HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { atrasoTotalMinutos, formatarAtrasoPasso } from "@/lib/hub/followup-types";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfInputStyle,
  rfLabelStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  passo: HubAgenteFollowupPasso;
  saving: boolean;
  uploading: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onClose: () => void;
  onSave: (passo: HubAgenteFollowupPasso) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPatch: (patch: Partial<HubAgenteFollowupPasso>) => void;
  onUploadImagem: (file: File) => void;
};

function clampMinutos(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(59, Math.max(0, v));
}

function clampHoras(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(8760, Math.max(0, v));
}

export function FollowupStepEditorSideover({
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
}: Props) {
  const [draft, setDraft] = useState(passo);

  useEffect(() => {
    setDraft(passo);
  }, [passo]);

  function update(patch: Partial<HubAgenteFollowupPasso>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onPatch(patch);
  }

  const showImagem = draft.tipo_conteudo === "imagem" || draft.tipo_conteudo === "texto_imagem";

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
        border: `1px solid ${RF_BORDER_STRONG}`,
        background: "rgba(6,13,8,0.96)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
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
          borderBottom: `1px solid ${RF_BORDER}`,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: RF_TEXT_PRIMARY }}>
            Passo {draft.ordem}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: RF_TEXT_MUTED }}>Editar lembrete</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar editor"
          style={{
            border: "none",
            background: "transparent",
            color: RF_TEXT_MUTED,
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: draft.ativo ? "#3fb950" : RF_TEXT_MUTED }}>
            {draft.ativo ? "ACTIVO" : "INACTIVO"}
          </span>
          <CrmToggleSwitch
            checked={draft.ativo}
            disabled={saving}
            variant="dark"
            labelledBy={`followup-editor-ativo-${draft.id}`}
            onCheckedChange={(v) => update({ ativo: v })}
          />
        </div>

        <label>
          <span style={rfLabelStyle()}>Tipo de conteúdo</span>
          <select
            value={draft.tipo_conteudo}
            onChange={(e) =>
              update({ tipo_conteudo: e.target.value as HubAgenteFollowupPasso["tipo_conteudo"] })
            }
            style={rfInputStyle()}
          >
            <option value="texto">Só texto</option>
            <option value="imagem">Só imagem</option>
            <option value="texto_imagem">Imagem + legenda</option>
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label>
            <span style={rfLabelStyle()}>Horas</span>
            <input
              type="number"
              min={0}
              max={8760}
              value={draft.atraso_horas}
              onChange={(e) =>
                update({ atraso_horas: clampHoras(Number.parseInt(e.target.value, 10) || 0) })
              }
              style={rfInputStyle()}
            />
          </label>
          <label>
            <span style={rfLabelStyle()}>Minutos</span>
            <input
              type="number"
              min={0}
              max={59}
              value={draft.atraso_minutos ?? 0}
              onChange={(e) =>
                update({ atraso_minutos: clampMinutos(Number.parseInt(e.target.value, 10) || 0) })
              }
              style={rfInputStyle()}
            />
          </label>
        </div>
        <p style={{ margin: 0, fontSize: 10, color: RF_TEXT_SECONDARY, lineHeight: 1.4 }}>
          Envia após <strong style={{ color: RF_ACCENT }}>{formatarAtrasoPasso(draft)}</strong> sem resposta do
          cliente.
        </p>

        {draft.tipo_conteudo === "texto" ? (
          <label>
            <span style={rfLabelStyle()}>Mensagem</span>
            <textarea
              rows={3}
              value={draft.texto_template || ""}
              onChange={(e) => update({ texto_template: e.target.value })}
              style={{ ...rfInputStyle(), resize: "vertical" }}
              placeholder="Olá {nome}, ainda posso ajudar?"
            />
          </label>
        ) : null}

        {draft.tipo_conteudo === "texto_imagem" ? (
          <label>
            <span style={rfLabelStyle()}>Legenda da imagem</span>
            <textarea
              rows={3}
              value={draft.legenda_imagem || ""}
              onChange={(e) => update({ legenda_imagem: e.target.value })}
              style={{ ...rfInputStyle(), resize: "vertical" }}
              placeholder="Texto que acompanha a imagem"
            />
          </label>
        ) : null}

        {draft.tipo_conteudo === "imagem" ? (
          <label>
            <span style={rfLabelStyle()}>Legenda (opcional)</span>
            <textarea
              rows={2}
              value={draft.legenda_imagem || ""}
              onChange={(e) => update({ legenda_imagem: e.target.value })}
              style={{ ...rfInputStyle(), resize: "vertical" }}
            />
          </label>
        ) : null}

        {showImagem ? (
          <div>
            <span style={rfLabelStyle()}>Imagem (bucket agent-followup)</span>
            <label
              style={{
                display: "block",
                marginTop: 6,
                padding: "14px 10px",
                borderRadius: 10,
                border: `2px dashed ${RF_BORDER_STRONG}`,
                background: "rgba(6,13,8,0.35)",
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
                <Loader2 size={20} className="animate-spin" color={RF_ACCENT} />
              ) : (
                <Upload size={20} color={RF_ACCENT} />
              )}
              <span style={{ display: "block", marginTop: 6, fontSize: 11, fontWeight: 700, color: RF_TEXT_PRIMARY }}>
                {uploading ? "A enviar…" : "Clique para enviar imagem"}
              </span>
            </label>
            {draft.imagem_url ? (
              <div style={{ marginTop: 8, position: "relative" }}>
                <img
                  src={draft.imagem_url}
                  alt=""
                  style={{ width: "100%", borderRadius: 8, border: `1px solid ${RF_BORDER}` }}
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
            style={miniBtnStyle(!canMoveUp || saving)}
          >
            ↑ Subir
          </button>
          <button
            type="button"
            disabled={!canMoveDown || saving}
            onClick={onMoveDown}
            style={miniBtnStyle(!canMoveDown || saving)}
          >
            ↓ Descer
          </button>
        </div>
      </div>

      <div
        style={{
          padding: "12px 14px",
          borderTop: `1px solid ${RF_BORDER}`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          type="button"
          disabled={saving || atrasoTotalMinutos(draft) < 1}
          onClick={() => onSave(draft)}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 8,
            border: "none",
            background: RF_ACCENT,
            color: "#0b2210",
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

function miniBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "7px 8px",
    borderRadius: 8,
    border: `1px solid ${RF_BORDER_STRONG}`,
    background: "rgba(6,13,8,0.55)",
    color: disabled ? RF_TEXT_MUTED : RF_TEXT_PRIMARY,
    fontSize: 10,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { HubAgenteFollowupConfig, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { configGatilhoPadrao, esperaMinutosDoPasso, textoExibicaoFollowupPasso } from "@/lib/hub/followup-types";
import { FollowupEsperaMinutosField, patchEsperaMinutos } from "./FollowupEsperaMinutosField";
import { passoPersistenciaIgual } from "./types";
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
  passos?: HubAgenteFollowupPasso[];
  saving: boolean;
  onClose: () => void;
  onSave: (patch: GatilhoDraft) => void | Promise<void>;
  onPatch: (patch: Partial<GatilhoDraft>) => void;
  onSalvarPasso?: (passo: HubAgenteFollowupPasso) => void | Promise<void>;
  onAtualizarPassoLocal?: (id: string, patch: Partial<HubAgenteFollowupPasso>) => void;
  onSelectPasso?: (passoId: string) => void;
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

function clonePasso(p: HubAgenteFollowupPasso): HubAgenteFollowupPasso {
  return JSON.parse(JSON.stringify(p)) as HubAgenteFollowupPasso;
}

export function FollowupTriggerEditorSideover({
  config,
  passos = [],
  saving,
  onClose,
  onSave,
  onPatch,
  onSalvarPasso,
  onAtualizarPassoLocal,
  onSelectPasso,
  onRegisterFlush,
}: Props) {
  const [draft, setDraft] = useState<GatilhoDraft>(() => draftFromConfig(config));
  const passosOrdenados = useMemo(
    () => [...passos].sort((a, b) => a.ordem - b.ordem),
    [passos]
  );
  const [passosDraft, setPassosDraft] = useState<HubAgenteFollowupPasso[]>(() =>
    passosOrdenados.map(clonePasso)
  );
  const [saveOk, setSaveOk] = useState(false);
  const baselineConfigRef = useRef<GatilhoDraft>(draftFromConfig(config));
  const baselinePassosRef = useRef<HubAgenteFollowupPasso[]>(
    passosOrdenados.map(clonePasso)
  );

  function markSaved() {
    setSaveOk(true);
    window.setTimeout(() => setSaveOk(false), 2200);
  }

  function update(patch: Partial<GatilhoDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onPatch(patch);
  }

  function updatePassoEspera(passoId: string, minutos: number, index: number) {
    setPassosDraft((prev) =>
      prev.map((p) => {
        if (p.id !== passoId) return p;
        const patch = patchEsperaMinutos(minutos);
        const next = { ...p, ...patch };
        onAtualizarPassoLocal?.(passoId, patch);
        return next;
      })
    );
    void index;
  }

  const flushDraft = useCallback(async () => {
    let gravou = false;
    if (!draftIgual(draft, baselineConfigRef.current)) {
      await onSave(draft);
      baselineConfigRef.current = { ...draft };
      gravou = true;
    }
    if (onSalvarPasso) {
      for (const edited of passosDraft) {
        const original = baselinePassosRef.current.find((p) => p.id === edited.id);
        if (original && !passoPersistenciaIgual(edited, original)) {
          await onSalvarPasso(edited);
          gravou = true;
        }
      }
      baselinePassosRef.current = passosDraft.map(clonePasso);
    }
    if (gravou) markSaved();
    return gravou;
  }, [draft, onSave, onSalvarPasso, passosDraft]);

  useEffect(() => {
    onRegisterFlush?.(async () => {
      await flushDraft();
    });
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
            Cadência e arquivamento
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: RF_LIGHT_TEXT_MUTED }}>
            Quando enviar cada follow-up
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

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <p style={{ margin: 0, fontSize: 10, color: RF_LIGHT_TEXT_MUTED, lineHeight: 1.45 }}>
          Defina o tempo de espera de cada passo. Só mensagens do cliente reiniciam o relógio — respostas
          automáticas do bot <strong>não</strong> contam.
        </p>

        {passosDraft.length === 0 ? (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: `1px dashed ${RF_LIGHT_BORDER}`,
              fontSize: 11,
              color: RF_LIGHT_TEXT_SECONDARY,
              lineHeight: 1.45,
            }}
          >
            Adicione um passo (Mensagem, Imagem…) na barra superior para configurar o primeiro envio.
          </div>
        ) : (
          passosDraft.map((passo, index) => {
            const posicao = index + 1;
            const espera = esperaMinutosDoPasso(passo, config, index);
            const resumo = textoExibicaoFollowupPasso(passo).slice(0, 48) || `Passo ${posicao}`;
            return (
              <div
                key={passo.id}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${RF_LIGHT_BORDER}`,
                  background: "#fafdfa",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: RF_LIGHT_TEXT_PRIMARY }}>
                      Passo {posicao}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: RF_LIGHT_TEXT_MUTED }} title={resumo}>
                      {resumo}
                    </p>
                  </div>
                  {onSelectPasso ? (
                    <button
                      type="button"
                      onClick={() => onSelectPasso(passo.id)}
                      style={{
                        border: `1px solid ${RF_LIGHT_BORDER}`,
                        background: "#fff",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 9,
                        fontWeight: 700,
                        color: "#2e7d32",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Editar mensagem
                    </button>
                  ) : null}
                </div>
                <FollowupEsperaMinutosField
                  posicao={posicao}
                  esperaMinutos={espera}
                  disabled={saving}
                  theme="light"
                  compact
                  onChange={(m) => updatePassoEspera(passo.id, m, index)}
                />
              </div>
            );
          })
        )}

        <div style={{ height: 1, background: RF_LIGHT_BORDER }} />

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
            Depois de todos os passos, se o cliente continuar em silêncio.
          </span>
        </label>

        {passosDraft.length > 0 ? (
          <p style={{ margin: 0, fontSize: 10, color: RF_LIGHT_TEXT_MUTED, lineHeight: 1.45 }}>
            Para texto, imagem e legenda, clique no cartão do passo no fluxo ou em{" "}
            <strong>Editar mensagem</strong>.
          </p>
        ) : null}
      </div>

      <div style={{ padding: "12px 14px", borderTop: `1px solid ${RF_LIGHT_BORDER}` }}>
        {saveOk ? (
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#2e7d32", textAlign: "center" }}>
            Cadência guardada.
          </p>
        ) : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void flushDraft()}
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
          Guardar cadência
        </button>
      </div>
    </div>
  );
}

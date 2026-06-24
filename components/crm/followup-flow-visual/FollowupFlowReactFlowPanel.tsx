"use client";

import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { Image as ImageIcon, MessageSquare, Plus, Workflow } from "lucide-react";
import type { FollowupTipoConteudo, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { FollowupFlowLegend } from "./FollowupFlowNodes";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

const FollowupFlowCanvas = dynamic(
  () => import("./FollowupFlowCanvas").then((m) => m.FollowupFlowCanvas),
  {
    ssr: false,
    loading: () => (
      <div style={loadingStyle}>
        <Workflow size={20} style={{ opacity: 0.35, color: RF_ACCENT }} />
        <span>A carregar diagrama…</span>
      </div>
    ),
  }
);

type Props = {
  passos: HubAgenteFollowupPasso[];
  saving: boolean;
  uploadingId: string | null;
  disabled?: boolean;
  onAdicionarPasso: (tipo: FollowupTipoConteudo) => Promise<void>;
  onSalvarPasso: (passo: HubAgenteFollowupPasso) => Promise<void>;
  onExcluirPasso: (id: string) => Promise<void>;
  onReorder: (reordered: HubAgenteFollowupPasso[]) => Promise<void>;
  onUploadImagem: (passoId: string, file: File) => Promise<void>;
  onAtualizarLocal: (id: string, patch: Partial<HubAgenteFollowupPasso>) => void;
};

export function FollowupFlowReactFlowPanel({
  passos,
  saving,
  uploadingId,
  disabled,
  onAdicionarPasso,
  onSalvarPasso,
  onExcluirPasso,
  onReorder,
  onUploadImagem,
  onAtualizarLocal,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${RF_BORDER}`,
          background: "rgba(6,13,8,0.45)",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: RF_ACCENT }}>
            Diagrama de passos
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: RF_TEXT_MUTED, lineHeight: 1.4 }}>
            Arraste não é necessário — clique num nó para editar texto, imagem e atraso.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => void onAdicionarPasso("texto")}
            style={toolBtnStyle(disabled || saving)}
          >
            <MessageSquare size={14} /> Texto
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => void onAdicionarPasso("imagem")}
            style={toolBtnStyle(disabled || saving)}
          >
            <ImageIcon size={14} /> Imagem
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => void onAdicionarPasso("texto_imagem")}
            style={toolBtnStyle(disabled || saving)}
          >
            <Plus size={14} /> Imagem + legenda
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${RF_BORDER_STRONG}`,
          overflow: "hidden",
          background: "rgba(4,10,6,0.35)",
        }}
      >
        <FollowupFlowCanvas
          passos={passos}
          saving={saving}
          uploadingId={uploadingId}
          disabled={disabled}
          onSalvarPasso={onSalvarPasso}
          onExcluirPasso={onExcluirPasso}
          onReorder={onReorder}
          onUploadImagem={onUploadImagem}
          onAtualizarLocal={onAtualizarLocal}
        />
      </div>

      <FollowupFlowLegend />
    </div>
  );
}

function toolBtnStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 10px",
    borderRadius: 8,
    border: `1px solid ${RF_BORDER_STRONG}`,
    background: "rgba(6,13,8,0.55)",
    color: disabled ? RF_TEXT_MUTED : RF_TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const loadingStyle: CSSProperties = {
  height: 520,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  color: RF_TEXT_MUTED,
  fontSize: 12,
};

"use client";

import type { FollowupTipoConteudo, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { formatarAtrasoPasso } from "@/lib/hub/followup-types";

export const FOLLOWUP_START_NODE_ID = "__followup_start__";

export type FollowupFlowNodeKind = "start" | FollowupTipoConteudo;

export type FollowupFlowNodeData = {
  kind: FollowupFlowNodeKind;
  passoId?: string;
  ordem?: number;
  atrasoLabel?: string;
  textoPreview?: string;
  imagemUrl?: string | null;
  ativo?: boolean;
  legenda?: string | null;
};

export function passoToNodeData(passo: HubAgenteFollowupPasso): FollowupFlowNodeData {
  const texto =
    passo.tipo_conteudo === "imagem"
      ? passo.legenda_imagem || "Imagem sem legenda"
      : passo.texto_template || "Sem mensagem";

  return {
    kind: passo.tipo_conteudo,
    passoId: passo.id,
    ordem: passo.ordem,
    atrasoLabel: formatarAtrasoPasso(passo),
    textoPreview: texto,
    imagemUrl: passo.imagem_url,
    ativo: passo.ativo,
    legenda: passo.legenda_imagem,
  };
}

export function summarizeFollowupText(text: string, max = 72): string {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Sem conteúdo";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

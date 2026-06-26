"use client";

import type { FollowupTipoConteudo, HubAgenteFollowupConfig, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { configGatilhoPadrao, esperaMinutosDoPasso, formatarEsperaMinutos, formatarEsperaPasso, textoExibicaoFollowupPasso } from "@/lib/hub/followup-types";

export const FOLLOWUP_START_NODE_ID = "__followup_start__";

export type FollowupFlowNodeKind = "start" | FollowupTipoConteudo;

export type FollowupFlowNodeData = {
  kind: FollowupFlowNodeKind;
  passoId?: string;
  ordem?: number;
  /** Posição na fila (1..N) — preferir sobre `ordem` na UI. */
  posicao?: number;
  atrasoLabel?: string;
  gatilhoLabel?: string;
  textoPreview?: string;
  imagemUrl?: string | null;
  ativo?: boolean;
  legenda?: string | null;
};

export function configToStartNodeData(config: HubAgenteFollowupConfig | null | undefined): FollowupFlowNodeData {
  const padrao = configGatilhoPadrao();
  const c = config ?? padrao;
  return {
    kind: "start",
    gatilhoLabel: "Início da cadência",
    textoPreview: `Arquivar lead após ${c.arquivar_apos_dias ?? padrao.arquivar_apos_dias} dia(s) sem resposta`,
  };
}

export function passoToNodeData(
  passo: HubAgenteFollowupPasso,
  posicao?: number,
  config?: HubAgenteFollowupConfig | null
): FollowupFlowNodeData {
  const texto = textoExibicaoFollowupPasso(passo);
  const idx = (posicao ?? passo.ordem) - 1;
  const cfg = config ?? configGatilhoPadrao();

  return {
    kind: passo.tipo_conteudo,
    passoId: passo.id,
    ordem: passo.ordem,
    posicao: posicao ?? passo.ordem,
    atrasoLabel: formatarEsperaPasso(passo, cfg, Math.max(0, idx)),
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

export function passoPersistenciaSnapshot(p: HubAgenteFollowupPasso) {
  return {
    id: p.id,
    ordem: p.ordem,
    espera_minutos: p.espera_minutos ?? null,
    atraso_dias: p.atraso_dias ?? 0,
    atraso_horas: p.atraso_horas,
    atraso_minutos: p.atraso_minutos ?? 0,
    tipo_conteudo: p.tipo_conteudo,
    texto_template: p.texto_template ?? null,
    imagem_url: p.imagem_url ?? null,
    legenda_imagem: p.legenda_imagem ?? null,
    disparo_hora_dia: p.disparo_hora_dia ?? null,
    ativo: p.ativo,
  };
}

export function configPersistenciaSnapshot(c: HubAgenteFollowupConfig | null | undefined) {
  const padrao = configGatilhoPadrao();
  const cfg = c ?? padrao;
  return {
    arquivar_apos_dias: cfg.arquivar_apos_dias ?? padrao.arquivar_apos_dias,
    gatilho_tipo: cfg.gatilho_tipo ?? padrao.gatilho_tipo,
    gatilho_dias: cfg.gatilho_dias ?? padrao.gatilho_dias,
    gatilho_horas: cfg.gatilho_horas ?? padrao.gatilho_horas,
    gatilho_minutos: cfg.gatilho_minutos ?? padrao.gatilho_minutos,
    gatilho_hora_dia: cfg.gatilho_hora_dia ?? padrao.gatilho_hora_dia,
  };
}

export function passoPersistenciaIgual(a: HubAgenteFollowupPasso, b: HubAgenteFollowupPasso): boolean {
  return JSON.stringify(passoPersistenciaSnapshot(a)) === JSON.stringify(passoPersistenciaSnapshot(b));
}

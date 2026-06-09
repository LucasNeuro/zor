import type { LucideIcon } from "lucide-react";
import { Clock, MessageSquare, ScrollText, Webhook, Zap } from "lucide-react";
import { BRAND_GREEN_BRIGHT } from "@/lib/brand";

export type CicloTipo = "continuo" | "programado" | "gatilho";

export const CICLO_TIPO_COR: Record<string, string> = {
  continuo: "#22c55e",
  programado: BRAND_GREEN_BRIGHT,
  gatilho: "#3b82f6",
};

export const CICLO_STATUS_COR: Record<string, string> = {
  sucesso: "#22c55e",
  sem_acao: "#6b8a76",
  erro: "#dc2626",
  rodando: BRAND_GREEN_BRIGHT,
  nunca_executado: "#94a3b8",
};

export const CICLO_TIPO_META: Record<
  CicloTipo,
  { label: string; Icon: LucideIcon; cor: string; descricaoCurta: string }
> = {
  gatilho: {
    label: "Gatilho",
    Icon: Webhook,
    cor: CICLO_TIPO_COR.gatilho,
    descricaoCurta: "Dispara por interação no canal ou webhook",
  },
  continuo: {
    label: "Contínuo",
    Icon: Zap,
    cor: CICLO_TIPO_COR.continuo,
    descricaoCurta: "Motor interno em execução contínua",
  },
  programado: {
    label: "Programado",
    Icon: Clock,
    cor: CICLO_TIPO_COR.programado,
    descricaoCurta: "Agenda cron / dispatch",
  },
};

export function cicloTipoIcon(tipo: string): LucideIcon {
  if (tipo === "gatilho") return Webhook;
  if (tipo === "continuo") return Zap;
  return Clock;
}

export function cicloTipoMeta(tipo: string) {
  if (tipo === "gatilho" || tipo === "continuo" || tipo === "programado") {
    return CICLO_TIPO_META[tipo];
  }
  return CICLO_TIPO_META.programado;
}

export function tempoRelativoCiclo(d?: string): string {
  if (!d) return "nunca";
  const diff = (Date.now() - new Date(d).getTime()) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.round(diff)}min atrás`;
  if (diff < 1440) return `${Math.round(diff / 60)}h atrás`;
  return `${Math.round(diff / 1440)}d atrás`;
}

export function formatarDuracaoMs(inicio?: string, fim?: string): string | null {
  if (!inicio || !fim) return null;
  const ms = new Date(fim).getTime() - new Date(inicio).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

export type CicloTimelineEventKind = "execucao" | "acao_ia" | "prompt";

export type CicloTimelineEvent = {
  id: string;
  kind: CicloTimelineEventKind;
  status: string;
  titulo: string;
  subtitulo?: string;
  iniciado_em: string;
  finalizado_em?: string | null;
  erro?: string | null;
  tokens_usados?: number | null;
  custo_brl?: number | null;
  acoes_tomadas?: unknown;
  alertas_gerados?: unknown;
  metadata?: Record<string, unknown>;
};

export const TIMELINE_KIND_ICON: Record<CicloTimelineEventKind, LucideIcon> = {
  execucao: ScrollText,
  acao_ia: Zap,
  prompt: MessageSquare,
};

export function acoesParaTextoFromTimeline(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x)).filter(Boolean).slice(0, 8);
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const parts: string[] = [];
    if (o.acao) parts.push(String(o.acao));
    if (o.lead_id) parts.push(`lead ${String(o.lead_id).slice(0, 8)}…`);
    if (o.mercado) parts.push(String(o.mercado));
    if (o.descricao) parts.push(String(o.descricao));
    return parts.length > 0 ? parts : [JSON.stringify(raw).slice(0, 120)];
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

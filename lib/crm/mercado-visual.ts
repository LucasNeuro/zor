import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Factory,
  Hammer,
  HardHat,
  Layers,
  Package,
  Wrench,
} from "lucide-react";
import { MERCADOS_PREFIXO, type PrefixoMercado } from "@/lib/crm/negocio-cadastro";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";

export const MERCADO_ICON: Record<string, LucideIcon> = {
  IMB: Building2,
  ARQ: Layers,
  RFM: Hammer,
  MRC: Package,
  ENG: HardHat,
  SRV: Wrench,
  PRO: Factory,
  FOR: Package,
};

/** Cor do anel/acento por mercado (pipeline global). */
export const MERCADO_ACCENT: Record<string, string> = {
  IMB: "#8b5cf6",
  ARQ: "#f59e0b",
  RFM: "#f97316",
  MRC: "#06b6d4",
  ENG: "#3b82f6",
  SRV: "#22c55e",
  PRO: "#a855f7",
  FOR: "#10b981",
};

export function mercadoIcon(sigla: string | null | undefined): LucideIcon {
  const key = String(sigla || "IMB").trim().toUpperCase();
  return MERCADO_ICON[key] ?? Building2;
}

export function mercadoAccent(sigla: string | null | undefined): string {
  const key = String(sigla || "IMB").trim().toUpperCase();
  return MERCADO_ACCENT[key] ?? "#6b7280";
}

export function resolverMercadoLead(metadata: unknown): PrefixoMercado {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const principal = String(meta.mercado_principal || "").trim().toUpperCase();
  if ((MERCADOS_PREFIXO as readonly string[]).includes(principal)) {
    return principal as PrefixoMercado;
  }
  const mercados = meta.mercados;
  if (Array.isArray(mercados) && mercados.length > 0) {
    const first = String(mercados[0]).trim().toUpperCase();
    if ((MERCADOS_PREFIXO as readonly string[]).includes(first)) {
      return first as PrefixoMercado;
    }
  }
  return "IMB";
}

export function labelMercadoLead(metadata: unknown): string {
  return labelMercadoPrefixo(resolverMercadoLead(metadata));
}

export function mercadosExtrasLead(metadata: unknown): PrefixoMercado[] {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const principal = resolverMercadoLead(metadata);
  if (!Array.isArray(meta.mercados)) return [];
  return meta.mercados
    .map((m) => String(m).trim().toUpperCase())
    .filter(
      (s): s is PrefixoMercado =>
        (MERCADOS_PREFIXO as readonly string[]).includes(s) && s !== principal
    );
}

import type { CrmLeadRow } from "@/hooks/useCrmLeadsQueries";
import { ESTAGIOS_FALLBACK_ATENDIMENTO_UI } from "@/lib/crm/pipeline-defaults";

export type AtendimentoCanalFilter = "whatsapp" | "email";

export type EstagioAtendimentoUi = { id: string; label: string; color: string };

export const ESTAGIOS_ATENDIMENTO_FALLBACK: EstagioAtendimentoUi[] =
  ESTAGIOS_FALLBACK_ATENDIMENTO_UI.map((e) => ({
    id: e.id,
    label: e.label,
    color: e.color,
  }));

export function leadEmAtendimentoAberto(
  lead: Pick<CrmLeadRow, "estagio_atendimento">
): boolean {
  return (lead.estagio_atendimento || "novo") !== "fechado";
}

export function estagioAtendimentoColuna(lead: Pick<CrmLeadRow, "estagio_atendimento">): string {
  return lead.estagio_atendimento || "novo";
}

export function estagiosAtendimentoFromPipeline(
  estagios:
    | { slug: string; label: string; cor?: string; ativo?: boolean; ordem?: number }[]
    | undefined
): EstagioAtendimentoUi[] {
  const cols =
    estagios
      ?.filter((e) => e.ativo !== false)
      .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
      .map((e) => ({ id: e.slug, label: e.label, color: e.cor || "#6B7280" })) ?? [];
  return cols.length ? cols : ESTAGIOS_ATENDIMENTO_FALLBACK;
}

export function tempo(iso?: string | null): string {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

export function formatDataAtendimento(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

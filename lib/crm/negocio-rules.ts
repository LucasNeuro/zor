import { MOTIVOS_PERDA } from "@/lib/crm/pipelines";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

export function validarMudancaNegocio(params: {
  etapa?: string | null;
  status?: string | null;
  motivo_perda?: string | null;
  pessoa_id?: string | null;
  responsavel_id?: string | null;
  proxima_acao?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const etapa = (params.etapa ?? "").toLowerCase();
  const status = (params.status ?? "").toLowerCase();

  const perdido =
    etapa === "fechado_perdido" || status === "fechado_perdido" || status === "cancelado";
  const ganho = etapa === "fechado_ganho" || status === "fechado_ganho";

  if (perdido && !params.motivo_perda?.trim()) {
    return { ok: false, error: "Informe o motivo da perda do negócio." };
  }

  if (perdido && params.motivo_perda && params.motivo_perda !== "outro") {
    if (!MOTIVOS_PERDA.includes(params.motivo_perda as (typeof MOTIVOS_PERDA)[number])) {
      return { ok: false, error: "Motivo de perda inválido." };
    }
  }

  if (ganho && !params.pessoa_id?.trim()) {
    return { ok: false, error: "Negócio ganho exige pessoa principal vinculada." };
  }

  if (crmFeatureFlags.proximaAcaoObrigatoria() && !perdido && !ganho) {
    if (!params.proxima_acao?.trim() && status !== "fechado_ganho") {
      return { ok: false, error: "Defina a próxima ação do negócio." };
    }
  }

  return { ok: true };
}

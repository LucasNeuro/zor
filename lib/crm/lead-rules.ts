import { MOTIVOS_PERDA, type FunilLeadSlug } from "@/lib/crm/pipelines";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

export function validarMudancaEstagioLead(params: {
  estagio_funil?: string | null;
  estagio?: string | null;
  motivo_perda?: string | null;
  proxima_acao?: string | null;
  data_proxima_acao?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const funil = (params.estagio_funil ?? params.estagio ?? "").trim();

  if (funil === "perdido" || funil === "spam_invalido" || params.estagio === "perdido") {
    if (!params.motivo_perda?.trim()) {
      return { ok: false, error: "Informe o motivo da perda." };
    }
    const motivo = params.motivo_perda.trim();
    const motivoValido =
      motivo === "outro" ||
      MOTIVOS_PERDA.includes(motivo as (typeof MOTIVOS_PERDA)[number]) ||
      motivo.length >= 4;
    if (!motivoValido) {
      return { ok: false, error: "Motivo de perda inválido." };
    }
  }

  if (crmFeatureFlags.proximaAcaoObrigatoria()) {
    const etapasAtivas: FunilLeadSlug[] = [
      "novo",
      "em_atendimento",
      "aguardando_resposta",
      "qualificando",
      "encaminhado",
    ];
    const slug = (params.estagio_funil ?? params.estagio) as FunilLeadSlug;
    if (etapasAtivas.includes(slug) && !params.proxima_acao?.trim() && !params.data_proxima_acao) {
      return { ok: false, error: "Defina a próxima ação antes de continuar." };
    }
  }

  return { ok: true };
}

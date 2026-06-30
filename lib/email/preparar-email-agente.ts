import type { SupabaseClient } from "@supabase/supabase-js";
import {
  carregarBrandingAgenteArtefato,
  type ArtefatoBranding,
} from "@/lib/hub/superagente/artefato-branding";
import {
  formatarCorpoEmailAgente,
  type EmailAgenteFormatado,
} from "@/lib/email/email-agente-shell";

export type EmailAgentePreparado = EmailAgenteFormatado & {
  branding: ArtefatoBranding;
  fromName: string;
};

/** Carrega identidade do agente e formata corpo com marca + assinatura. */
export async function prepararEmailAgente(
  supabase: SupabaseClient,
  tenantId: string,
  agenteSlug: string,
  corpo: string
): Promise<EmailAgentePreparado> {
  const branding = await carregarBrandingAgenteArtefato(supabase, tenantId, agenteSlug);
  const formatado = formatarCorpoEmailAgente(corpo, branding);
  return {
    ...formatado,
    branding,
    fromName: branding.agenteNome,
  };
}

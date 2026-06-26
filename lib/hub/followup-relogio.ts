import type { SupabaseClient } from "@supabase/supabase-js";

/** Converte timestamp WhatsApp/ISO em Date válida. */
export function parseFollowupTimestamp(isoOrDate: string | Date | null | undefined): Date | null {
  if (isoOrDate == null || isoOrDate === "") return null;
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Minutos desde a última mensagem **do cliente** (`ultima_msg_cliente_em`).
 * Retorna null quando o relógio não está disponível (lead sem msg inbound registrada).
 */
export function minutosSilencioDesdeUltimaMsgCliente(
  ultimaMsgClienteEm: string | null | undefined,
  agoraMs: number
): number | null {
  const d = parseFollowupTimestamp(ultimaMsgClienteEm);
  if (!d) return null;
  return Math.max(0, (agoraMs - d.getTime()) / 60_000);
}

/**
 * Preenche `ultima_msg_cliente_em` a partir da última mensagem inbound na fila (leads legados).
 * Não usa `ultimo_contato` nem respostas do bot — só direção entrada.
 */
export async function backfillUltimaMsgClienteEm(
  supabase: SupabaseClient,
  leadId: string
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from("hub_fila_mensagens")
    .select("enviada_em, criado_em")
    .eq("lead_id", leadId)
    .eq("direcao", "entrada")
    .order("enviada_em", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) return null;

  const iso =
    (typeof row.enviada_em === "string" && row.enviada_em.trim()) ||
    (typeof row.criado_em === "string" && row.criado_em.trim()) ||
    null;
  if (!iso || !parseFollowupTimestamp(iso)) return null;

  try {
    await supabase.from("hub_leads_crm").update({ ultima_msg_cliente_em: iso }).eq("id", leadId);
  } catch {
    return iso;
  }

  return iso;
}

/** Verdadeiro quando o cliente falou depois do último follow-up automático. */
export function clienteRespondeuAposUltimoFollowup(
  ultimaMsgClienteEm: string | null | undefined,
  ultimoFollowup: string | null | undefined
): boolean {
  const msg = parseFollowupTimestamp(ultimaMsgClienteEm);
  const fu = parseFollowupTimestamp(ultimoFollowup);
  if (!msg || !fu) return false;
  return msg.getTime() > fu.getTime();
}

/** Janela mínima anti-duplicata por passo (independente da fila CRM). */
export function janelaAntiduplicataMinutos(esperaPasso: number, indicePasso: number): number {
  const espera = Math.max(1, Math.floor(esperaPasso));
  if (indicePasso === 0) return Math.max(espera, 10);
  return Math.max(espera, 5);
}

/**
 * Bloqueia reenvio usando `ultimo_followup` no lead — funciona mesmo quando
 * `hub_fila_mensagens` falha (ex.: tenant_id ausente).
 */
export function followupLeadBloqueadoPorEnvioRecente(params: {
  minutosDesdeUltimoFollowup: number | null;
  enviadosCount: number;
  indicePasso: number;
  esperaPasso: number;
}): { bloqueado: boolean; detalhe?: string } {
  const { minutosDesdeUltimoFollowup, enviadosCount, indicePasso, esperaPasso } = params;
  if (minutosDesdeUltimoFollowup == null) return { bloqueado: false };

  const janela = janelaAntiduplicataMinutos(esperaPasso, indicePasso);
  const mins = Math.floor(minutosDesdeUltimoFollowup);

  if (minutosDesdeUltimoFollowup >= janela) return { bloqueado: false };

  if (indicePasso === 0 && enviadosCount === 0) {
    return { bloqueado: true, detalhe: `passo 1 enviado há ${mins} min` };
  }

  if (enviadosCount > indicePasso) {
    return { bloqueado: true, detalhe: `follow-up recente há ${mins} min` };
  }

  if (enviadosCount === indicePasso + 1 && minutosDesdeUltimoFollowup < esperaPasso) {
    return {
      bloqueado: true,
      detalhe: `passo ${indicePasso + 1}: ${mins}/${esperaPasso} min desde o anterior`,
    };
  }

  return { bloqueado: false };
}

/** Evita reenvio do mesmo passo (cron + worker ou falha ao gravar contador). */
export async function followupPassoEnviadoRecentemente(
  supabase: SupabaseClient,
  leadId: string,
  passoId: string,
  janelaMinutos: number
): Promise<boolean> {
  const janela = Math.max(5, Math.floor(janelaMinutos));
  const limite = new Date(Date.now() - janela * 60_000).toISOString();
  const { data, error } = await supabase
    .from("hub_fila_mensagens")
    .select("id, metadata")
    .eq("lead_id", leadId)
    .eq("direcao", "saida")
    .gte("criado_em", limite)
    .order("criado_em", { ascending: false })
    .limit(15);

  if (error || !data?.length) return false;

  return data.some((row) => {
    const meta = row.metadata as Record<string, unknown> | null;
    return meta?.tipo === "followup_automatico" && meta?.passo_id === passoId;
  });
}

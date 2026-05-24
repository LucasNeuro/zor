import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarTelefoneWhatsapp } from "@/lib/crm/sincronizar-contato-whatsapp";

/** Identificador global da conversa WhatsApp = telefone só dígitos (E.164 sem +). */
export function telefoneConversaId(telefone: string | null | undefined): string {
  return normalizarTelefoneWhatsapp(String(telefone ?? ""));
}

export function telefonesConversaEquivalentes(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const da = telefoneConversaId(a);
  const db = telefoneConversaId(b);
  if (!da || !db || da.length < 10 || db.length < 10) return false;
  if (da === db) return true;
  const sa = da.length >= 12 ? da.slice(-11) : da;
  const sb = db.length >= 12 ? db.slice(-11) : db;
  return sa === sb;
}

export type ValidacaoIsolamentoLead =
  | { ok: true; telefoneLead: string }
  | { ok: false; codigo: string; detalhe: string };

/** Garante que lead_id corresponde ao telefone da mensagem inbound (anti-cruzamento). */
export async function validarLeadTelefoneSessao(
  supabase: SupabaseClient,
  leadId: string,
  telefoneSessao: string
): Promise<ValidacaoIsolamentoLead> {
  const telSessao = telefoneConversaId(telefoneSessao);
  if (telSessao.length < 10) {
    return { ok: false, codigo: "telefone_sessao_invalido", detalhe: "Telefone da sessão inválido." };
  }

  const { data: lead, error } = await supabase
    .from("hub_leads_crm")
    .select("id, telefone")
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    return { ok: false, codigo: "supabase", detalhe: error.message };
  }
  if (!lead) {
    return { ok: false, codigo: "lead_nao_encontrado", detalhe: "Lead da sessão não existe." };
  }

  const telLead = telefoneConversaId(typeof lead.telefone === "string" ? lead.telefone : "");
  if (!telefonesConversaEquivalentes(telSessao, telLead)) {
    return {
      ok: false,
      codigo: "isolamento_lead_telefone",
      detalhe:
        "O lead desta sessão não corresponde ao telefone da mensagem. Conversas não podem ser misturadas.",
    };
  }

  return { ok: true, telefoneLead: telLead };
}

export function blocoIsolamentoConversaWhatsapp(telefoneSessao?: string): string {
  const tel = telefoneSessao ? telefoneConversaId(telefoneSessao) : "";
  const mascarado = tel.length >= 4 ? `***${tel.slice(-4)}` : "—";
  return `═══ ISOLAMENTO DE CONVERSA (crítico) ═══
- Esta thread é **exclusiva** do contacto WhatsApp ${mascarado}. Nunca use dados, histórico ou contexto de outro número.
- Ferramentas (hub_lead_resumo, hub_atualizar_lead, hub_registar_nota_lead, hub_lead_memorias) aplicam-se **só** ao lead desta sessão — o servidor ignora outros IDs.
- **hub_lead_lookup_por_telefone** só consulta o **mesmo** telefone da conversa actual; não pesquise outros clientes.
- Se o cliente perguntar por outra pessoa/número, atenda só o que ele disser agora; não puxe ficha de terceiros.`;
}

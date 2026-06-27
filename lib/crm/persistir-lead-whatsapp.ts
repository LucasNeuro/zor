import type { SupabaseClient } from "@supabase/supabase-js";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";
import { extrairNomeClienteDaMensagem } from "@/lib/crm/extrair-nome-cliente";
import { nomeLeadEhPlaceholder, pushNameParaNomeExibicao } from "@/lib/crm/sincronizar-contato-whatsapp";
import { extrairESalvarMemoriasLead } from "@/lib/ia/memoria-lead";
import { cutoffSessaoConversaMs } from "@/lib/ia/sessao-conversa-ttl";

function parseValorBrl(texto: string): number | undefined {
  const t = texto.replace(/\s/g, "");
  const m = t.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d+)?)/);
  if (!m) return undefined;
  const raw = m[1].replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function nomeParecePlaceholder(nome: string): boolean {
  return nomeLeadEhPlaceholder(nome);
}

export type MemoriasPatchCrmResult = {
  args: Record<string, unknown>;
  resumo: string;
};

/** Converte memórias do lead em patch CRM estruturado. */
export function memoriasParaPatchCrm(
  memorias: Array<{ chave: string; valor: string }>
): MemoriasPatchCrmResult {
  const args: Record<string, unknown> = {};
  const metaExtra: Record<string, unknown> = {};
  const textos: string[] = [];

  for (const m of memorias) {
    const chave = (m.chave || "").toLowerCase().replace(/_auto$/, "");
    const val = String(m.valor || "").trim();
    if (!val) continue;
    textos.push(`${chave}: ${val.slice(0, 120)}`);

    if (chave === "nome" && !nomeParecePlaceholder(val)) {
      args.nome = val.slice(0, 240);
      continue;
    }
    if (chave === "interesse" || chave === "interesse_principal" || chave === "projeto") {
      args.interesse_principal = val.slice(0, 500);
      continue;
    }
    if (chave === "orcamento" || chave === "valor" || chave === "financeiro") {
      const v = parseValorBrl(val);
      if (v !== undefined) args.valor_estimado = v;
      continue;
    }
    if (chave === "prazo" || chave === "comportamento") {
      metaExtra[chave] = val.slice(0, 300);
      continue;
    }
    if (chave === "cidade" || chave === "localizacao") {
      metaExtra.cidade = val.slice(0, 120);
      continue;
    }
    if (chave === "email" && val.includes("@")) {
      args.email = val.slice(0, 320);
      continue;
    }
    metaExtra[chave] = val.slice(0, 200);
  }

  if (Object.keys(metaExtra).length > 0) {
    args.metadata = metaExtra;
  }

  if (args.interesse_principal || args.valor_estimado !== undefined) {
    args.estagio = "qualificando";
  }

  return { args, resumo: textos.join(" | ").slice(0, 500) };
}

/**
 * Após cada turno de conversa: extrai memórias (LLM) e grava em hub_leads_crm + hub_pessoas.
 * Fluxo: falar com o lead → ir recolhendo dados → persistir no banco (sem depender de hub_fluxos no CRM).
 */
export async function persistirDadosLeadWhatsapp(
  supabase: SupabaseClient,
  params: {
    leadId: string;
    mensagemUsuario: string;
    respostaIA: string;
    agenteSlug: string;
    pessoaId?: string | null;
    telefone?: string;
    pushName?: string | null;
  }
): Promise<{ ok: boolean; campos?: string[]; motivo?: string }> {
  const { leadId, mensagemUsuario, respostaIA, agenteSlug, pessoaId, telefone, pushName } = params;

  await extrairESalvarMemoriasLead(supabase, leadId, mensagemUsuario, respostaIA);

  const nomeMsg = extrairNomeClienteDaMensagem(mensagemUsuario, { respostaCurtaPermitida: true });
  if (nomeMsg) {
    await supabase.from("hub_memorias_lead").insert({
      lead_id: leadId,
      chave: "nome",
      valor: nomeMsg,
      confianca: 0.95,
      criado_por: "whatsapp",
    });
  }

  const cutoffIso = new Date(cutoffSessaoConversaMs()).toISOString();
  const { data: mems } = await supabase
    .from("hub_memorias_lead")
    .select("chave, valor")
    .eq("lead_id", leadId)
    .gte("criado_em", cutoffIso)
    .order("criado_em", { ascending: false })
    .limit(40);

  const { data: leadAtual } = await supabase
    .from("hub_leads_crm")
    .select("id, estagio, score, valor_estimado, tags, metadata, preferencias, nome, telefone, interesse_principal, pessoa_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!leadAtual) return { ok: false, motivo: "lead_nao_encontrado" };

  const { args: toolArgs, resumo } = memoriasParaPatchCrm(
    (mems || []) as Array<{ chave: string; valor: string }>
  );

  if (resumo) {
    toolArgs.metadata = {
      ...(typeof toolArgs.metadata === "object" && toolArgs.metadata !== null
        ? (toolArgs.metadata as Record<string, unknown>)
        : {}),
      resumo_ia_turno: resumo,
      fase_atendimento: "dados_sincronizados",
      ultima_sincronizacao: new Date().toISOString(),
    };
  }

  const nomeWa = pushNameParaNomeExibicao(pushName);
  if (
    nomeWa &&
    nomeLeadEhPlaceholder(typeof leadAtual.nome === "string" ? leadAtual.nome : "") &&
    !toolArgs.nome
  ) {
    toolArgs.nome = nomeWa;
  }
  if (telefone?.trim() && !toolArgs.metadata) {
    toolArgs.metadata = { wa_telefone: telefone.replace(/\D/g, "").slice(0, 15) };
  }

  const built = buildHubLeadsCrmPatch(toolArgs, leadAtual as Record<string, unknown>);
  if (!built.ok) {
    return { ok: false, motivo: built.erro ?? built.codigo ?? "patch_invalido" };
  }

  const { error: errUp } = await supabase.from("hub_leads_crm").update(built.patch).eq("id", leadId);
  if (errUp) return { ok: false, motivo: errUp.message };

  const nomeNovo = typeof built.patch.nome === "string" ? built.patch.nome : undefined;
  const pid = pessoaId || (typeof leadAtual.pessoa_id === "string" ? leadAtual.pessoa_id : null);
  if (pid && nomeNovo && !nomeParecePlaceholder(nomeNovo)) {
    await supabase
      .from("hub_pessoas")
      .update({ nome: nomeNovo, atualizado_em: new Date().toISOString() })
      .eq("id", pid);
  }

  const campos = Object.keys(built.patch).filter(
    (k) => k !== "atualizado_em" && k !== "ultimo_contato"
  );

  if (campos.length > 0) {
    await supabase.from("hub_atividades").insert({
      lead_id: leadId,
      tipo: "ia_acao",
      descricao: `Dados do lead actualizados no CRM (${campos.join(", ")})`,
      feito_por: agenteSlug,
      feito_por_tipo: "ia",
      metadata: { origem: "persistir_dados_lead_whatsapp", campos },
    });
  }

  return { ok: true, campos };
}

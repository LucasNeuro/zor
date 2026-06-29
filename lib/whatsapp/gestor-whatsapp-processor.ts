/**
 * WhatsApp do empresário — lista e conversa com agentes internos (mesmo motor do copiloto).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";
import { executarAgenteInterno } from "@/lib/hub/executar-agente-interno";
import {
  carregarTrechoPlaybookCopiloto,
  montarSnapshotOperacionalReadOnly,
  type BriefingMensagemLinha,
} from "@/lib/agente-briefing-chat";
import { formatarBlocoMemoriasAgente, listarMemoriasAgente } from "@/lib/ia/memoria-agente";
import { prepararTextoIaParaWhatsapp } from "@/lib/whatsapp/formatar-texto-whatsapp";
import { whatsappSendText } from "@/lib/whatsapp/whatsapp-send";
import {
  buscarLinhaGestorPorTenant,
  gestorTelefoneAutorizado,
  telefonesAutorizadosGestor,
} from "@/lib/whatsapp/gestor-linha-db";
import { isMissingPgColumn } from "@/lib/tenant-default";

const MAX_HISTORICO = 24;
const MODELO_FALLBACK = "mistral";

type AgenteInternoRow = {
  agente_slug: string;
  nome: string;
  cargo?: string | null;
  modelo?: string | null;
  motor_ferramentas_habilitado?: boolean | null;
};

function normalizarTextoMenu(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function pedeMenu(texto: string): boolean {
  const t = normalizarTextoMenu(texto);
  return /^(menu|lista|assistentes|funcionarios|ajuda|help|oi|ola|inicio|start)$/.test(t);
}

function pedeTrocar(texto: string): boolean {
  const t = normalizarTextoMenu(texto);
  return /^(trocar|mudar|outro|sair|voltar)$/.test(t) || t.includes("trocar assistente");
}

async function listarAgentesInternos(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AgenteInternoRow[]> {
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, cargo, modelo, motor_ferramentas_habilitado")
    .eq("tenant_id", tenantId)
    .eq("modo_operacao", "jobs_internos")
    .eq("ativo", true)
    .is("arquivado_em", null)
    .order("nome");

  if (error) {
    if (isMissingPgColumn(error, "arquivado_em")) {
      const fb = await supabase
        .from("hub_agente_identidade")
        .select("agente_slug, nome, cargo, modelo, motor_ferramentas_habilitado")
        .eq("tenant_id", tenantId)
        .eq("modo_operacao", "jobs_internos")
        .eq("ativo", true)
        .order("nome");
      return (fb.data ?? []) as AgenteInternoRow[];
    }
    return [];
  }
  return (data ?? []) as AgenteInternoRow[];
}

function formatarMenuAgentes(agentes: AgenteInternoRow[]): string {
  if (!agentes.length) {
    return "Não há funcionários IA internos activos nesta empresa. Configure agentes com modo *interno* no CRM.";
  }
  const linhas = agentes.map((a, i) => {
    const cargo = a.cargo?.trim() ? ` — ${a.cargo.trim()}` : "";
    return `${i + 1}. *${a.nome}*${cargo}`;
  });
  return [
    "👋 *Seus funcionários IA*",
    "",
    ...linhas,
    "",
    "Responda com o *número* ou o *nome* para conversar.",
    "A qualquer momento: *menu* (lista) ou *trocar* (outro assistente).",
  ].join("\n");
}

function resolverEscolhaAgente(
  texto: string,
  agentes: AgenteInternoRow[]
): AgenteInternoRow | null {
  const t = normalizarTextoMenu(texto);
  const num = Number.parseInt(t, 10);
  if (Number.isFinite(num) && num >= 1 && num <= agentes.length) {
    return agentes[num - 1] ?? null;
  }
  for (const a of agentes) {
    const nome = normalizarTextoMenu(a.nome);
    const slug = normalizarTextoMenu(a.agente_slug.replace(/_/g, " "));
    if (t.includes(nome) || nome.includes(t) || t.includes(slug)) return a;
    if (a.cargo && t.includes(normalizarTextoMenu(a.cargo))) return a;
  }
  return null;
}

async function obterOuCriarSessao(
  supabase: SupabaseClient,
  tenantId: string,
  telefone: string,
  pushName?: string | null
): Promise<{ id: string; agente_ativo_slug: string | null }> {
  const { data: existente } = await supabase
    .from("hub_gestor_whatsapp_sessao")
    .select("id, agente_ativo_slug")
    .eq("tenant_id", tenantId)
    .eq("telefone_gestor", telefone)
    .maybeSingle();

  if (existente?.id) {
    await supabase
      .from("hub_gestor_whatsapp_sessao")
      .update({
        ultima_mensagem_em: new Date().toISOString(),
        ...(pushName?.trim() ? { push_name: pushName.trim() } : {}),
      })
      .eq("id", existente.id);
    return {
      id: existente.id as string,
      agente_ativo_slug: (existente.agente_ativo_slug as string | null) ?? null,
    };
  }

  const { data: nova, error } = await supabase
    .from("hub_gestor_whatsapp_sessao")
    .insert({
      tenant_id: tenantId,
      telefone_gestor: telefone,
      push_name: pushName?.trim() || null,
    })
    .select("id, agente_ativo_slug")
    .single();

  if (error || !nova) throw new Error(error?.message || "sessao_gestor_falhou");
  return {
    id: nova.id as string,
    agente_ativo_slug: (nova.agente_ativo_slug as string | null) ?? null,
  };
}

async function carregarHistoricoSessao(
  supabase: SupabaseClient,
  sessaoId: string
): Promise<BriefingMensagemLinha[]> {
  const { data } = await supabase
    .from("hub_gestor_whatsapp_mensagem")
    .select("papel, conteudo")
    .eq("sessao_id", sessaoId)
    .order("criado_em", { ascending: true })
    .limit(MAX_HISTORICO);

  return (data ?? [])
    .filter(
      (r): r is { papel: string; conteudo: string } =>
        (r.papel === "user" || r.papel === "assistant") && typeof r.conteudo === "string"
    )
    .map((r) => ({ papel: r.papel as "user" | "assistant", conteudo: r.conteudo }));
}

async function gravarMensagemSessao(
  supabase: SupabaseClient,
  sessaoId: string,
  papel: "user" | "assistant",
  conteudo: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from("hub_gestor_whatsapp_mensagem").insert({
    sessao_id: sessaoId,
    papel,
    conteudo,
    metadata: metadata ?? {},
  });
}

export type ProcessarGestorWhatsappParams = {
  supabase: SupabaseClient;
  tenantId: string;
  telefone: string;
  pushName?: string | null;
  mensagem: string;
  instanceToken: string;
};

export type ProcessarGestorWhatsappResult = {
  ok: boolean;
  motivo?: string;
  respostaEnviada?: boolean;
};

export async function processarMensagemGestorWhatsapp(
  params: ProcessarGestorWhatsappParams
): Promise<ProcessarGestorWhatsappResult> {
  const telefone = telefoneConversaId(params.telefone);
  if (telefone.length < 10) return { ok: false, motivo: "telefone_invalido" };

  const linha = await buscarLinhaGestorPorTenant(params.supabase, params.tenantId);
  if (!linha) return { ok: false, motivo: "linha_gestor_nao_configurada" };

  const autorizados = telefonesAutorizadosGestor(linha.telefones_autorizados);
  if (!gestorTelefoneAutorizado(telefone, autorizados)) {
    const aviso =
      "Este número não está autorizado a usar o WhatsApp interno da empresa. Peça ao administrador para incluir o seu telefone na lista de autorizados no CRM.";
    await whatsappSendText(telefone, aviso, { instanceToken: params.instanceToken });
    return { ok: false, motivo: "telefone_nao_autorizado", respostaEnviada: true };
  }

  const mensagem = params.mensagem.trim();
  if (!mensagem) return { ok: false, motivo: "mensagem_vazia" };

  const sessao = await obterOuCriarSessao(
    params.supabase,
    params.tenantId,
    telefone,
    params.pushName
  );

  const agentes = await listarAgentesInternos(params.supabase, params.tenantId);
  const waOpts = { instanceToken: params.instanceToken };

  if (pedeMenu(mensagem) || pedeTrocar(mensagem)) {
    await params.supabase
      .from("hub_gestor_whatsapp_sessao")
      .update({ agente_ativo_slug: null })
      .eq("id", sessao.id);
    const menu = formatarMenuAgentes(agentes);
    await whatsappSendText(telefone, prepararTextoIaParaWhatsapp(menu), waOpts);
    await gravarMensagemSessao(params.supabase, sessao.id, "user", mensagem);
    await gravarMensagemSessao(params.supabase, sessao.id, "assistant", menu, { tipo: "menu" });
    return { ok: true, respostaEnviada: true };
  }

  let agenteAtivoSlug = sessao.agente_ativo_slug;

  if (!agenteAtivoSlug) {
    const escolhido = resolverEscolhaAgente(mensagem, agentes);
    if (!escolhido) {
      const menu = formatarMenuAgentes(agentes);
      const intro =
        agentes.length > 0
          ? "Escolha um assistente para começar:\n\n" + menu
          : menu;
      await whatsappSendText(telefone, prepararTextoIaParaWhatsapp(intro), waOpts);
      await gravarMensagemSessao(params.supabase, sessao.id, "user", mensagem);
      await gravarMensagemSessao(params.supabase, sessao.id, "assistant", intro, { tipo: "menu" });
      return { ok: true, respostaEnviada: true };
    }
    agenteAtivoSlug = escolhido.agente_slug;
    await params.supabase
      .from("hub_gestor_whatsapp_sessao")
      .update({ agente_ativo_slug: agenteAtivoSlug })
      .eq("id", sessao.id);

    const boas = `A falar com *${escolhido.nome}*${escolhido.cargo ? ` (${escolhido.cargo})` : ""}. Pode perguntar sobre a operação da empresa.\n\n*menu* — lista de assistentes\n*trocar* — mudar de assistente`;
    await whatsappSendText(telefone, prepararTextoIaParaWhatsapp(boas), waOpts);
    await gravarMensagemSessao(params.supabase, sessao.id, "user", mensagem);
    await gravarMensagemSessao(params.supabase, sessao.id, "assistant", boas, {
      tipo: "handoff",
      agente_slug: agenteAtivoSlug,
    });
    return { ok: true, respostaEnviada: true };
  }

  const agenteRow = agentes.find((a) => a.agente_slug === agenteAtivoSlug);
  if (!agenteRow) {
    await params.supabase
      .from("hub_gestor_whatsapp_sessao")
      .update({ agente_ativo_slug: null })
      .eq("id", sessao.id);
    const menu = formatarMenuAgentes(agentes);
    await whatsappSendText(
      telefone,
      prepararTextoIaParaWhatsapp("Esse assistente já não está disponível.\n\n" + menu),
      waOpts
    );
    return { ok: true, respostaEnviada: true };
  }

  const { data: agenteFull } = await params.supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, nome, cargo, area, bio, modelo, system_prompt_base, motor_ferramentas_habilitado, playbook_generated_at, playbook_object_path, playbook_public_url, playbook_source_hash"
    )
    .eq("agente_slug", agenteAtivoSlug)
    .eq("tenant_id", params.tenantId)
    .eq("modo_operacao", "jobs_internos")
    .maybeSingle();

  if (!agenteFull) {
    return { ok: false, motivo: "agente_nao_encontrado" };
  }

  const historico = await carregarHistoricoSessao(params.supabase, sessao.id);
  const historicoParaModelo = historico.slice(-MAX_HISTORICO);

  await gravarMensagemSessao(params.supabase, sessao.id, "user", mensagem);

  let textoResposta: string;
  try {
    const snapshot = await montarSnapshotOperacionalReadOnly(
      params.supabase,
      agenteAtivoSlug,
      String(agenteFull.nome || agenteAtivoSlug)
    );
    const playbookTrecho = await carregarTrechoPlaybookCopiloto(params.supabase, agenteAtivoSlug, {
      playbook_generated_at:
        typeof agenteFull.playbook_generated_at === "string" ? agenteFull.playbook_generated_at : null,
      playbook_object_path:
        typeof agenteFull.playbook_object_path === "string" ? agenteFull.playbook_object_path : null,
      playbook_public_url:
        typeof agenteFull.playbook_public_url === "string" ? agenteFull.playbook_public_url : null,
      playbook_source_hash:
        typeof agenteFull.playbook_source_hash === "string" ? agenteFull.playbook_source_hash : null,
    });

    let memoriasAgenteBloco = "";
    try {
      const mem = await listarMemoriasAgente(params.supabase, agenteAtivoSlug, 4);
      memoriasAgenteBloco = formatarBlocoMemoriasAgente(mem);
    } catch {
      memoriasAgenteBloco = "";
    }

    const modelo =
      typeof agenteFull.modelo === "string" && agenteFull.modelo.trim()
        ? agenteFull.modelo.trim()
        : MODELO_FALLBACK;

    const resultado = await executarAgenteInterno({
      supabase: params.supabase,
      modelo,
      agenteNome: String(agenteFull.nome || agenteAtivoSlug),
      agenteSlug: agenteAtivoSlug,
      tenantId: params.tenantId,
      cargo: typeof agenteFull.cargo === "string" ? agenteFull.cargo : undefined,
      area: typeof agenteFull.area === "string" ? agenteFull.area : undefined,
      bio: typeof agenteFull.bio === "string" ? agenteFull.bio : undefined,
      promptBaseTrecho:
        typeof agenteFull.system_prompt_base === "string" ? agenteFull.system_prompt_base : undefined,
      playbookTrecho,
      snapshot,
      historico: historicoParaModelo,
      mensagemUsuario: mensagem,
      memoriasAgenteBloco,
      trigger: "copiloto",
    });
    textoResposta = resultado.texto.trim() || "Não consegui gerar resposta agora. Tente reformular a pergunta.";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_ia";
    textoResposta = `Desculpe, ocorreu um erro ao processar (${msg.slice(0, 120)}). Tente de novo ou escreva *menu*.`;
  }

  const paraWhatsapp = prepararTextoIaParaWhatsapp(textoResposta);
  const envio = await whatsappSendText(telefone, paraWhatsapp, waOpts);
  await gravarMensagemSessao(params.supabase, sessao.id, "assistant", textoResposta, {
    agente_slug: agenteAtivoSlug,
    whatsapp_ok: envio.ok,
  });

  return { ok: true, respostaEnviada: envio.ok };
}

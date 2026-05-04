import { supabase } from "./client";
import type { HubPessoa as Pessoa, HubLead as Lead, HubNegocio as Negocio, HubDecisao as Decisao } from "./client";

// PESSOAS
export async function encontrarPessoaPorTelefone(telefone: string) {
  const { data } = await supabase
    .from("pessoas")
    .select("*")
    .eq("telefone", telefone)
    .single();
  return data as Pessoa | null;
}

export async function encontrarPessoaPorWhatsapp(whatsappId: string) {
  const { data } = await supabase
    .from("pessoas")
    .select("*")
    .eq("whatsapp_id", whatsappId)
    .single();
  return data as Pessoa | null;
}

export async function criarPessoa(dados: {
  nome: string;
  telefone?: string;
  whatsapp_id?: string;
  tipo: "lead" | "cliente" | "parceiro" | "fornecedor";
}) {
  const ano = new Date().getFullYear();
  const { count } = await supabase
    .from("pessoas")
    .select("*", { count: "exact", head: true });
  const seq = String((count || 0) + 1).padStart(3, "0");
  const codigo = `PES-${ano}-${seq}`;

  const { data, error } = await supabase
    .from("pessoas")
    .insert({ ...dados, codigo })
    .select()
    .single();
  if (error) throw error;
  return data as Pessoa;
}

// LEADS
export async function buscarLeadsAtivos() {
  const { data } = await supabase
    .from("leads")
    .select(`*, pessoa:pessoas(nome, telefone), campanha:campanhas(nome, canal)`)
    .not("status", "eq", "perdido")
    .order("score_prioridade", { ascending: false });
  return (data || []) as (Lead & { pessoa: { nome: string; telefone: string } })[];
}

export async function buscarLeadPorNumero(numero: number) {
  const { data } = await supabase
    .from("leads")
    .select(`*, pessoa:pessoas(*), conversa:conversas(*)`)
    .eq("numero", numero)
    .single();
  return data;
}

export async function criarLead(dados: {
  pessoa_id: string;
  campanha_id?: string;
  canal: string;
  tipo: string;
  valor_estimado?: number;
}) {
  const ano = new Date().getFullYear();
  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });
  const numero = (count || 0) + 252;
  const codigo = `LEAD-${ano}-${numero}`;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...dados,
      numero,
      codigo,
      status: "aguardando",
      fase_canvas: "entrando",
      sala_atual: "main_entrance",
      score_prioridade: 50,
      sla_target_min: 5,
      tempo_aguardando_min: 0,
      ia_status: "ativa",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function atualizarFaseLead(leadId: string, fase: string, sala: string) {
  const { data, error } = await supabase
    .from("leads")
    .update({ fase_canvas: fase, sala_atual: sala, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function identificarOuCriarLead(dados: {
  telefone?: string;
  whatsapp_id?: string;
  nome: string;
  canal: string;
  tipo: string;
  campanha_id?: string;
}) {
  let pessoa: Pessoa | null = null;
  if (dados.whatsapp_id) pessoa = await encontrarPessoaPorWhatsapp(dados.whatsapp_id);
  if (!pessoa && dados.telefone) pessoa = await encontrarPessoaPorTelefone(dados.telefone);
  if (!pessoa) {
    pessoa = await criarPessoa({
      nome: dados.nome,
      telefone: dados.telefone,
      whatsapp_id: dados.whatsapp_id,
      tipo: "lead",
    });
  }

  const { data: leadExistente } = await supabase
    .from("leads")
    .select("*")
    .eq("pessoa_id", pessoa.id)
    .not("status", "in", '("perdido","frio")')
    .single();

  if (leadExistente) return { lead: leadExistente as Lead, pessoa, isNew: false };

  const lead = await criarLead({
    pessoa_id: pessoa.id,
    campanha_id: dados.campanha_id,
    canal: dados.canal,
    tipo: dados.tipo,
  });
  return { lead, pessoa, isNew: true };
}

// NEGÓCIOS
export async function criarNegocio(dados: {
  pessoa_id: string;
  lead_id: string;
  campanha_id?: string;
  mercado: string;
  valor_estimado?: number;
}) {
  const ano = new Date().getFullYear();
  const anoShort = String(ano).slice(-2);
  const { count } = await supabase
    .from("negocios")
    .select("*", { count: "exact", head: true })
    .eq("mercado", dados.mercado);
  const seq = String((count || 0) + 1).padStart(3, "0");
  const codigo = `${dados.mercado}${anoShort}${seq}`;
  const codigoDisplay = `NEG-${dados.mercado}-${ano}-${seq}`;

  const { data, error } = await supabase
    .from("negocios")
    .insert({ ...dados, codigo, codigo_display: codigoDisplay, status: "triagem" })
    .select()
    .single();
  if (error) throw error;
  return data as Negocio;
}

export async function buscarNegociosAtivos() {
  const { data } = await supabase
    .from("negocios")
    .select(`*, pessoa:pessoas(nome), oportunidades:oportunidades(*)`)
    .not("status", "in", '("ganho","perdido")')
    .order("created_at", { ascending: false });
  return data || [];
}

// MENSAGENS
export async function salvarMensagem(dados: {
  conversa_id: string;
  lead_id: string;
  de: "lead" | "agente_ia" | "humano" | "sistema";
  texto?: string;
  agente_id?: string;
  whatsapp_message_id?: string;
  canal?: "whatsapp" | "interno";
}) {
  const { data, error } = await supabase
    .from("mensagens")
    .insert({ ...dados, lida: dados.de !== "lead", canal: dados.canal || "interno" })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("leads")
    .update({
      ultima_mensagem: dados.texto,
      ultima_mensagem_de: dados.de,
      ultima_mensagem_at: new Date().toISOString(),
    })
    .eq("id", dados.lead_id);

  return data;
}

export async function buscarHistoricoConversa(conversaId: string) {
  const { data } = await supabase
    .from("mensagens")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });
  return data || [];
}

// DECISÕES
export async function buscarDecisoesAbertas() {
  const { data } = await supabase
    .from("decisoes")
    .select("*")
    .eq("resolvido", false)
    .order("prioridade", { ascending: false });
  return (data || []) as Decisao[];
}

export async function resolverDecisao(
  decisaoId: string,
  usuario: string,
  acao: string,
  motivo?: string
) {
  await supabase
    .from("decision_logs")
    .insert({ decisao_id: decisaoId, acao, usuario, motivo });

  const { data, error } = await supabase
    .from("decisoes")
    .update({ resolvido: true, resolvido_por: usuario, resolvido_at: new Date().toISOString() })
    .eq("id", decisaoId)
    .select()
    .single();
  if (error) throw error;
  return data as Decisao;
}

// PARCEIROS
export async function buscarParceirosDisponiveis(categoria?: string, regiao?: string) {
  let query = supabase
    .from("parceiros")
    .select(`*, pessoa:pessoas(nome, telefone)`)
    .eq("status", "ativo");
  if (categoria) query = query.eq("categoria", categoria);
  if (regiao) query = query.ilike("regiao", `%${regiao}%`);
  const { data } = await query.order("fit_score", { ascending: false });
  return data || [];
}

// REALTIME
export function subscribeToLeads(callback: (lead: unknown) => void) {
  return supabase
    .channel("leads-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, callback)
    .subscribe();
}

export function subscribeToMensagens(conversaId: string, callback: (msg: unknown) => void) {
  return supabase
    .channel(`mensagens-${conversaId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "mensagens",
      filter: `conversa_id=eq.${conversaId}`,
    }, callback)
    .subscribe();
}

export function subscribeToDecisoes(callback: (decisao: unknown) => void) {
  return supabase
    .channel("decisoes-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "decisoes" }, callback)
    .subscribe();
}

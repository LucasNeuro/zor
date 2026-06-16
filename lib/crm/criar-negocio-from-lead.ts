import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarCodigoNegocio } from "@/lib/crm/negocio-cadastro";
import { resolverServicoCatalogoParaNegocio, type ServicoCatalogoRow } from "@/lib/crm/servicos-catalogo";

export type CriarNegocioLeadParams = {
  tenantId: string;
  leadId: string;
  servicoCatalogoId?: string | null;
  servicoNome?: string | null;
  titulo?: string | null;
  valorEstimado?: number | null;
  etapa?: string;
  status?: string;
  dataPrevisaoFechamento?: string | null;
  dataEntrada?: string | null;
  dataEntrega?: string | null;
  pipelineId?: string | null;
  origem?: string;
};

export type CriarNegocioLeadResult =
  | { ok: true; negocioId: string; titulo: string; valor: number | null; servico: ServicoCatalogoRow | null }
  | { ok: false; erro: string };

async function resolverServicoPorNome(
  supabase: SupabaseClient,
  tenantId: string,
  nome: string
): Promise<ServicoCatalogoRow | null> {
  const termo = nome.trim().toLowerCase();
  if (!termo) return null;
  const { data } = await supabase
    .from("hub_tenant_servicos_catalogo")
    .select(
      "id, tenant_id, slug, nome, descricao, preco_referencia, moeda, tipo, origem, ativo, ordem"
    )
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .ilike("nome", `%${termo.slice(0, 60)}%`)
    .limit(5);
  const rows = (data ?? []) as ServicoCatalogoRow[];
  if (!rows.length) return null;
  const exact = rows.find((r) => r.nome.trim().toLowerCase() === termo);
  return exact ?? rows[0];
}

export async function criarNegocioParaLead(
  supabase: SupabaseClient,
  params: CriarNegocioLeadParams
): Promise<CriarNegocioLeadResult> {
  const leadId = params.leadId.trim();
  if (!leadId) return { ok: false, erro: "lead_id_obrigatorio" };

  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, tenant_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead?.id) return { ok: false, erro: "lead_nao_encontrado" };

  let servico: ServicoCatalogoRow | null = null;
  if (params.servicoCatalogoId) {
    servico = await resolverServicoCatalogoParaNegocio(
      supabase,
      params.tenantId,
      params.servicoCatalogoId
    );
    if (!servico) return { ok: false, erro: "servico_catalogo_nao_encontrado" };
  } else if (params.servicoNome?.trim()) {
    servico = await resolverServicoPorNome(supabase, params.tenantId, params.servicoNome);
  }

  const leadNome = typeof lead.nome === "string" ? lead.nome.trim() : "Cliente";
  const titulo =
    params.titulo?.trim() ||
    (servico ? `${servico.nome} — ${leadNome}` : `Negócio — ${leadNome}`);
  const valor =
    params.valorEstimado ??
    (servico?.preco_referencia != null ? Number(servico.preco_referencia) : null);

  const codigo = await gerarCodigoNegocio(supabase);
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    codigo,
    titulo,
    tipo: "produto_servico",
    prefixo_mercado: "GRL",
    servico_catalogo_id: servico?.id ?? null,
    etapa: params.etapa ?? "proposta",
    status: params.status ?? "aberto",
    valor_estimado: valor,
    data_previsao_fechamento: params.dataPrevisaoFechamento ?? params.dataEntrega ?? null,
    data_entrada: params.dataEntrada ?? null,
    data_entrega: params.dataEntrega ?? params.dataPrevisaoFechamento ?? null,
    lead_id: leadId,
    pipeline_id: params.pipelineId ?? null,
    criado_em: now,
    atualizado_em: now,
    metadata: {
      origem: params.origem ?? "ia_conversa",
      criado_via: params.origem ?? "ia_conversa",
    },
  };

  const variants: Record<string, unknown>[] = [
    { ...row, tenant_id: params.tenantId },
    { ...row },
  ];

  let created: { id: string } | null = null;
  let lastErr = "";

  for (const payload of variants) {
    const { data, error } = await supabase
      .from("hub_negocios")
      .insert(payload)
      .select("id, titulo, valor_estimado")
      .single();
    if (!error && data?.id) {
      created = data as { id: string };
      break;
    }
    lastErr = error?.message ?? "erro_insert";
    if (!error?.message?.includes("tenant_id") && !error?.message?.includes("servico_catalogo")) {
      break;
    }
    if (error?.message?.includes("servico_catalogo")) {
      delete payload.servico_catalogo_id;
    }
  }

  if (!created?.id) {
    return { ok: false, erro: lastErr || "falha_criar_negocio" };
  }

  await supabase.from("hub_atividades").insert({
    lead_id: leadId,
    tipo: "negocio",
    descricao: `Negócio criado: ${titulo}${valor != null ? ` (R$ ${valor})` : ""}`,
    feito_por: "ia",
    feito_por_tipo: "ia",
    metadata: {
      negocio_id: created.id,
      servico_catalogo_id: servico?.id ?? null,
      origem: params.origem ?? "ia_conversa",
    },
  });

  if (valor != null && valor > 0) {
    await supabase
      .from("hub_leads_crm")
      .update({
        valor_estimado: valor,
        estagio: "proposta",
        atualizado_em: now,
      })
      .eq("id", leadId);
  }

  return {
    ok: true,
    negocioId: created.id,
    titulo,
    valor,
    servico,
  };
}

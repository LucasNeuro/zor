/**
 * Operações CRM/financeiro para agentes internos — CRUD controlado por entidade (sem SQL livre).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { criarNegocioParaLead } from "@/lib/crm/criar-negocio-from-lead";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";
import { listarEstagiosPipelineParaIa } from "@/lib/crm/pipeline-estagios-ia";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  executarHubDadosEmpresa,
  listarViewsHubDadosEmpresa,
  type HubDadosEmpresaArgs,
} from "@/lib/hub/hub-dados-empresa";

export type OperacaoEmpresaAcao = "consultar" | "obter" | "criar" | "atualizar" | "nota" | "listar_entidades";

export type OperacaoEmpresaEntidade =
  | "lead"
  | "negocio"
  | "pessoa"
  | "empresa"
  | "nota"
  | "conta_receber"
  | "conta_pagar"
  | "atividade"
  | "aprovacao"
  | "alerta"
  | "conversa"
  | "servico_catalogo"
  | "parceiro"
  | "servico"
  | "proposta"
  | "kpi_meta"
  | "kpi_resultado";

type EntidadeConfig = {
  tabela: string;
  view?: string;
  label: string;
  camposLeitura: string[];
  camposCriar?: string[];
  camposAtualizar?: string[];
  statusArquivar?: string;
};

const ENTIDADES: Record<OperacaoEmpresaEntidade, EntidadeConfig> = {
  lead: {
    tabela: "hub_leads_crm",
    view: "vw_rel_leads_enriquecidos",
    label: "Lead CRM",
    camposLeitura: [
      "id",
      "nome",
      "telefone",
      "email",
      "estagio",
      "estagio_funil",
      "score",
      "valor_estimado",
      "interesse_principal",
      "agente_responsavel",
      "humano_responsavel",
      "origem",
      "pessoa_id",
      "criado_em",
      "atualizado_em",
    ],
    camposCriar: ["nome", "telefone", "email", "estagio", "valor_estimado", "interesse_principal", "origem", "tags"],
    camposAtualizar: [
      "nome",
      "telefone",
      "email",
      "estagio",
      "score",
      "valor_estimado",
      "interesse_principal",
      "agente_responsavel",
      "humano_responsavel",
      "tags",
      "metadata",
    ],
    statusArquivar: "spam_invalido",
  },
  negocio: {
    tabela: "hub_negocios",
    view: "vw_rel_negocios_pipeline",
    label: "Negócio",
    camposLeitura: [
      "id",
      "titulo",
      "status",
      "etapa",
      "valor_estimado",
      "valor_fechado",
      "lead_id",
      "pessoa_id",
      "criado_em",
      "atualizado_em",
    ],
    camposCriar: ["titulo", "lead_id", "valor_estimado", "descricao", "etapa", "status"],
    camposAtualizar: ["titulo", "status", "etapa", "valor_estimado", "valor_fechado", "descricao"],
    statusArquivar: "cancelado",
  },
  pessoa: {
    tabela: "hub_pessoas",
    view: "vw_rel_pessoas_cadastro",
    label: "Pessoa",
    camposLeitura: ["id", "codigo", "nome", "telefone", "email", "origem", "cidade", "estado", "criado_em"],
    camposCriar: ["nome", "telefone", "email", "origem", "cidade", "estado"],
    camposAtualizar: ["nome", "telefone", "email", "origem", "cidade", "estado", "tags"],
  },
  empresa: {
    tabela: "hub_empresas",
    label: "Empresa",
    camposLeitura: ["id", "codigo", "nome", "cnpj", "email", "telefone", "cidade", "estado", "ativo", "criado_em"],
    camposCriar: ["nome", "cnpj", "email", "telefone", "cidade", "estado"],
    camposAtualizar: ["nome", "cnpj", "email", "telefone", "cidade", "estado", "ativo"],
  },
  nota: {
    tabela: "hub_notas",
    view: "vw_rel_notas_crm",
    label: "Nota CRM",
    camposLeitura: ["id", "lead_id", "negocio_id", "conteudo", "criado_por", "criado_em"],
    camposCriar: ["conteudo", "lead_id", "negocio_id"],
  },
  conta_receber: {
    tabela: "hub_contas_receber",
    view: "vw_rel_contas_receber",
    label: "Conta a receber",
    camposLeitura: ["id", "descricao", "valor", "vencimento", "status", "negocio_id", "criado_em"],
    camposCriar: ["descricao", "valor", "vencimento", "status", "negocio_id"],
    camposAtualizar: ["descricao", "valor", "vencimento", "status"],
    statusArquivar: "cancelado",
  },
  conta_pagar: {
    tabela: "hub_contas_pagar",
    view: "vw_rel_contas_pagar",
    label: "Conta a pagar",
    camposLeitura: ["id", "descricao", "valor", "vencimento", "status", "criado_em"],
    camposCriar: ["descricao", "valor", "vencimento", "status"],
    camposAtualizar: ["descricao", "valor", "vencimento", "status"],
    statusArquivar: "cancelado",
  },
  atividade: {
    tabela: "hub_atividades",
    view: "vw_rel_atividades_timeline",
    label: "Atividade / timeline",
    camposLeitura: ["id", "lead_id", "negocio_id", "tipo", "descricao", "feito_por", "criado_em"],
    camposCriar: ["lead_id", "negocio_id", "tipo", "descricao"],
  },
  aprovacao: {
    tabela: "hub_aprovacoes",
    view: "vw_rel_aprovacoes",
    label: "Aprovação",
    camposLeitura: ["id", "titulo", "status", "tipo", "criado_em"],
    camposAtualizar: ["status", "observacao"],
  },
  alerta: {
    tabela: "hub_alertas",
    view: "vw_rel_alertas_operacao",
    label: "Alerta operação",
    camposLeitura: ["id", "titulo", "severidade", "status", "criado_em"],
    camposAtualizar: ["status"],
    statusArquivar: "resolvido",
  },
  conversa: {
    tabela: "hub_conversas",
    label: "Conversa",
    camposLeitura: [
      "id",
      "lead_id",
      "canal",
      "status",
      "ia_ativa",
      "total_mensagens",
      "ultima_mensagem_em",
      "criado_em",
    ],
    camposAtualizar: ["status", "ia_ativa", "ia_pausada_motivo"],
  },
  servico_catalogo: {
    tabela: "hub_tenant_servicos_catalogo",
    label: "Catálogo de serviços",
    camposLeitura: ["id", "slug", "nome", "descricao", "preco_referencia", "tipo", "ativo", "criado_em"],
    camposCriar: ["slug", "nome", "descricao", "preco_referencia", "tipo", "ativo"],
    camposAtualizar: ["nome", "descricao", "preco_referencia", "tipo", "ativo"],
  },
  parceiro: {
    tabela: "hub_parceiros",
    label: "Parceiro",
    camposLeitura: ["id", "codigo", "especialidade", "status_homologacao", "disponivel", "criado_em"],
    camposAtualizar: ["disponivel", "status_homologacao"],
  },
  servico: {
    tabela: "hub_servicos",
    label: "Serviço catálogo",
    camposLeitura: ["id", "nome", "descricao", "categoria", "ativo", "criado_em"],
    camposCriar: ["nome", "descricao", "categoria", "faixa_preco_min", "faixa_preco_max", "ativo"],
    camposAtualizar: ["nome", "descricao", "categoria", "ativo", "faixa_preco_min", "faixa_preco_max"],
  },
  proposta: {
    tabela: "hub_propostas",
    label: "Proposta",
    camposLeitura: ["id", "titulo", "valor", "status", "lead_id", "negocio_id", "criado_em"],
    camposCriar: ["titulo", "valor", "lead_id", "negocio_id", "servico_id", "escopo", "status"],
    camposAtualizar: ["titulo", "valor", "status", "escopo"],
    statusArquivar: "recusada",
  },
  kpi_meta: {
    tabela: "hub_kpis_metas",
    view: "vw_rel_kpis_metas",
    label: "Meta KPI",
    camposLeitura: ["id", "nome", "valor_meta", "periodo", "criado_em"],
    camposCriar: ["nome", "valor_meta", "periodo"],
    camposAtualizar: ["nome", "valor_meta", "periodo"],
  },
  kpi_resultado: {
    tabela: "hub_kpis_resultados",
    view: "vw_rel_kpis_resultados",
    label: "Resultado KPI",
    camposLeitura: ["id", "nome", "valor", "periodo", "criado_em"],
    camposCriar: ["nome", "valor", "periodo"],
    camposAtualizar: ["nome", "valor", "periodo"],
  },
};

function pickAllowed(
  dados: Record<string, unknown>,
  allowed: string[] | undefined
): Record<string, unknown> {
  if (!allowed?.length) return {};
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in dados && dados[k] !== undefined) out[k] = dados[k];
  }
  return out;
}

async function auditar(
  supabase: SupabaseClient,
  ctx: { agenteSlug: string; tenantId: string },
  tipo: string,
  descricao: string,
  metadata: Record<string, unknown>
) {
  try {
    await supabase.from("hub_acoes_ia").insert({
      agente_slug: ctx.agenteSlug,
      tenant_id: ctx.tenantId,
      tipo,
      descricao: descricao.slice(0, 500),
      metadata,
    });
  } catch {
    /* opcional */
  }
}

export function listarEntidadesOperacaoEmpresa(): Array<{
  id: OperacaoEmpresaEntidade;
  label: string;
  view?: string;
  pode_criar: boolean;
  pode_atualizar: boolean;
}> {
  return (Object.keys(ENTIDADES) as OperacaoEmpresaEntidade[]).map((id) => {
    const c = ENTIDADES[id];
    return {
      id,
      label: c.label,
      view: c.view,
      pode_criar: Boolean(c.camposCriar?.length),
      pode_atualizar: Boolean(c.camposAtualizar?.length),
    };
  });
}

export const HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT = listarEntidadesOperacaoEmpresa()
  .map((e) => `- ${e.id}: ${e.label}${e.view ? ` (view ${e.view})` : ""}`)
  .join("\n");

export type HubOperacaoEmpresaArgs = {
  acao: string;
  entidade?: string;
  id?: string;
  dados?: Record<string, unknown>;
  view?: string;
  colunas?: string[];
  limite?: number;
  filtro_texto?: string;
  filtro_coluna?: string;
  arquivar?: boolean;
};

export async function executarHubOperacaoEmpresa(
  supabase: SupabaseClient,
  tenantId: string,
  args: HubOperacaoEmpresaArgs,
  ctx: { agenteSlug: string }
): Promise<string> {
  const tenant = tenantId?.trim() || defaultTenantId();
  const acao = String(args.acao || "").trim().toLowerCase() as OperacaoEmpresaAcao;

  if (acao === "listar_entidades") {
    return JSON.stringify({
      ok: true,
      entidades: listarEntidadesOperacaoEmpresa(),
      views_relatorio: listarViewsHubDadosEmpresa().slice(0, 20),
    });
  }

  if (acao === "consultar") {
    const entView =
      args.entidade && ENTIDADES[args.entidade as OperacaoEmpresaEntidade]?.view;
    const hubArgs: HubDadosEmpresaArgs = {
      view: args.view || entView || "",
      colunas: args.colunas,
      limite: args.limite,
      filtro_texto: args.filtro_texto,
      filtro_coluna: args.filtro_coluna,
    };
    return executarHubDadosEmpresa(supabase, tenant, hubArgs, ctx);
  }

  const entRaw = String(args.entidade || "").trim().toLowerCase();
  if (!entRaw || !(entRaw in ENTIDADES)) {
    return JSON.stringify({
      erro: "entidade_invalida",
      entidades: Object.keys(ENTIDADES),
    });
  }
  const entidade = entRaw as OperacaoEmpresaEntidade;
  const cfg = ENTIDADES[entidade];
  const recordId = typeof args.id === "string" ? args.id.trim() : "";

  if (acao === "obter") {
    if (!recordId) {
      return JSON.stringify({ erro: "id_obrigatorio", entidade });
    }
    const { data, error } = await supabase
      .from(cfg.tabela)
      .select(cfg.camposLeitura.join(", "))
      .eq("id", recordId)
      .eq("tenant_id", tenant)
      .maybeSingle();
    if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
    if (!data) return JSON.stringify({ erro: "nao_encontrado", entidade, id: recordId });
    return JSON.stringify({ ok: true, entidade, registo: data });
  }

  const dadosIn =
    args.dados && typeof args.dados === "object" && !Array.isArray(args.dados)
      ? (args.dados as Record<string, unknown>)
      : {};

  if (acao === "criar") {
    if (entidade === "negocio" && dadosIn.lead_id) {
      const leadId = String(dadosIn.lead_id);
      const titulo = String(dadosIn.titulo || "Negócio").trim();
      const valor =
        typeof dadosIn.valor_estimado === "number"
          ? dadosIn.valor_estimado
          : Number(dadosIn.valor_estimado) || 0;
      const result = await criarNegocioParaLead(supabase, {
        leadId,
        titulo,
        valorEstimado: valor,
        tenantId: tenant,
        origem: "agente_interno",
      });
      if (!result.ok) {
        return JSON.stringify({ erro: result.erro || "criar_negocio_falhou" });
      }
      await auditar(
        supabase,
        { agenteSlug: ctx.agenteSlug, tenantId: tenant },
        "hub_operacao_empresa",
        `Criou negócio ${result.negocioId}`,
        { acao: "criar", entidade: "negocio", id: result.negocioId }
      );
      return JSON.stringify({ ok: true, entidade: "negocio", id: result.negocioId, titulo: result.titulo });
    }

    if (!cfg.camposCriar?.length) {
      return JSON.stringify({ erro: "criar_nao_permitido", entidade });
    }

    const payload = pickAllowed(dadosIn, cfg.camposCriar);
    if (entidade === "nota" || entidade === "atividade") {
      const texto = String(payload.conteudo ?? payload.descricao ?? "").trim();
      if (!texto) return JSON.stringify({ erro: "conteudo_obrigatorio" });
      if (entidade === "nota") {
        const { data, error } = await supabase
          .from("hub_notas")
          .insert({
            conteudo: texto.slice(0, 8000),
            lead_id: payload.lead_id ?? null,
            negocio_id: payload.negocio_id ?? null,
            criado_por: ctx.agenteSlug,
            tenant_id: tenant,
          })
          .select("id")
          .single();
        if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
        return JSON.stringify({ ok: true, entidade: "nota", id: data?.id });
      }
      const { data, error } = await supabase
        .from("hub_atividades")
        .insert({
          lead_id: payload.lead_id ?? null,
          negocio_id: payload.negocio_id ?? null,
          tipo: String(payload.tipo || "nota").slice(0, 40),
          descricao: texto.slice(0, 8000),
          feito_por: ctx.agenteSlug,
          feito_por_tipo: "ia",
          tenant_id: tenant,
        })
        .select("id")
        .single();
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
      return JSON.stringify({ ok: true, entidade: "atividade", id: data?.id });
    }

    if (Object.keys(payload).length === 0) {
      return JSON.stringify({ erro: "dados_vazios", campos_permitidos: cfg.camposCriar });
    }

    payload.tenant_id = tenant;
    if (entidade === "lead" && !payload.estagio) payload.estagio = "novo";

    const { data, error } = await supabase.from(cfg.tabela).insert(payload).select("id").single();
    if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });

    await auditar(
      supabase,
      { agenteSlug: ctx.agenteSlug, tenantId: tenant },
      "hub_operacao_empresa",
      `Criou ${entidade} ${data?.id}`,
      { acao: "criar", entidade, id: data?.id }
    );

    return JSON.stringify({ ok: true, entidade, id: data?.id });
  }

  if (acao === "atualizar") {
    if (!recordId) return JSON.stringify({ erro: "id_obrigatorio", entidade });

    if (entidade === "lead") {
      const { data: leadAtual, error: errLead } = await supabase
        .from("hub_leads_crm")
        .select(
          "id, pessoa_id, estagio, score, valor_estimado, tags, metadata, preferencias, nome, telefone, email, interesse_principal"
        )
        .eq("id", recordId)
        .eq("tenant_id", tenant)
        .maybeSingle();
      if (errLead) return JSON.stringify({ erro: "supabase", detalhe: errLead.message });
      if (!leadAtual) return JSON.stringify({ erro: "nao_encontrado", id: recordId });

      let estagiosPipeline: { slug: string; tipo_fecho: string }[] = [];
      try {
        const refs = await listarEstagiosPipelineParaIa(supabase, tenant, "lead");
        estagiosPipeline = refs.map((e) => ({ slug: e.slug, tipo_fecho: e.tipo_fecho }));
      } catch {
        /* fallback */
      }

      const mergeArgs = { ...dadosIn };
      if (args.arquivar && cfg.statusArquivar) mergeArgs.estagio = cfg.statusArquivar;

      const built = buildHubLeadsCrmPatch(mergeArgs, leadAtual as Record<string, unknown>, {
        estagiosPipeline,
      });
      if (!built.ok) {
        return JSON.stringify({ erro: built.codigo ?? built.erro, detalhe: built.erro });
      }

      const { error } = await supabase
        .from("hub_leads_crm")
        .update(built.patch)
        .eq("id", recordId)
        .eq("tenant_id", tenant);
      if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });

      const pessoaId =
        leadAtual.pessoa_id != null && String(leadAtual.pessoa_id).trim()
          ? String(leadAtual.pessoa_id).trim()
          : null;
      if (pessoaId && (built.patch.telefone || built.patch.email)) {
        const pessoaPatch: Record<string, unknown> = {};
        if (typeof built.patch.telefone === "string") pessoaPatch.telefone = built.patch.telefone;
        if (typeof built.patch.email === "string") pessoaPatch.email = built.patch.email;
        await supabase.from("hub_pessoas").update(pessoaPatch).eq("id", pessoaId);
      }

      await auditar(
        supabase,
        { agenteSlug: ctx.agenteSlug, tenantId: tenant },
        "hub_operacao_empresa",
        `Actualizou lead ${recordId}`,
        { acao: args.arquivar ? "arquivar" : "atualizar", entidade: "lead", id: recordId, patch: built.patch }
      );

      return JSON.stringify({ ok: true, entidade: "lead", id: recordId, alteracoes: built.patch });
    }

    if (!cfg.camposAtualizar?.length && !args.arquivar) {
      return JSON.stringify({ erro: "atualizar_nao_permitido", entidade });
    }

    const patch = pickAllowed(dadosIn, cfg.camposAtualizar);
    if (args.arquivar && cfg.statusArquivar) {
      patch.status = cfg.statusArquivar;
    }
    if (Object.keys(patch).length === 0) {
      return JSON.stringify({ erro: "dados_vazios", campos_permitidos: cfg.camposAtualizar });
    }

    const { data, error } = await supabase
      .from(cfg.tabela)
      .update(patch)
      .eq("id", recordId)
      .eq("tenant_id", tenant)
      .select("id")
      .maybeSingle();

    if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
    if (!data) return JSON.stringify({ erro: "nao_encontrado", id: recordId });

    await auditar(
      supabase,
      { agenteSlug: ctx.agenteSlug, tenantId: tenant },
      "hub_operacao_empresa",
      `Actualizou ${entidade} ${recordId}`,
      { acao: args.arquivar ? "arquivar" : "atualizar", entidade, id: recordId, patch }
    );

    return JSON.stringify({ ok: true, entidade, id: recordId, alteracoes: patch });
  }

  if (acao === "nota") {
    const texto = String(dadosIn.conteudo ?? dadosIn.texto ?? "").trim();
    if (!texto) return JSON.stringify({ erro: "conteudo_obrigatorio" });
    const leadId = dadosIn.lead_id ? String(dadosIn.lead_id) : null;
    const negocioId = dadosIn.negocio_id ? String(dadosIn.negocio_id) : null;
    if (!leadId && !negocioId) {
      return JSON.stringify({ erro: "lead_id_ou_negocio_id_obrigatorio" });
    }
    const { data, error } = await supabase
      .from("hub_notas")
      .insert({
        conteudo: texto.slice(0, 8000),
        lead_id: leadId,
        negocio_id: negocioId,
        criado_por: ctx.agenteSlug,
        tenant_id: tenant,
      })
      .select("id")
      .single();
    if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
    return JSON.stringify({ ok: true, entidade: "nota", id: data?.id });
  }

  return JSON.stringify({
    erro: "acao_invalida",
    acoes: ["listar_entidades", "consultar", "obter", "criar", "atualizar", "nota"],
  });
}

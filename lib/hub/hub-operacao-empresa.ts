/**
 * Operações CRM/financeiro para agentes internos — CRUD controlado por entidade (sem SQL livre).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { criarNegocioParaLead } from "@/lib/crm/criar-negocio-from-lead";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";
import {
  OPERACAO_ENTIDADES_CONFIG,
  type OperacaoEntidadeSlug,
} from "@/lib/hub/hub-operacao-entidades-operacionais";
import { listarEstagiosPipelineParaIa } from "@/lib/crm/pipeline-estagios-ia";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  executarHubDadosEmpresa,
  listarViewsHubDadosEmpresa,
  type HubDadosEmpresaArgs,
} from "@/lib/hub/hub-dados-empresa";

export type OperacaoEmpresaAcao = "consultar" | "obter" | "criar" | "atualizar" | "nota" | "listar_entidades";

export type OperacaoEmpresaEntidade = OperacaoEntidadeSlug;

type EntidadeConfig = (typeof OPERACAO_ENTIDADES_CONFIG)[OperacaoEntidadeSlug];

const ENTIDADES = OPERACAO_ENTIDADES_CONFIG;

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

const CAMPOS_BUSCA_CONSULTAR = [
  "nome",
  "titulo",
  "descricao",
  "email",
  "telefone",
  "conteudo",
  "codigo",
  "slug",
] as const;

function escaparIlike(texto: string): string {
  return texto.replace(/[%_]/g, " ").trim();
}

function camposBuscaEntidade(camposLeitura: string[]): string[] {
  return CAMPOS_BUSCA_CONSULTAR.filter((c) => camposLeitura.includes(c));
}

const FILTROS_RELACAO_CONSULTA: Array<{
  arg: "filtro_lead_id" | "filtro_negocio_id" | "filtro_pessoa_id";
  coluna: string;
}> = [
  { arg: "filtro_lead_id", coluna: "lead_id" },
  { arg: "filtro_negocio_id", coluna: "negocio_id" },
  { arg: "filtro_pessoa_id", coluna: "pessoa_id" },
];

/** Lista registos na tabela CRM real (hub_*) — paridade com a interface, não só views vw_rel_*. */
async function consultarEntidadeNaTabela(
  supabase: SupabaseClient,
  tenant: string,
  entidade: OperacaoEmpresaEntidade,
  cfg: EntidadeConfig,
  args: HubOperacaoEmpresaArgs,
  ctx: { agenteSlug: string }
): Promise<string> {
  const limite = Math.min(Math.max(Number(args.limite) || 25, 1), 50);
  const colunasPedidas = Array.isArray(args.colunas)
    ? args.colunas.map((c) => String(c).trim()).filter((c) => cfg.camposLeitura.includes(c))
    : [];
  const selectCols = colunasPedidas.length ? colunasPedidas : cfg.camposLeitura;

  let query = supabase
    .from(cfg.tabela)
    .select(selectCols.join(", "))
    .eq("tenant_id", tenant)
    .limit(limite);

  const filtroTexto = String(args.filtro_texto || "").trim();
  const filtroColuna = String(args.filtro_coluna || "").trim();
  const filtrosAplicados: string[] = [];

  for (const { arg, coluna } of FILTROS_RELACAO_CONSULTA) {
    const val = String(args[arg] || "").trim();
    if (!val) continue;
    if (!cfg.camposLeitura.includes(coluna)) continue;
    query = query.eq(coluna, val);
    filtrosAplicados.push(`${coluna}=${val}`);
  }

  if (filtroTexto) {
    const safe = escaparIlike(filtroTexto);
    if (filtroColuna && cfg.camposLeitura.includes(filtroColuna)) {
      query = query.ilike(filtroColuna, `%${safe}%`);
    } else {
      const busca = camposBuscaEntidade(cfg.camposLeitura);
      if (busca.length === 1) {
        query = query.ilike(busca[0], `%${safe}%`);
      } else if (busca.length > 1) {
        const orExpr = busca.map((f) => `${f}.ilike.%${safe}%`).join(",");
        query = query.or(orExpr);
      }
    }
  }

  if (cfg.camposLeitura.includes("criado_em")) {
    query = query.order("criado_em", { ascending: false });
  } else if (cfg.camposLeitura.includes("id")) {
    query = query.order("id", { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    return JSON.stringify({ erro: "supabase", detalhe: error.message, entidade, tabela: cfg.tabela });
  }

  const linhas = data ?? [];
  await auditar(
    supabase,
    { agenteSlug: ctx.agenteSlug, tenantId: tenant },
    "hub_operacao_empresa",
    `Consultou ${entidade} (${linhas.length} reg.)`,
    { acao: "consultar", entidade, tabela: cfg.tabela, total: linhas.length }
  );

  return JSON.stringify({
    ok: true,
    entidade,
    tabela: cfg.tabela,
    fonte: "tabela_crm",
    total: linhas.length,
    filtros_relacao: filtrosAplicados.length ? filtrosAplicados : undefined,
    registos: linhas,
  });
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
  /** UUID do lead — use em negócio, nota, atividade, conversa, etc. */
  filtro_lead_id?: string;
  /** UUID do negócio — use em nota, atividade, conta_receber, proposta, etc. */
  filtro_negocio_id?: string;
  /** UUID da pessoa — quando a entidade tem pessoa_id */
  filtro_pessoa_id?: string;
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
    const entRaw = String(args.entidade || "").trim().toLowerCase();
    const viewExplicita = String(args.view || "").trim();

    // Superagente interno: listar na tabela hub_* (como a UI). Views só se view=vw_rel_* explícita.
    if (entRaw && entRaw in ENTIDADES && !viewExplicita.startsWith("vw_rel_")) {
      const entidade = entRaw as OperacaoEmpresaEntidade;
      return consultarEntidadeNaTabela(
        supabase,
        tenant,
        entidade,
        ENTIDADES[entidade],
        args,
        ctx
      );
    }

    const entView =
      args.entidade && ENTIDADES[args.entidade as OperacaoEmpresaEntidade]?.view;
    const hubArgs: HubDadosEmpresaArgs = {
      view: viewExplicita || entView || "",
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
      const etapa = typeof dadosIn.etapa === "string" ? dadosIn.etapa.trim() : undefined;
      const servicoNome =
        typeof dadosIn.servico_nome === "string"
          ? dadosIn.servico_nome.trim()
          : typeof dadosIn.produto === "string"
            ? dadosIn.produto.trim()
            : undefined;
      const servicoCatalogoId =
        typeof dadosIn.servico_catalogo_id === "string" ? dadosIn.servico_catalogo_id.trim() : undefined;
      const result = await criarNegocioParaLead(supabase, {
        leadId,
        titulo,
        valorEstimado: valor,
        tenantId: tenant,
        origem: "agente_interno",
        etapa: etapa || "novo",
        servicoNome,
        servicoCatalogoId,
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

    if (
      (entidade === "aprovacao" || entidade === "alerta" || entidade === "script_ia") &&
      !payload.agente_slug
    ) {
      payload.agente_slug = ctx.agenteSlug;
    }

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

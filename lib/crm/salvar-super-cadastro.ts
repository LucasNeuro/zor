import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenCnpjApiResponse } from "@/lib/crm/opencnpj";
import type { SuperCadastroValidado } from "@/lib/crm/validar-super-cadastro";
import {
  dadosExtrasEndereco,
  montarRowInsertHubPessoa,
  type HubPessoaRow,
} from "@/lib/crm/hub-pessoas-compat";
import { buscarPessoaPorDocumento } from "@/lib/crm/buscar-pessoa-documento";
import {
  gerarCodigoPessoa,
  normalizarTelefone,
  type PessoaCadastroPayload,
} from "@/lib/crm/pessoa-cadastro";
import {
  gerarCodigoEmpresa,
  type EmpresaCadastroPayload,
} from "@/lib/crm/empresa-cadastro";
import type { PrefixoMercado } from "@/lib/crm/negocio-cadastro";
import { AREA_ATUACAO_OUTRO_VALUE } from "@/lib/crm/areas-atuacao";
import { resolverTelefoneCadastro } from "@/lib/crm/cadastro-flexivel";
import { documentoCompleto } from "@/lib/crm/documento-brasil";
import { prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { isMissingPgColumn, isTenantFkError } from "@/lib/tenant-default";

export type SalvarSuperCadastroResult =
  | {
      ok: true;
      pessoa_id: string;
      empresa_id?: string;
      lead_id?: string;
      codigo_lead?: string;
      codigo_pessoa?: string;
      pessoa: HubPessoaRow;
      /** Contacto gravado, mas lead no funil falhou (ex.: migração LED pendente). */
      aviso?: string;
    }
  | { ok: false; status: number; error: string; detail?: string };

function resolverAreaAtuacao(data: SuperCadastroValidado): string | null {
  const sel = (data.area_atuacao || "").trim();
  const outro = (data.area_atuacao_outro || "").trim();
  if (sel === AREA_ATUACAO_OUTRO_VALUE) return outro.slice(0, 80) || null;
  return sel.slice(0, 80) || null;
}

function payloadParaPessoa(
  data: SuperCadastroValidado,
  opencnpj?: OpenCnpjApiResponse | null
): PessoaCadastroPayload & {
  mercados: string[];
  opencnpj?: OpenCnpjApiResponse | null;
  indicado_por?: string | null;
} {
  const area = resolverAreaAtuacao(data);
  const indicadoPor =
    data.comercial.lead_origem === "indicacao"
      ? (data.comercial.indicado_por || "").trim() || null
      : null;
  return {
    tipo_pessoa: data.tipo_pessoa,
    nome: data.nome,
    documento: data.documento ?? null,
    telefone: data.telefone,
    email: data.email,
    empresa: data.tipo_pessoa === "PJ" ? data.nome_fantasia ?? null : null,
    area_atuacao: area,
    cep: data.cep,
    logradouro: data.logradouro?.trim().slice(0, 200) || null,
    numero: data.numero?.trim().slice(0, 20) || null,
    complemento: data.complemento?.trim().slice(0, 80) || null,
    bairro: data.bairro?.trim().slice(0, 120) || null,
    cidade: data.cidade?.trim().slice(0, 120) || null,
    estado: data.estado,
    origem: data.comercial.lead_origem || "crm_manual",
    mercados: data.comercial.mercados,
    opencnpj: opencnpj ?? null,
    indicado_por: indicadoPor,
  };
}

export function montarDadosExtrasPessoa(
  p: PessoaCadastroPayload & {
    mercados?: string[];
    opencnpj?: OpenCnpjApiResponse | null;
    indicado_por?: string | null;
  }
): Record<string, unknown> {
  const base = dadosExtrasEndereco(p);
  const extras: Record<string, unknown> = { ...base };
  if (p.mercados?.length) extras.mercados = p.mercados;
  if (p.indicado_por) extras.indicado_por = p.indicado_por;
  if (p.opencnpj) {
    extras.opencnpj = {
      fonte: "opencnpj",
      consultado_em: new Date().toISOString(),
      ...p.opencnpj,
    };
  }
  return extras;
}

async function insertLead(
  supabase: SupabaseClient,
  params: {
    nome: string;
    telefone: string | null;
    email: string | null;
    pessoa_id: string;
    pessoa_codigo: string | null;
    tenant_id: string;
    mercados: string[];
    origem: string;
    indicado_por?: string | null;
  }
): Promise<{ id: string; codigo: string } | null> {
  const mercadoPrincipal = params.mercados[0] ?? "IMB";
  const row = await prepararRowHubLeadInsert(
    supabase,
    {
      nome: params.nome.slice(0, 200),
      telefone: params.telefone || null,
      email: params.email,
      origem: params.origem,
      estagio: "novo",
      score: 10,
      valor_estimado: 0,
      agente_responsavel: "sdr",
      pessoa_id: params.pessoa_id,
      tenant_id: params.tenant_id,
      metadata: {
        mercados: params.mercados,
        mercado_principal: mercadoPrincipal,
        origem_cadastro: "super_cadastro",
        ...(params.indicado_por ? { indicado_por: params.indicado_por } : {}),
      },
    },
    { pessoa_codigo: params.pessoa_codigo }
  );

  let payload: Record<string, unknown> = { ...row };
  let selectCols = "id, codigo";
  const codigoGerado = row.codigo != null ? String(row.codigo) : "";

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from("hub_leads_crm")
      .insert(payload)
      .select(selectCols)
      .single();

    const inserted = data as { id?: string; codigo?: string | null } | null;
    if (!error && inserted?.id) {
      return {
        id: String(inserted.id),
        codigo:
          inserted.codigo != null ? String(inserted.codigo) : codigoGerado || "",
      };
    }

    if (isTenantFkError(error) || isMissingPgColumn(error, "tenant_id")) {
      delete payload.tenant_id;
      continue;
    }

    if (isMissingPgColumn(error, "codigo")) {
      const { codigo: _c, ...semCodigo } = payload;
      payload = semCodigo;
      selectCols = "id";
      continue;
    }

    console.error("[cadastro] lead insert:", error);
    return null;
  }

  return null;
}

export async function salvarSuperCadastro(
  supabase: SupabaseClient,
  data: SuperCadastroValidado,
  opts: {
    tenantId: string;
    insertHubPessoa: (
      row: Record<string, unknown>,
      tenantId: string
    ) => Promise<{ data: HubPessoaRow | null; error: unknown }>;
    insertHubEmpresa: (
      row: Record<string, unknown>,
      tenantId: string
    ) => Promise<{ data: { id: string } | null; error: unknown }>;
    opencnpjSnapshot?: OpenCnpjApiResponse | null;
  }
): Promise<SalvarSuperCadastroResult> {
  const pessoaPayload = payloadParaPessoa(data, opts.opencnpjSnapshot);
  const tel = resolverTelefoneCadastro(pessoaPayload.telefone);

  const [{ data: dupTel }, dupDoc] = await Promise.all([
    tel
      ? supabase
          .from("hub_pessoas")
          .select("id, nome, codigo")
          .eq("telefone", tel)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    pessoaPayload.documento
      ? buscarPessoaPorDocumento(supabase, data.tipo_pessoa, pessoaPayload.documento)
      : Promise.resolve(null),
  ]);

  if (dupTel) {
    return {
      ok: false,
      status: 409,
      error: `Telefone já cadastrado para ${dupTel.nome} (${dupTel.codigo || "sem código"}).`,
    };
  }

  if (dupDoc) {
    const label = data.tipo_pessoa === "PF" ? "CPF" : "CNPJ";
    return {
      ok: false,
      status: 409,
      error: `${label} já cadastrado para ${dupDoc.nome} (${dupDoc.codigo || "sem código"}).`,
    };
  }

  const isPjComCnpj =
    data.tipo_pessoa === "PJ" &&
    !!data.documento &&
    documentoCompleto("PJ", data.documento);

  const [codigoPessoa, codigoEmpPrecalc] = await Promise.all([
    gerarCodigoPessoa(supabase),
    isPjComCnpj ? gerarCodigoEmpresa(supabase) : Promise.resolve(null as string | null),
  ]);

  const now = new Date().toISOString();
  const rowPessoa = montarRowInsertHubPessoa(
    {
      tipo_pessoa: pessoaPayload.tipo_pessoa,
      nome: pessoaPayload.nome,
      documento: pessoaPayload.documento,
      email: pessoaPayload.email,
      telefone: tel ?? "",
      empresa: pessoaPayload.empresa,
      area_atuacao: pessoaPayload.area_atuacao,
      cep: pessoaPayload.cep,
      logradouro: pessoaPayload.logradouro,
      numero: pessoaPayload.numero,
      complemento: pessoaPayload.complemento,
      bairro: pessoaPayload.bairro,
      cidade: pessoaPayload.cidade,
      estado: pessoaPayload.estado,
      origem: pessoaPayload.origem,
    },
    codigoPessoa,
    now
  );

  rowPessoa.tipo = data.comercial.criar_lead ? "lead" : "cliente";
  rowPessoa.dados_extras = montarDadosExtrasPessoa(pessoaPayload);

  const insPessoa = await opts.insertHubPessoa(rowPessoa, opts.tenantId);
  if (insPessoa.error || !insPessoa.data?.id) {
    const pg =
      insPessoa.error && typeof insPessoa.error === "object"
        ? (insPessoa.error as { message?: string; code?: string; hint?: string })
        : null;
    const msg = pg?.message || "Erro ao gravar contacto em hub_pessoas.";
    const detail = pg?.hint || pg?.code || undefined;
    return { ok: false, status: 500, error: msg, detail };
  }

  const pessoaId = String(insPessoa.data.id);
  const pessoaCodigo =
    insPessoa.data?.codigo != null ? String(insPessoa.data.codigo) : codigoPessoa;
  const indicadoPor =
    data.comercial.lead_origem === "indicacao"
      ? (data.comercial.indicado_por || "").trim() || null
      : null;

  const [empresaId, leadPack] = await Promise.all([
    (async (): Promise<string | undefined> => {
      if (!isPjComCnpj) return undefined;
      const prefixo = data.prefixo_mercado as PrefixoMercado;
      const empPayload: EmpresaCadastroPayload = {
        razao_social: data.nome,
        nome_fantasia: data.nome_fantasia ?? null,
        cnpj: data.documento!,
        email: data.email ?? null,
        telefone: tel,
        segmento: data.comercial.segmento ?? "cliente",
        prefixo_mercado: prefixo,
        cep: pessoaPayload.cep ?? null,
        logradouro: pessoaPayload.logradouro ?? null,
        numero: pessoaPayload.numero ?? null,
        complemento: pessoaPayload.complemento ?? null,
        bairro: pessoaPayload.bairro ?? null,
        cidade: pessoaPayload.cidade ?? null,
        estado: pessoaPayload.estado ?? null,
      };

      const { data: dupEmp } = await supabase
        .from("hub_empresas")
        .select("id")
        .eq("cnpj", empPayload.cnpj)
        .maybeSingle();

      if (dupEmp) return dupEmp.id as string;

      const codigoEmp = codigoEmpPrecalc ?? (await gerarCodigoEmpresa(supabase));
      const rowEmp: Record<string, unknown> = {
        codigo: codigoEmp,
        razao_social: empPayload.razao_social,
        nome_fantasia: empPayload.nome_fantasia,
        cnpj: empPayload.cnpj,
        email: empPayload.email,
        telefone: empPayload.telefone,
        segmento: empPayload.segmento,
        prefixo_mercado: empPayload.prefixo_mercado,
        cep: empPayload.cep,
        logradouro: empPayload.logradouro,
        numero: empPayload.numero,
        complemento: empPayload.complemento,
        bairro: empPayload.bairro,
        cidade: empPayload.cidade,
        estado: empPayload.estado,
        ativo: true,
        criado_em: now,
        atualizado_em: now,
      };

      const insEmp = await opts.insertHubEmpresa(rowEmp, opts.tenantId);
      return insEmp.data?.id ? String(insEmp.data.id) : undefined;
    })(),
    (async (): Promise<{ leadId?: string; codigoLead?: string; aviso?: string }> => {
      if (!data.comercial.criar_lead) return {};
      const lead = await insertLead(supabase, {
        nome: data.nome,
        telefone: tel ?? "",
        email: data.email ?? null,
        pessoa_id: pessoaId,
        pessoa_codigo: pessoaCodigo,
        tenant_id: opts.tenantId,
        mercados: data.comercial.mercados,
        origem: data.comercial.lead_origem || "outro",
        indicado_por: indicadoPor,
      });
      if (lead) return { leadId: lead.id, codigoLead: lead.codigo };
      return {
        aviso:
          "Contacto gravado, mas o lead no funil não foi criado. Aplique a migração LED no Supabase ou tente em Leads.",
      };
    })(),
  ]);

  const leadId = leadPack.leadId;
  const codigoLead = leadPack.codigoLead;
  const aviso = leadPack.aviso;

  return {
    ok: true,
    pessoa_id: pessoaId,
    empresa_id: empresaId,
    lead_id: leadId,
    codigo_pessoa: codigoPessoa,
    codigo_lead: codigoLead,
    pessoa: insPessoa.data,
    aviso,
  };
}

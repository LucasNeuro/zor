import type { PessoaCadastroPayload } from "@/lib/crm/pessoa-cadastro";

/** Colunas seguras no hub_pessoas de produção (schema base sem migração 20260521130000). */
export const HUB_PESSOA_SELECT_CORE =
  "id, codigo, nome, telefone, email, tipo, tipo_pessoa, documento, empresa, cidade, estado, origem, dados_extras, criado_em, atualizado_em";

export const HUB_PESSOA_SELECT_EXTENDED =
  `${HUB_PESSOA_SELECT_CORE}, area_atuacao, cep, logradouro, numero, complemento, bairro, tenant_id`;

/** Listagem CRM: todas as colunas úteis do hub_pessoas. */
export const HUB_PESSOA_SELECT_LIST = HUB_PESSOA_SELECT_EXTENDED;

export type HubPessoaRow = Record<string, unknown>;

export function dadosExtrasEndereco(d: Pick<
  PessoaCadastroPayload,
  "area_atuacao" | "cep" | "logradouro" | "numero" | "complemento" | "bairro"
>): Record<string, unknown> {
  return {
    area_atuacao: d.area_atuacao ?? null,
    cep: d.cep ?? null,
    logradouro: d.logradouro ?? null,
    numero: d.numero ?? null,
    complemento: d.complemento ?? null,
    bairro: d.bairro ?? null,
  };
}

/** Monta linha de insert alinhada ao schema; endereço também vai em dados_extras. */
export function montarRowInsertHubPessoa(
  d: PessoaCadastroPayload,
  codigo: string,
  now: string
): Record<string, unknown> {
  const extras = dadosExtrasEndereco(d);
  const row: Record<string, unknown> = {
    codigo,
    nome: d.nome,
    telefone: d.telefone?.trim() ? d.telefone : null,
    email: d.email,
    documento: d.documento,
    tipo: "cliente",
    tipo_pessoa: d.tipo_pessoa,
    empresa: d.tipo_pessoa === "PJ" ? d.empresa : null,
    cidade: d.cidade,
    estado: d.estado,
    origem: d.origem ?? "crm_manual",
    criado_em: now,
    atualizado_em: now,
    dados_extras: extras,
  };
  if (d.area_atuacao) row.area_atuacao = d.area_atuacao;
  if (d.cep) row.cep = d.cep;
  if (d.logradouro) row.logradouro = d.logradouro;
  if (d.numero) row.numero = d.numero;
  if (d.complemento) row.complemento = d.complemento;
  if (d.bairro) row.bairro = d.bairro;
  return row;
}

/** Expõe area/CEP da coluna ou de dados_extras (produção sem migração de endereço). */
export function enriquecerPessoaDaDb(row: HubPessoaRow): HubPessoaRow {
  const extras =
    row.dados_extras && typeof row.dados_extras === "object" && !Array.isArray(row.dados_extras)
      ? (row.dados_extras as Record<string, unknown>)
      : {};
  return {
    ...row,
    area_atuacao: row.area_atuacao ?? extras.area_atuacao ?? null,
    cep: row.cep ?? extras.cep ?? null,
    logradouro: row.logradouro ?? extras.logradouro ?? null,
    numero: row.numero ?? extras.numero ?? null,
    complemento: row.complemento ?? extras.complemento ?? null,
    bairro: row.bairro ?? extras.bairro ?? null,
  };
}

export function enriquecerListaPessoas(rows: HubPessoaRow[] | null): HubPessoaRow[] {
  return (rows ?? []).map(enriquecerPessoaDaDb);
}

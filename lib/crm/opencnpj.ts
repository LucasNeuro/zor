/** Cliente e normalização da API OpenCNPJ — https://opencnpj.org */

import { normalizarDocumento } from "@/lib/crm/documento-brasil";
import { normalizarCep } from "@/lib/crm/viacep";

const OPENCNPJ_BASE = "https://api.opencnpj.org";

export type OpenCnpjTelefone = {
  ddd: string;
  numero: string;
  is_fax?: boolean;
};

export type OpenCnpjSocio = {
  nome_socio?: string;
  cnpj_cpf_socio?: string;
  qualificacao_socio?: string;
  data_entrada_sociedade?: string;
  identificador_socio?: string;
  faixa_etaria?: string;
};

/** Resposta bruta da API (campos principais). */
export type OpenCnpjApiResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  matriz_filial?: string;
  data_inicio_atividade?: string;
  cnae_principal?: string;
  cnaes_secundarios?: string[];
  natureza_juridica?: string;
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  municipio?: string;
  email?: string;
  telefones?: OpenCnpjTelefone[];
  capital_social?: string;
  porte_empresa?: string;
  opcao_simples?: string;
  data_opcao_simples?: string;
  opcao_mei?: string;
  data_opcao_mei?: string;
  QSA?: OpenCnpjSocio[];
};

/** Dados normalizados para o formulário de cadastro PJ. */
export type OpenCnpjEnriquecido = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  /** Snapshot completo para dados_extras / auditoria. */
  snapshot: OpenCnpjApiResponse;
};

/** Rua sem número/complemento (gravados em colunas separadas). */
export function montarLogradouroOpenCnpj(d: OpenCnpjApiResponse): string {
  const tipo = (d.tipo_logradouro || "").trim();
  const rua = (d.logradouro || "").trim();
  if (tipo && rua) return `${tipo} ${rua}`.slice(0, 200);
  if (rua) return rua.slice(0, 200);
  return "";
}

export function extrairTelefoneOpenCnpj(telefones: OpenCnpjTelefone[] | undefined): string | null {
  if (!telefones?.length) return null;
  const t = telefones.find((x) => !x.is_fax) ?? telefones[0];
  const ddd = (t.ddd || "").replace(/\D/g, "");
  const num = (t.numero || "").replace(/\D/g, "");
  const full = `${ddd}${num}`.replace(/\D/g, "");
  if (full.length < 10) return null;
  return full.slice(0, 13);
}

export function normalizarOpenCnpjResposta(raw: OpenCnpjApiResponse): OpenCnpjEnriquecido {
  const cnpj = normalizarDocumento(String(raw.cnpj || ""));
  const cepDigits = raw.cep ? normalizarCep(raw.cep) : "";
  return {
    cnpj,
    razao_social: (raw.razao_social || "").trim().slice(0, 200),
    nome_fantasia: (raw.nome_fantasia || "").trim().slice(0, 200) || null,
    situacao_cadastral: (raw.situacao_cadastral || "").trim() || null,
    email: (raw.email || "").trim().toLowerCase().slice(0, 120) || null,
    telefone: extrairTelefoneOpenCnpj(raw.telefones),
    cep: cepDigits || null,
    logradouro: montarLogradouroOpenCnpj(raw) || null,
    numero: (raw.numero || "").trim().slice(0, 20) || null,
    complemento: (raw.complemento || "").trim().slice(0, 80) || null,
    bairro: (raw.bairro || "").trim().slice(0, 120) || null,
    cidade: (raw.municipio || "").trim().slice(0, 120) || null,
    estado: (raw.uf || "").trim().toUpperCase().slice(0, 2) || null,
    snapshot: raw,
  };
}

export async function buscarCnpjOpenCnpj(
  cnpj: string
): Promise<
  | { ok: true; dados: OpenCnpjEnriquecido }
  | { ok: false; status: number; erro: string }
> {
  const digits = normalizarDocumento(cnpj);
  if (digits.length !== 14) {
    return { ok: false, status: 400, erro: "CNPJ deve ter 14 dígitos." };
  }

  try {
    const res = await fetch(`${OPENCNPJ_BASE}/${digits}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (res.status === 404) {
      return { ok: false, status: 404, erro: "CNPJ não encontrado na base OpenCNPJ." };
    }
    if (res.status === 400) {
      return { ok: false, status: 400, erro: "CNPJ inválido para consulta." };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        erro: "Não foi possível consultar o CNPJ. Tente novamente.",
      };
    }

    const raw = (await res.json()) as OpenCnpjApiResponse;
    if (!raw.razao_social?.trim()) {
      return { ok: false, status: 502, erro: "Resposta da OpenCNPJ sem razão social." };
    }

    return { ok: true, dados: normalizarOpenCnpjResposta(raw) };
  } catch {
    return { ok: false, status: 503, erro: "Serviço OpenCNPJ indisponível no momento." };
  }
}

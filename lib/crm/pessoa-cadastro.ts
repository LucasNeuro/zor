import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarCodigoSequencial, HUB_PREFIXO_CODIGO } from "@/lib/crm/codigos-rastreio";
import {
  AREA_ATUACAO_OUTRO_VALUE,
  isAreaAtuacaoValid,
  normalizarAreaAtuacao,
} from "@/lib/crm/areas-atuacao";
import {
  documentoCompleto,
  mensagemDocumentoInvalido,
  normalizarDocumento,
  validarCnpj,
  validarCpf,
} from "@/lib/crm/documento-brasil";
import { cepValidoParaBusca, normalizarCep } from "@/lib/crm/viacep";

export type TipoPessoaCadastro = "PF" | "PJ";

export type PessoaCadastroPayload = {
  tipo_pessoa: TipoPessoaCadastro;
  nome: string;
  documento?: string | null;
  email?: string | null;
  telefone: string;
  empresa?: string | null;
  area_atuacao?: string | null;
  /** Texto livre quando area_atuacao === "outro" (não gravado em coluna separada). */
  area_atuacao_outro?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  origem?: string | null;
};

const UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export function normalizarTelefone(t: string): string {
  return t.replace(/\D/g, "");
}

export { normalizarDocumento, validarCpf, validarCnpj } from "@/lib/crm/documento-brasil";

export function validarEmail(email: string): boolean {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validarUF(estado: string): boolean {
  const u = estado.trim().toUpperCase();
  if (!u) return true;
  return (UF as readonly string[]).includes(u);
}

export type ValidarPessoaOpcoes = {
  /** Campanhas / marketing: CPF, telefone e nome opcionais; valida formato só se preenchido. */
  flexivel?: boolean;
};

export function validarPessoaCadastro(
  body: Partial<PessoaCadastroPayload>,
  opcoes?: ValidarPessoaOpcoes
): { ok: true; data: PessoaCadastroPayload } | { ok: false; erro: string } {
  const flexivel = opcoes?.flexivel === true;
  const tipo = body.tipo_pessoa;
  if (tipo !== "PF" && tipo !== "PJ") {
    return { ok: false, erro: "Selecione Pessoa Física (PF) ou Jurídica (PJ)." };
  }

  const nome = (body.nome || "").trim();
  if (!flexivel && (!nome || nome.length < 2)) {
    return {
      ok: false,
      erro: tipo === "PJ" ? "Razão social é obrigatória (mín. 2 caracteres)." : "Nome é obrigatório (mín. 2 caracteres).",
    };
  }

  const telefone = normalizarTelefone(body.telefone || "");
  if (telefone.length > 0 && (telefone.length < 10 || telefone.length > 15)) {
    return { ok: false, erro: "Telefone inválido (informe DDD + número)." };
  }
  if (!flexivel && telefone.length < 10) {
    return { ok: false, erro: "Telefone inválido (informe DDD + número)." };
  }

  const email = (body.email || "").trim();
  if (email && !validarEmail(email)) {
    return { ok: false, erro: "E-mail inválido." };
  }

  const documentoRaw = (body.documento || "").trim();
  const documento = documentoRaw ? normalizarDocumento(documentoRaw) : null;
  if (tipo === "PF") {
    if (documento) {
      if (!documentoCompleto("PF", documento)) {
        return { ok: false, erro: "CPF incompleto (11 dígitos)." };
      }
      if (!validarCpf(documento)) {
        return { ok: false, erro: mensagemDocumentoInvalido("PF") };
      }
    } else if (!flexivel) {
      return { ok: false, erro: "CPF é obrigatório (11 dígitos)." };
    }
  } else {
    if (documento) {
      if (!documentoCompleto("PJ", documento)) {
        return { ok: false, erro: "CNPJ incompleto (14 dígitos)." };
      }
      if (!validarCnpj(documento)) {
        return { ok: false, erro: mensagemDocumentoInvalido("PJ") };
      }
    } else if (!flexivel) {
      return { ok: false, erro: "CNPJ é obrigatório (14 dígitos)." };
    }
  }

  const estado = (body.estado || "").trim().toUpperCase();
  if (estado && !validarUF(estado)) {
    return { ok: false, erro: "UF inválida." };
  }

  const areaSelect = (body.area_atuacao || "").trim();
  const areaOutroTexto = (body.area_atuacao_outro || "").trim();
  let area_atuacao: string | null = null;
  if (areaSelect === AREA_ATUACAO_OUTRO_VALUE) {
    if (!flexivel && (!areaOutroTexto || areaOutroTexto.length < 2)) {
      return {
        ok: false,
        erro: "Especifique a área de atuação (mín. 2 caracteres).",
      };
    }
    area_atuacao = areaOutroTexto.length >= 2 ? areaOutroTexto.slice(0, 80) : null;
  } else if (areaSelect) {
    const norm = normalizarAreaAtuacao(areaSelect);
    if (!norm && !isAreaAtuacaoValid(areaSelect)) {
      return { ok: false, erro: "Área de atuação inválida." };
    }
    area_atuacao = norm ?? areaSelect.slice(0, 80);
  }

  const cepRaw = (body.cep || "").trim();
  const cepDigits = cepRaw ? normalizarCep(cepRaw) : "";
  if (cepRaw && !cepValidoParaBusca(cepRaw)) {
    return { ok: false, erro: "CEP inválido (use 8 dígitos)." };
  }

  return {
    ok: true,
    data: {
      tipo_pessoa: tipo,
      nome: nome.length >= 2 ? nome.slice(0, 200) : "",
      documento,
      email: email || null,
      telefone: telefone || "",
      empresa: (body.empresa || "").trim().slice(0, 200) || null,
      area_atuacao,
      cep: cepDigits ? cepDigits : null,
      logradouro: (body.logradouro || "").trim().slice(0, 200) || null,
      numero: (body.numero || "").trim().slice(0, 20) || null,
      complemento: (body.complemento || "").trim().slice(0, 80) || null,
      bairro: (body.bairro || "").trim().slice(0, 120) || null,
      cidade: (body.cidade || "").trim().slice(0, 120) || null,
      estado: estado || null,
      origem: (body.origem || "crm_manual").trim().slice(0, 80) || "crm_manual",
    },
  };
}

export async function gerarCodigoPessoa(supabase: SupabaseClient): Promise<string> {
  return gerarCodigoSequencial(supabase, "hub_pessoas", HUB_PREFIXO_CODIGO.pessoa);
}

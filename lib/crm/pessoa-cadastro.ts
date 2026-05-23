import type { SupabaseClient } from "@supabase/supabase-js";
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

export function validarPessoaCadastro(
  body: Partial<PessoaCadastroPayload>
): { ok: true; data: PessoaCadastroPayload } | { ok: false; erro: string } {
  const tipo = body.tipo_pessoa;
  if (tipo !== "PF" && tipo !== "PJ") {
    return { ok: false, erro: "Selecione Pessoa Física (PF) ou Jurídica (PJ)." };
  }

  const nome = (body.nome || "").trim();
  if (!nome || nome.length < 2) {
    return {
      ok: false,
      erro: tipo === "PJ" ? "Razão social é obrigatória (mín. 2 caracteres)." : "Nome é obrigatório (mín. 2 caracteres).",
    };
  }

  const telefone = normalizarTelefone(body.telefone || "");
  if (telefone.length < 10 || telefone.length > 13) {
    return { ok: false, erro: "Telefone inválido (informe DDD + número)." };
  }

  const email = (body.email || "").trim();
  if (email && !validarEmail(email)) {
    return { ok: false, erro: "E-mail inválido." };
  }

  const documentoRaw = (body.documento || "").trim();
  const documento = documentoRaw ? normalizarDocumento(documentoRaw) : null;
  if (tipo === "PF") {
    if (!documento || !documentoCompleto("PF", documento)) {
      return { ok: false, erro: "CPF é obrigatório (11 dígitos)." };
    }
    if (!validarCpf(documento)) {
      return { ok: false, erro: mensagemDocumentoInvalido("PF") };
    }
  } else {
    if (!documento || !documentoCompleto("PJ", documento)) {
      return { ok: false, erro: "CNPJ é obrigatório (14 dígitos)." };
    }
    if (!validarCnpj(documento)) {
      return { ok: false, erro: mensagemDocumentoInvalido("PJ") };
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
    if (!areaOutroTexto || areaOutroTexto.length < 2) {
      return {
        ok: false,
        erro: "Especifique a área de atuação (mín. 2 caracteres).",
      };
    }
    area_atuacao = areaOutroTexto.slice(0, 80);
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
      nome: nome.slice(0, 200),
      documento,
      email: email || null,
      telefone,
      empresa: (body.empresa || "").trim().slice(0, 200) || null,
      area_atuacao,
      cep: cepDigits ? cepDigits : null,
      logradouro: (body.logradouro || "").trim().slice(0, 200) || null,
      bairro: (body.bairro || "").trim().slice(0, 120) || null,
      cidade: (body.cidade || "").trim().slice(0, 120) || null,
      estado: estado || null,
      origem: (body.origem || "crm_manual").trim().slice(0, 80) || "crm_manual",
    },
  };
}

export async function gerarCodigoPessoa(supabase: SupabaseClient): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase.from("hub_pessoas").select("*", { count: "exact", head: true });
  const seq = String((count || 0) + 1).padStart(4, "0");
  return `PES-${year}-${seq}`;
}

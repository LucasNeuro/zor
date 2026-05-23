import type { SupabaseClient } from "@supabase/supabase-js";
import {
  documentoCompleto,
  mensagemDocumentoInvalido,
  normalizarDocumento,
  validarCnpj,
} from "@/lib/crm/documento-brasil";
import {
  MERCADOS_PREFIXO,
  MERCADOS_PREFIXO_OPTIONS,
  type PrefixoMercado,
} from "@/lib/crm/negocio-cadastro";
import { cepValidoParaBusca, normalizarCep } from "@/lib/crm/viacep";

export { MERCADOS_PREFIXO, MERCADOS_PREFIXO_OPTIONS };

export const EMPRESA_SEGMENTOS = [
  { value: "cliente", label: "Cliente" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "parceiro", label: "Parceiro" },
  { value: "empreiteira", label: "Empreiteira" },
  { value: "construtora", label: "Construtora" },
  { value: "outro", label: "Outro" },
] as const;

export type EmpresaSegmento = (typeof EMPRESA_SEGMENTOS)[number]["value"];

export function labelEmpresaSegmento(seg: string | null | undefined): string {
  if (!seg) return "—";
  return EMPRESA_SEGMENTOS.find((s) => s.value === seg)?.label ?? seg;
}

export type EmpresaCadastroPayload = {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  segmento: EmpresaSegmento | null;
  prefixo_mercado: PrefixoMercado;
  cep: string | null;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
};

const UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export function normalizarTelefoneEmpresa(t: string): string {
  return t.replace(/\D/g, "");
}

function validarEmail(email: string): boolean {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validarUF(estado: string): boolean {
  const u = estado.trim().toUpperCase();
  if (!u) return true;
  return (UF as readonly string[]).includes(u);
}

export function validarEmpresaCadastro(
  body: Partial<{
    razao_social?: string;
    nome_fantasia?: string | null;
    cnpj?: string;
    email?: string | null;
    telefone?: string | null;
    segmento?: string | null;
    prefixo_mercado?: string;
    cep?: string | null;
    logradouro?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
  }>
): { ok: true; data: EmpresaCadastroPayload } | { ok: false; erro: string } {
  const razao_social = (body.razao_social || "").trim();
  if (!razao_social || razao_social.length < 2) {
    return { ok: false, erro: "Razão social é obrigatória (mín. 2 caracteres)." };
  }

  const cnpjRaw = (body.cnpj || "").trim();
  const cnpj = normalizarDocumento(cnpjRaw);
  if (!documentoCompleto("PJ", cnpjRaw)) {
    return { ok: false, erro: "Informe o CNPJ com 14 dígitos." };
  }
  if (!validarCnpj(cnpj)) {
    return { ok: false, erro: mensagemDocumentoInvalido("PJ") };
  }

  const prefixo = (body.prefixo_mercado || "").trim().toUpperCase() as PrefixoMercado;
  if (!MERCADOS_PREFIXO.includes(prefixo)) {
    return { ok: false, erro: "Selecione um mercado válido." };
  }

  const telefoneRaw = (body.telefone || "").trim();
  const telefone = telefoneRaw ? normalizarTelefoneEmpresa(telefoneRaw) : null;
  if (telefone && (telefone.length < 10 || telefone.length > 13)) {
    return { ok: false, erro: "Telefone inválido (informe DDD + número)." };
  }

  const email = (body.email || "").trim();
  if (email && !validarEmail(email)) {
    return { ok: false, erro: "E-mail inválido." };
  }

  const segmentoRaw = (body.segmento || "").trim();
  let segmento: EmpresaSegmento | null = null;
  if (segmentoRaw) {
    const found = EMPRESA_SEGMENTOS.find((s) => s.value === segmentoRaw);
    if (!found) {
      return { ok: false, erro: "Segmento inválido." };
    }
    segmento = found.value;
  }

  const cepRaw = (body.cep || "").trim();
  const cep = cepRaw ? normalizarCep(cepRaw) : null;
  if (cep && !cepValidoParaBusca(cep)) {
    return { ok: false, erro: "CEP inválido (use 8 dígitos)." };
  }

  const estado = (body.estado || "").trim().toUpperCase();
  if (estado && !validarUF(estado)) {
    return { ok: false, erro: "UF inválida." };
  }

  return {
    ok: true,
    data: {
      razao_social: razao_social.slice(0, 200),
      nome_fantasia: (body.nome_fantasia || "").trim().slice(0, 200) || null,
      cnpj,
      email: email || null,
      telefone,
      segmento,
      prefixo_mercado: prefixo,
      cep,
      logradouro: (body.logradouro || "").trim().slice(0, 200) || null,
      bairro: (body.bairro || "").trim().slice(0, 120) || null,
      cidade: (body.cidade || "").trim().slice(0, 120) || null,
      estado: estado || null,
    },
  };
}

export async function gerarCodigoEmpresa(supabase: SupabaseClient): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase.from("hub_empresas").select("*", { count: "exact", head: true });
  const seq = String((count || 0) + 1).padStart(4, "0");
  return `EMP-${year}-${seq}`;
}

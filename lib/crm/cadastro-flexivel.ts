import type { PrefixoMercado } from "@/lib/crm/negocio-cadastro";
import { normalizarTelefone } from "@/lib/crm/pessoa-cadastro";

/** Mercado padrão quando o lead é criado sem seleção (campanhas). */
export const MERCADO_LEAD_PADRAO: PrefixoMercado = "GRL";

export function mercadosLeadComPadrao(mercados: string[]): PrefixoMercado[] {
  if (mercados.length > 0) return mercados as PrefixoMercado[];
  return [MERCADO_LEAD_PADRAO];
}

export function temIdentificadorMinimoCadastro(input: {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
}): boolean {
  const nome = (input.nome || "").trim();
  if (nome.length >= 2) return true;

  const tel = normalizarTelefone(input.telefone || "");
  if (tel.length >= 10 && tel.length <= 15) return true;

  const email = (input.email || "").trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return true;

  return false;
}

/** Nome para hub_pessoas / hub_leads_crm (NOT NULL). */
export function resolverNomeCadastro(input: {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  tipo_pessoa?: "PF" | "PJ";
}): string {
  const nome = (input.nome || "").trim();
  if (nome.length >= 2) return nome.slice(0, 200);

  const tel = normalizarTelefone(input.telefone || "");
  if (tel.length >= 10) return `Contato ${tel.slice(-4)}`.slice(0, 200);

  const email = (input.email || "").trim();
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local && local.length >= 2) return local.slice(0, 200);
  }

  return input.tipo_pessoa === "PJ" ? "Empresa campanha" : "Lead campanha";
}

export function resolverTelefoneCadastro(telefone?: string | null): string | null {
  const tel = normalizarTelefone(telefone || "");
  if (tel.length < 10 || tel.length > 15) return null;
  return tel;
}

export const LEAD_ESTAGIOS = [
  "novo",
  "qualificando",
  "qualificado",
  "proposta",
  "negociando",
  "fechamento",
  "ganho",
  "perdido",
] as const;

export type LeadEstagio = (typeof LEAD_ESTAGIOS)[number];

export const LEAD_ORIGENS = [
  "whatsapp",
  "instagram",
  "meta_ads",
  "google_ads",
  "linkedin",
  "site",
  "indicacao",
  "outro",
] as const;

export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

export type LeadCadastroPayload = {
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: LeadOrigem;
  estagio: LeadEstagio;
  valor_estimado: number;
};

export function normalizarTelefoneLead(t: string): string {
  return t.replace(/\D/g, "");
}

export function validarLeadCadastro(
  body: Partial<{
    nome?: string;
    telefone?: string | null;
    email?: string | null;
    origem?: string;
    estagio?: string;
    valor_estimado?: number | string;
  }>
): { ok: true; data: LeadCadastroPayload } | { ok: false; erro: string } {
  const nome = (body.nome || "").trim();
  if (!nome || nome.length < 2) {
    return { ok: false, erro: "Nome é obrigatório (mín. 2 caracteres)." };
  }

  const telefoneRaw = (body.telefone || "").trim();
  const telefone = telefoneRaw ? normalizarTelefoneLead(telefoneRaw) : null;
  if (telefone && (telefone.length < 10 || telefone.length > 13)) {
    return { ok: false, erro: "Telefone inválido (informe DDD + número)." };
  }

  const email = (body.email || "").trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, erro: "E-mail inválido." };
  }

  const origem = (body.origem || "whatsapp").trim() as LeadOrigem;
  if (!LEAD_ORIGENS.includes(origem)) {
    return { ok: false, erro: "Origem inválida." };
  }

  const estagio = (body.estagio || "novo").trim() as LeadEstagio;
  if (!LEAD_ESTAGIOS.includes(estagio)) {
    return { ok: false, erro: "Estágio inválido." };
  }

  let valor_estimado = 0;
  if (body.valor_estimado !== undefined && body.valor_estimado !== null && body.valor_estimado !== "") {
    const v =
      typeof body.valor_estimado === "number"
        ? body.valor_estimado
        : parseFloat(String(body.valor_estimado).replace(",", "."));
    if (!Number.isFinite(v) || v < 0) {
      return { ok: false, erro: "Valor estimado inválido." };
    }
    valor_estimado = v;
  }

  return {
    ok: true,
    data: {
      nome: nome.slice(0, 200),
      telefone,
      email,
      origem,
      estagio,
      valor_estimado,
    },
  };
}

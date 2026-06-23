export type PlatformBrandRow = {
  id: string;
  slug: string;
  nome: string;
  tagline: string | null;
  dominios: string[];
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  cor_primaria: string;
  cor_accent: string;
  cor_fundo: string;
  company_name: string | null;
  is_principal: boolean;
  ativo: boolean;
  registration_type: string | null;
  document_type: string | null;
  document: string | null;
  billing_legal_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

export function mapPlatformBrandRow(row: Record<string, unknown>): PlatformBrandRow {
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    nome: String(row.nome ?? ""),
    tagline: typeof row.tagline === "string" ? row.tagline : null,
    dominios: Array.isArray(row.dominios) ? row.dominios.map(String) : [],
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    logo_dark_url: typeof row.logo_dark_url === "string" ? row.logo_dark_url : null,
    favicon_url: typeof row.favicon_url === "string" ? row.favicon_url : null,
    cor_primaria: String(row.cor_primaria ?? "#3f9848"),
    cor_accent: String(row.cor_accent ?? "#92ff00"),
    cor_fundo: String(row.cor_fundo ?? "#0b1f10"),
    company_name: typeof row.company_name === "string" ? row.company_name : null,
    is_principal: row.is_principal === true,
    ativo: row.ativo !== false,
    registration_type: typeof row.registration_type === "string" ? row.registration_type : null,
    document_type: typeof row.document_type === "string" ? row.document_type : null,
    document: typeof row.document === "string" ? row.document : null,
    billing_legal_name: typeof row.billing_legal_name === "string" ? row.billing_legal_name : null,
    contact_name: typeof row.contact_name === "string" ? row.contact_name : null,
    contact_email: typeof row.contact_email === "string" ? row.contact_email : null,
    contact_phone: typeof row.contact_phone === "string" ? row.contact_phone : null,
    criado_em: typeof row.criado_em === "string" ? row.criado_em : null,
    atualizado_em: typeof row.atualizado_em === "string" ? row.atualizado_em : null,
  };
}

export function cadastroPatchFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (body.registration_type != null) {
    const v = String(body.registration_type).trim().toUpperCase();
    patch.registration_type = v === "PJ" || v === "PF" ? v : null;
  }
  if (body.document_type != null) {
    const v = String(body.document_type).trim().toUpperCase();
    patch.document_type = v === "CNPJ" || v === "CPF" ? v : null;
  }
  if (body.document != null) patch.document = String(body.document).replace(/\D/g, "") || null;
  if (body.billing_legal_name != null) {
    patch.billing_legal_name = String(body.billing_legal_name).trim() || null;
  }
  if (body.contact_name != null) patch.contact_name = String(body.contact_name).trim() || null;
  if (body.contact_email != null) patch.contact_email = String(body.contact_email).trim() || null;
  if (body.contact_phone != null) {
    patch.contact_phone = String(body.contact_phone).replace(/\D/g, "") || null;
  }
  return patch;
}

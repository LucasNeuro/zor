import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenCnpjEnriquecido } from "@/lib/crm/opencnpj";

export const SETTINGS_EMPRESA_CADASTRAL_KEY = "empresa_cadastral";

export type TenantEmpresaCadastral = {
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
  cnae_principal: string | null;
  site: string | null;
  /** Texto livre: como a empresa se apresenta ao cliente (tom, serviço principal). */
  descricao_curta: string | null;
  atualizado_em: string | null;
};

function strField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

export type HubEmpresaCadastralRow = {
  cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  email?: string | null;
  telefone?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

function emptyEmpresaCadastral(): TenantEmpresaCadastral {
  return {
    cnpj: "",
    razao_social: "",
    nome_fantasia: null,
    situacao_cadastral: null,
    email: null,
    telefone: null,
    cep: null,
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    estado: null,
    cnae_principal: null,
    site: null,
    descricao_curta: null,
    atualizado_em: null,
  };
}

/** Dados gravados no onboarding público (conta PJ). */
export function parseEmpresaCadastralFromOnboardingSettings(
  settings: unknown,
  nomeExibicao?: string | null
): TenantEmpresaCadastral | null {
  if (!settings || typeof settings !== "object") return null;
  const s = settings as Record<string, unknown>;
  const regType = strField(s.registration_type).toUpperCase();
  if (regType !== "PJ") return null;

  const cnpj = onlyDigits(strField(s.cnpj));
  const tradeName = strField(s.trade_name) || null;
  const razao = nomeExibicao?.trim() || tradeName || "";

  const address =
    s.address && typeof s.address === "object"
      ? (s.address as Record<string, unknown>)
      : {};
  const contact =
    s.primary_contact && typeof s.primary_contact === "object"
      ? (s.primary_contact as Record<string, unknown>)
      : {};

  if (!cnpj && !razao && !tradeName) return null;

  return {
    cnpj,
    razao_social: razao,
    nome_fantasia: tradeName,
    situacao_cadastral: null,
    email: strField(contact.email) || null,
    telefone: onlyDigits(strField(contact.phone)) || null,
    cep: onlyDigits(strField(address.cep)) || null,
    logradouro: strField(address.logradouro) || null,
    numero: strField(address.numero) || null,
    complemento: strField(address.complemento) || null,
    bairro: strField(address.bairro) || null,
    cidade: strField(address.cidade) || null,
    estado: strField(address.uf).toUpperCase() || null,
    cnae_principal: null,
    site: null,
    descricao_curta: null,
    atualizado_em: null,
  };
}

export function parseEmpresaCadastralFromHubEmpresa(
  row: HubEmpresaCadastralRow
): TenantEmpresaCadastral | null {
  const razao = strField(row.razao_social);
  const fantasia = strField(row.nome_fantasia) || null;
  const cnpj = onlyDigits(strField(row.cnpj ?? ""));
  if (!razao && !fantasia && !cnpj) return null;

  return {
    cnpj,
    razao_social: razao,
    nome_fantasia: fantasia,
    situacao_cadastral: null,
    email: strField(row.email) || null,
    telefone: onlyDigits(strField(row.telefone ?? "")) || null,
    cep: onlyDigits(strField(row.cep ?? "")) || null,
    logradouro: strField(row.logradouro) || null,
    numero: strField(row.numero) || null,
    complemento: strField(row.complemento) || null,
    bairro: strField(row.bairro) || null,
    cidade: strField(row.cidade) || null,
    estado: strField(row.estado).toUpperCase() || null,
    cnae_principal: null,
    site: null,
    descricao_curta: null,
    atualizado_em: null,
  };
}

/** Mescla cadastro manual, empresa CRM e onboarding (prioridade nessa ordem). */
export function resolverEmpresaCadastral(
  settings: unknown,
  nomeExibicao?: string | null,
  hubEmpresa?: HubEmpresaCadastralRow | null
): TenantEmpresaCadastral | null {
  const salvo = parseEmpresaCadastralFromSettings(settings);
  const crm = hubEmpresa ? parseEmpresaCadastralFromHubEmpresa(hubEmpresa) : null;
  const onboarding = parseEmpresaCadastralFromOnboardingSettings(settings, nomeExibicao);

  const parts = [onboarding, crm, salvo].filter(Boolean) as TenantEmpresaCadastral[];
  if (!parts.length) return null;

  const merged = emptyEmpresaCadastral();
  let hasData = false;

  for (const part of parts) {
    for (const key of Object.keys(merged) as (keyof TenantEmpresaCadastral)[]) {
      const v = part[key];
      if (typeof v === "string" && v.trim()) {
        (merged as Record<string, unknown>)[key] = v.trim();
        hasData = true;
      }
    }
  }

  return hasData ? merged : null;
}

export function parseEmpresaCadastralFromSettings(settings: unknown): TenantEmpresaCadastral | null {
  if (!settings || typeof settings !== "object") return null;
  const raw = (settings as Record<string, unknown>)[SETTINGS_EMPRESA_CADASTRAL_KEY];
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const razao = strField(o.razao_social);
  const fantasia = strField(o.nome_fantasia) || null;
  const cnpj = strField(o.cnpj);
  const descricao = strField(o.descricao_curta) || null;
  if (!razao && !fantasia && !cnpj && !descricao) return null;

  return {
    cnpj,
    razao_social: razao,
    nome_fantasia: fantasia,
    situacao_cadastral: strField(o.situacao_cadastral) || null,
    email: strField(o.email) || null,
    telefone: strField(o.telefone) || null,
    cep: strField(o.cep) || null,
    logradouro: strField(o.logradouro) || null,
    numero: strField(o.numero) || null,
    complemento: strField(o.complemento) || null,
    bairro: strField(o.bairro) || null,
    cidade: strField(o.cidade) || null,
    estado: strField(o.estado) || null,
    cnae_principal: strField(o.cnae_principal) || null,
    site: strField(o.site) || null,
    descricao_curta: descricao,
    atualizado_em: strField(o.atualizado_em) || null,
  };
}

export function nomeComercialEmpresa(
  cadastral: TenantEmpresaCadastral | null | undefined,
  nomeExibicaoTenant?: string | null
): string {
  return (
    cadastral?.nome_fantasia?.trim() ||
    cadastral?.razao_social?.trim() ||
    nomeExibicaoTenant?.trim() ||
    ""
  );
}

export function empresaCadastralFromOpenCnpj(d: OpenCnpjEnriquecido): Partial<TenantEmpresaCadastral> {
  const cnae =
    typeof d.snapshot.cnae_principal === "string" ? d.snapshot.cnae_principal.trim() : null;
  return {
    cnpj: d.cnpj,
    razao_social: d.razao_social,
    nome_fantasia: d.nome_fantasia,
    situacao_cadastral: d.situacao_cadastral,
    email: d.email,
    telefone: d.telefone,
    cep: d.cep,
    logradouro: d.logradouro,
    numero: d.numero,
    complemento: d.complemento,
    bairro: d.bairro,
    cidade: d.cidade,
    estado: d.estado,
    cnae_principal: cnae,
  };
}

export async function lerEmpresaCadastralTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{
  cadastral: TenantEmpresaCadastral | null;
  nome_exibicao: string | null;
  preenchido_de_cadastro: boolean;
}> {
  const { data, error } = await supabase
    .from("hub_tenants")
    .select("settings, nome_exibicao")
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !data) {
    return { cadastral: null, nome_exibicao: null, preenchido_de_cadastro: false };
  }

  const nomeExibicao = typeof data.nome_exibicao === "string" ? data.nome_exibicao : null;
  const salvo = parseEmpresaCadastralFromSettings(data.settings);

  let hubEmpresa: HubEmpresaCadastralRow | null = null;
  const empQuery = await supabase
    .from("hub_empresas")
    .select(
      "cnpj, razao_social, nome_fantasia, email, telefone, cep, logradouro, numero, complemento, bairro, cidade, estado"
    )
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .order("criado_em", { ascending: false })
    .limit(1);

  if (!empQuery.error && empQuery.data?.[0]) {
    hubEmpresa = empQuery.data[0];
  }

  const cadastral = resolverEmpresaCadastral(data.settings, nomeExibicao, hubEmpresa);
  const preenchidoDeCadastro =
    !salvo &&
    !!cadastral &&
    (!!parseEmpresaCadastralFromOnboardingSettings(data.settings, nomeExibicao) || !!hubEmpresa);

  return {
    cadastral,
    nome_exibicao: nomeExibicao,
    preenchido_de_cadastro: preenchidoDeCadastro,
  };
}

export async function salvarEmpresaCadastralTenant(
  supabase: SupabaseClient,
  tenantId: string,
  cadastral: TenantEmpresaCadastral
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: readErr } = await supabase
    .from("hub_tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };

  const prev =
    row?.settings && typeof row.settings === "object" ? (row.settings as Record<string, unknown>) : {};

  const payload: TenantEmpresaCadastral = {
    ...cadastral,
    atualizado_em: new Date().toISOString(),
  };

  const settings = { ...prev, [SETTINGS_EMPRESA_CADASTRAL_KEY]: payload };

  const nomeExibicao =
    payload.nome_fantasia?.trim() || payload.razao_social?.trim() || undefined;

  const update: Record<string, unknown> = { settings };
  if (nomeExibicao) update.nome_exibicao = nomeExibicao.slice(0, 200);

  const { error: writeErr } = await supabase.from("hub_tenants").update(update).eq("id", tenantId);
  if (writeErr) return { ok: false, error: writeErr.message };
  return { ok: true };
}

export function formatarEmpresaCadastralParaPrompt(
  cadastral: TenantEmpresaCadastral,
  nomeExibicaoTenant?: string | null
): string {
  const nome = nomeComercialEmpresa(cadastral, nomeExibicaoTenant);
  const linhas = [
    nome ? `Nome comercial (use na saudação): ${nome}` : "",
    cadastral.razao_social ? `Razão social: ${cadastral.razao_social}` : "",
    cadastral.cnpj ? `CNPJ: ${cadastral.cnpj}` : "",
    cadastral.cnae_principal ? `Atividade (CNAE): ${cadastral.cnae_principal}` : "",
    cadastral.descricao_curta ? `Sobre o negócio: ${cadastral.descricao_curta}` : "",
    cadastral.email ? `E-mail: ${cadastral.email}` : "",
    cadastral.telefone ? `Telefone: ${cadastral.telefone}` : "",
    cadastral.site ? `Site: ${cadastral.site}` : "",
    [cadastral.logradouro, cadastral.numero, cadastral.bairro, cadastral.cidade, cadastral.estado]
      .filter(Boolean)
      .length
      ? `Endereço: ${[cadastral.logradouro, cadastral.numero, cadastral.complemento, cadastral.bairro, cadastral.cidade, cadastral.estado].filter(Boolean).join(", ")}`
      : "",
  ].filter(Boolean);

  if (!linhas.length) return "";

  const regras = nome
    ? [
        `Você representa **${nome}** — nunca diga apenas «nossa assistência técnica» ou «nossa empresa» sem citar o nome.`,
        `Na 1ª mensagem, cumprimente como assistente de ${nome} (ex.: «Olá! Bem-vindo(a) à ${nome}. Como posso ajudar?»).`,
        "Não invente serviços, endereços ou políticas que não estejam aqui ou nos documentos da empresa.",
      ]
    : [
        "Use os dados cadastrais abaixo; não responda de forma genérica se houver nome ou descrição do negócio.",
      ];

  return `${linhas.join("\n")}\n\nRegras de identidade:\n${regras.map((r) => `- ${r}`).join("\n")}`;
}

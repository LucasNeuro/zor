import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantEmpresaCadastral } from "@/lib/hub/tenant-empresa-cadastral";
import { nomeComercialEmpresa } from "@/lib/hub/tenant-empresa-cadastral";

export type CoraDocumentType = "CPF" | "CNPJ";

export type UserBillingRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  owner?: boolean | null;
  document_type?: string | null;
  document?: string | null;
  billing_legal_name?: string | null;
  billing_cep?: string | null;
  billing_logradouro?: string | null;
  billing_numero?: string | null;
  billing_complemento?: string | null;
  billing_bairro?: string | null;
  billing_cidade?: string | null;
  billing_uf?: string | null;
};

export type UserBillingProfile = {
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  document_type: CoraDocumentType;
  document: string;
  legal_name: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  fonte: "user" | "tenant_cadastral" | "merged";
};

export const USER_BILLING_SELECT =
  "id, name, email, phone, role, owner, document_type, document, billing_legal_name, billing_cep, billing_logradouro, billing_numero, billing_complemento, billing_bairro, billing_cidade, billing_uf";

export function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

export function inferirTipoDocumento(documento: string): CoraDocumentType | null {
  const d = onlyDigits(documento);
  if (d.length === 11) return "CPF";
  if (d.length === 14) return "CNPJ";
  return null;
}

export function documentoProntoParaCora(
  document: string | null | undefined,
  documentType?: CoraDocumentType | null,
): boolean {
  const d = onlyDigits(document);
  const tipo = documentType ?? inferirTipoDocumento(d);
  if (tipo === "CPF") return d.length === 11;
  if (tipo === "CNPJ") return d.length === 14;
  return false;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function perfilCobrancaFromUserRow(row: UserBillingRow | null): UserBillingProfile | null {
  if (!row) return null;

  const document = onlyDigits(row.document);
  const document_type =
    row.document_type === "CPF" || row.document_type === "CNPJ"
      ? row.document_type
      : inferirTipoDocumento(document);

  if (!document || !document_type || !documentoProntoParaCora(document, document_type)) {
    return null;
  }

  const legal_name =
    str(row.billing_legal_name) || str(row.name) || "Cliente Waje";

  return {
    user_id: row.id,
    name: str(row.name) || legal_name,
    email: str(row.email),
    phone: onlyDigits(row.phone ?? "") || null,
    document_type,
    document,
    legal_name,
    cep: onlyDigits(row.billing_cep) || null,
    logradouro: str(row.billing_logradouro) || null,
    numero: str(row.billing_numero) || null,
    complemento: str(row.billing_complemento) || null,
    bairro: str(row.billing_bairro) || null,
    cidade: str(row.billing_cidade) || null,
    uf: str(row.billing_uf).toUpperCase() || null,
    fonte: "user",
  };
}

export function perfilCobrancaFromTenantCadastral(
  cadastral: TenantEmpresaCadastral | null,
  nomeExibicao?: string | null,
): UserBillingProfile | null {
  if (!cadastral) return null;

  const document = onlyDigits(cadastral.cnpj);
  if (!documentoProntoParaCora(document, "CNPJ")) return null;

  return {
    user_id: null,
    name: nomeComercialEmpresa(cadastral, nomeExibicao) || cadastral.razao_social || "Cliente Waje",
    email: str(cadastral.email),
    phone: onlyDigits(cadastral.telefone) || null,
    document_type: "CNPJ",
    document,
    legal_name: nomeComercialEmpresa(cadastral, nomeExibicao) || cadastral.razao_social || "Cliente Waje",
    cep: onlyDigits(cadastral.cep) || null,
    logradouro: str(cadastral.logradouro) || null,
    numero: str(cadastral.numero) || null,
    complemento: str(cadastral.complemento) || null,
    bairro: str(cadastral.bairro) || null,
    cidade: str(cadastral.cidade) || null,
    uf: str(cadastral.estado).toUpperCase() || null,
    fonte: "tenant_cadastral",
  };
}

/** Prioriza dados em `users`; complementa endereço/contato com cadastro do tenant. */
export function escolherPerfilCobrancaBase(
  fromUser: UserBillingProfile | null,
  fromSettings: UserBillingProfile | null,
  fromCadastral: UserBillingProfile | null,
): UserBillingProfile | null {
  const ordem = [fromSettings, fromCadastral, fromUser];
  return ordem.find(Boolean) ?? null;
}

function escolherCnpjTenantSettings(
  s: Record<string, unknown>,
  regType: string,
): { document: string; document_type: CoraDocumentType } {
  const isPf = regType === "PF";
  const cpf = onlyDigits(str(s.cpf));
  const cnpjDirect = onlyDigits(str(s.cnpj));
  const ec =
    s.empresa_cadastral && typeof s.empresa_cadastral === "object"
      ? (s.empresa_cadastral as Record<string, unknown>)
      : null;
  const cnpjEc = onlyDigits(str(ec?.cnpj));

  if (isPf && cpf.length === 11) {
    return { document: cpf, document_type: "CPF" };
  }

  const cnpjCandidates = [cnpjDirect, cnpjEc].filter((d) => d.length === 14);
  const cnpjValido = cnpjCandidates[0] ?? "";

  if (cnpjValido) {
    return { document: cnpjValido, document_type: "CNPJ" };
  }

  if (cpf.length === 11) {
    return { document: cpf, document_type: "CPF" };
  }

  return { document: "", document_type: "CNPJ" };
}

export function mesclarPerfilCobranca(
  userProfile: UserBillingProfile | null,
  cadastral: TenantEmpresaCadastral | null,
  nomeExibicao?: string | null,
): UserBillingProfile | null {
  const fromCadastral = perfilCobrancaFromTenantCadastral(cadastral, nomeExibicao);
  if (!userProfile) return fromCadastral;
  if (!fromCadastral) return userProfile;

  return {
    ...userProfile,
    email: userProfile.email || fromCadastral.email,
    phone: userProfile.phone || fromCadastral.phone,
    legal_name: userProfile.legal_name || fromCadastral.legal_name,
    cep: userProfile.cep || fromCadastral.cep,
    logradouro: userProfile.logradouro || fromCadastral.logradouro,
    numero: userProfile.numero || fromCadastral.numero,
    complemento: userProfile.complemento || fromCadastral.complemento,
    bairro: userProfile.bairro || fromCadastral.bairro,
    cidade: userProfile.cidade || fromCadastral.cidade,
    uf: userProfile.uf || fromCadastral.uf,
    fonte: "merged",
  };
}

export function resumoEnderecoPerfilCobranca(profile: UserBillingProfile | null): string | null {
  if (!profile) return null;
  const partes = [profile.logradouro, profile.numero, profile.bairro, profile.cidade, profile.uf].filter(
    Boolean,
  );
  return partes.length ? partes.join(", ") : null;
}

function rolePriority(role: string | null | undefined): number {
  const r = str(role).toLowerCase();
  if (r === "owner") return 0;
  if (r === "admin") return 1;
  return 2;
}

export function billingFieldsFromOnboarding(input: {
  registrationType: "PJ" | "PF";
  companyName: string;
  tradeName?: string | null;
  cpf: string;
  cnpj: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
}): Record<string, unknown> {
  const isPj = input.registrationType === "PJ";
  const document = isPj ? onlyDigits(input.cnpj) : onlyDigits(input.cpf);

  return {
    name: input.contactName,
    email: input.contactEmail,
    phone: onlyDigits(input.contactPhone ?? "") || null,
    document_type: isPj ? "CNPJ" : "CPF",
    document,
    billing_legal_name: input.companyName.trim() || input.tradeName?.trim() || input.contactName,
    billing_cep: onlyDigits(input.cep ?? "") || null,
    billing_logradouro: input.logradouro?.trim() || null,
    billing_numero: input.numero?.trim() || null,
    billing_complemento: input.complemento?.trim() || null,
    billing_bairro: input.bairro?.trim() || null,
    billing_cidade: input.cidade?.trim() || null,
    billing_uf: input.uf?.trim()?.toUpperCase() || null,
  };
}

/** Lê CPF/CNPJ e endereço direto de hub_tenants.settings (onboarding). */
export function perfilCobrancaFromTenantSettings(
  settings: unknown,
  nomeExibicao?: string | null,
): UserBillingProfile | null {
  if (!settings || typeof settings !== "object") return null;
  const s = settings as Record<string, unknown>;
  const regType = str(s.registration_type).toUpperCase();
  const { document, document_type } = escolherCnpjTenantSettings(s, regType);

  if (!documentoProntoParaCora(document, document_type)) return null;

  const ec =
    s.empresa_cadastral && typeof s.empresa_cadastral === "object"
      ? (s.empresa_cadastral as Record<string, unknown>)
      : null;
  const address =
    s.address && typeof s.address === "object" ? (s.address as Record<string, unknown>) : {};
  const contact =
    s.primary_contact && typeof s.primary_contact === "object"
      ? (s.primary_contact as Record<string, unknown>)
      : {};

  const tradeName = str(s.trade_name) || null;
  const legalName =
    nomeExibicao?.trim() ||
    tradeName ||
    str(ec?.razao_social) ||
    str(contact.name) ||
    "Cliente Waje";

  return {
    user_id: null,
    name: str(contact.name) || legalName,
    email: str(contact.email),
    phone: onlyDigits(str(contact.phone)) || null,
    document_type,
    document,
    legal_name: legalName,
    cep: onlyDigits(str(address.cep) || str(ec?.cep)) || null,
    logradouro: str(address.logradouro) || str(ec?.logradouro) || null,
    numero: str(address.numero) || str(ec?.numero) || null,
    complemento: str(address.complemento) || str(ec?.complemento) || null,
    bairro: str(address.bairro) || str(ec?.bairro) || null,
    cidade: str(address.cidade) || str(ec?.cidade) || null,
    uf: str(address.uf || ec?.estado).toUpperCase() || null,
    fonte: "tenant_cadastral",
  };
}

function emailContatoTenant(settings: unknown): string | null {
  if (!settings || typeof settings !== "object") return null;
  const contact = (settings as Record<string, unknown>).primary_contact;
  if (!contact || typeof contact !== "object") return null;
  const email = str((contact as Record<string, unknown>).email);
  return email || null;
}

export async function carregarUsuarioCobrancaTenant(
  supabase: SupabaseClient,
  tenantId: string,
  settings?: unknown,
): Promise<UserBillingRow | null> {
  const baseQuery = () =>
    supabase
      .from("users")
      .select(USER_BILLING_SELECT)
      .eq("tenant_id", tenantId)
      .eq("status", "Ativo");

  let { data, error } = await baseQuery().eq("owner", false);

  if (error && /owner|document|billing_/i.test(error.message)) {
    ({ data, error } = await baseQuery());
  }

  if ((!data?.length || error) && settings) {
    const email = emailContatoTenant(settings);
    if (email) {
      const byEmail = await supabase
        .from("users")
        .select(USER_BILLING_SELECT)
        .eq("status", "Ativo")
        .ilike("email", email)
        .limit(5);
      if (!byEmail.error && byEmail.data?.length) {
        data = byEmail.data;
        error = null;
      }
    }
  }

  if (error || !data?.length) return null;

  const tenantUsers = data.filter(
    (row) =>
      row.owner !== true &&
      String(row.role ?? "")
        .trim()
        .toLowerCase() !== "platform_admin",
  );
  if (!tenantUsers.length) return null;

  const pool = tenantUsers;

  const sorted = [...pool].sort(
    (a, b) => rolePriority(a.role as string) - rolePriority(b.role as string),
  );

  const comDocumento = sorted.find((row) =>
    documentoProntoParaCora(
      onlyDigits(row.document),
      row.document_type === "CPF" || row.document_type === "CNPJ" ? row.document_type : null,
    ),
  );

  return (comDocumento ?? sorted[0]) as UserBillingRow;
}

function mesclarCamposPerfil(
  base: UserBillingProfile,
  extra: UserBillingProfile | null,
): UserBillingProfile {
  if (!extra) return base;
  return {
    ...base,
    email: base.email || extra.email,
    phone: base.phone || extra.phone,
    legal_name: base.legal_name || extra.legal_name,
    cep: base.cep || extra.cep,
    logradouro: base.logradouro || extra.logradouro,
    numero: base.numero || extra.numero,
    complemento: base.complemento || extra.complemento,
    bairro: base.bairro || extra.bairro,
    cidade: base.cidade || extra.cidade,
    uf: base.uf || extra.uf,
    fonte: base.fonte === "user" ? "merged" : base.fonte,
  };
}

export async function resolverPerfilCobrancaTenant(
  supabase: SupabaseClient,
  tenantId: string,
  cadastral: TenantEmpresaCadastral | null,
  nomeExibicao?: string | null,
  settings?: unknown,
): Promise<UserBillingProfile | null> {
  const billingUser = await carregarUsuarioCobrancaTenant(supabase, tenantId, settings);
  const fromUser = perfilCobrancaFromUserRow(billingUser);
  const fromSettings = perfilCobrancaFromTenantSettings(settings, nomeExibicao);
  const fromCadastral = perfilCobrancaFromTenantCadastral(cadastral, nomeExibicao);

  let profile = escolherPerfilCobrancaBase(fromUser, fromSettings, fromCadastral);
  if (!profile) return null;

  profile = mesclarCamposPerfil(profile, fromCadastral);
  profile = mesclarCamposPerfil(profile, fromSettings);

  if (fromUser && (fromCadastral || fromSettings)) {
    profile = { ...profile, fonte: "merged" };
  }

  return profile;
}

export type SalvarBillingInput = {
  document_type: CoraDocumentType;
  document: string;
  billing_legal_name: string;
  email: string;
  phone?: string | null;
  billing_cep?: string | null;
  billing_logradouro?: string | null;
  billing_numero?: string | null;
  billing_complemento?: string | null;
  billing_bairro?: string | null;
  billing_cidade?: string | null;
  billing_uf?: string | null;
};

/** Grava faturamento no owner do tenant e espelha em hub_tenants.settings. */
export async function salvarPerfilCobrancaTenant(
  supabase: SupabaseClient,
  tenantId: string,
  input: SalvarBillingInput,
): Promise<{ ok: true; profile: UserBillingProfile } | { ok: false; error: string }> {
  const document = onlyDigits(input.document);
  if (!documentoProntoParaCora(document, input.document_type)) {
    return { ok: false, error: `${input.document_type} inválido ou incompleto.` };
  }

  const { data: tenant, error: tenantErr } = await supabase
    .from("hub_tenants")
    .select("settings, nome_exibicao")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantErr) return { ok: false, error: tenantErr.message };
  if (!tenant) return { ok: false, error: "Tenant não encontrado." };

  const prevSettings =
    tenant.settings && typeof tenant.settings === "object"
      ? (tenant.settings as Record<string, unknown>)
      : {};

  const isPj = input.document_type === "CNPJ";
  const address = {
    cep: onlyDigits(input.billing_cep ?? ""),
    logradouro: input.billing_logradouro?.trim() || null,
    numero: input.billing_numero?.trim() || null,
    complemento: input.billing_complemento?.trim() || null,
    bairro: input.billing_bairro?.trim() || null,
    cidade: input.billing_cidade?.trim() || null,
    uf: input.billing_uf?.trim()?.toUpperCase() || null,
  };

  const settings = {
    ...prevSettings,
    registration_type: isPj ? "PJ" : "PF",
    cpf: isPj ? null : document,
    cnpj: isPj ? document : null,
    trade_name: input.billing_legal_name.trim(),
    address,
    primary_contact: {
      name: input.billing_legal_name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: onlyDigits(input.phone ?? ""),
    },
    empresa_cadastral: isPj
      ? {
          ...(typeof prevSettings.empresa_cadastral === "object"
            ? (prevSettings.empresa_cadastral as Record<string, unknown>)
            : {}),
          cnpj: document,
          razao_social: input.billing_legal_name.trim(),
          email: input.email.trim(),
          telefone: onlyDigits(input.phone ?? ""),
          cep: address.cep,
          logradouro: address.logradouro,
          numero: address.numero,
          complemento: address.complemento,
          bairro: address.bairro,
          cidade: address.cidade,
          estado: address.uf,
          atualizado_em: new Date().toISOString(),
        }
      : prevSettings.empresa_cadastral,
  };

  const { error: settingsErr } = await supabase
    .from("hub_tenants")
    .update({
      settings,
      nome_exibicao: input.billing_legal_name.trim().slice(0, 200),
    })
    .eq("id", tenantId);

  if (settingsErr) return { ok: false, error: settingsErr.message };

  const billingUser = await carregarUsuarioCobrancaTenant(supabase, tenantId, settings);
  const userFields: Record<string, unknown> = {
    document_type: input.document_type,
    document,
    billing_legal_name: input.billing_legal_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: onlyDigits(input.phone ?? "") || null,
    billing_cep: address.cep || null,
    billing_logradouro: address.logradouro,
    billing_numero: address.numero,
    billing_complemento: address.complemento,
    billing_bairro: address.bairro,
    billing_cidade: address.cidade,
    billing_uf: address.uf,
    tenant_id: tenantId,
    owner: false,
  };

  if (billingUser?.id) {
    const { error: userErr } = await supabase
      .from("users")
      .update(userFields)
      .eq("id", billingUser.id);
    if (userErr && !/document|billing_/i.test(userErr.message)) {
      return { ok: false, error: userErr.message };
    }
  } else {
    const email = input.email.trim().toLowerCase();
    const { data: byEmail } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (byEmail?.id) {
      await supabase
        .from("users")
        .update({ ...userFields, name: input.billing_legal_name.trim() })
        .eq("id", byEmail.id);
    }
  }

  const profile: UserBillingProfile = {
    user_id: billingUser?.id ?? null,
    name: input.billing_legal_name.trim(),
    email: input.email.trim(),
    phone: onlyDigits(input.phone ?? "") || null,
    document_type: input.document_type,
    document,
    legal_name: input.billing_legal_name.trim(),
    cep: address.cep || null,
    logradouro: address.logradouro,
    numero: address.numero,
    complemento: address.complemento,
    bairro: address.bairro,
    cidade: address.cidade,
    uf: address.uf,
    fonte: billingUser?.id ? "user" : "tenant_cadastral",
  };

  return { ok: true, profile };
}

/** Copia dados do tenant para users antes da emissão Cora. */
export async function sincronizarBillingDoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  settings: unknown,
  nomeExibicao?: string | null,
  cadastral?: TenantEmpresaCadastral | null,
): Promise<void> {
  const billingUser = await carregarUsuarioCobrancaTenant(supabase, tenantId, settings);
  if (!billingUser?.id) return;

  const fromUser = perfilCobrancaFromUserRow(billingUser);
  const fromSettings = perfilCobrancaFromTenantSettings(settings, nomeExibicao);
  const fromCadastral = perfilCobrancaFromTenantCadastral(cadastral ?? null, nomeExibicao);
  const profile = escolherPerfilCobrancaBase(fromUser, fromSettings, fromCadastral);
  if (!profile) return;

  const docUser = onlyDigits(billingUser.document);
  const needsSync =
    !documentoProntoParaCora(billingUser.document, billingUser.document_type as CoraDocumentType) ||
    !str(billingUser.billing_legal_name) ||
    docUser !== profile.document;

  if (!needsSync) return;

  await supabase
    .from("users")
    .update({
      tenant_id: tenantId,
      owner: false,
      document_type: profile.document_type,
      document: profile.document,
      billing_legal_name: profile.legal_name,
      email: profile.email || billingUser.email,
      phone: profile.phone,
      billing_cep: profile.cep,
      billing_logradouro: profile.logradouro,
      billing_numero: profile.numero,
      billing_complemento: profile.complemento,
      billing_bairro: profile.bairro,
      billing_cidade: profile.cidade,
      billing_uf: profile.uf,
    })
    .eq("id", billingUser.id);
}

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { isValidCnpj, isValidCpf, onlyDigits } from "@/lib/brasil-docs";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { billingFieldsFromOnboarding } from "@/lib/hub/user-billing-cadastral";

type Payload = {
  registrationType?: "PJ" | "PF";
  authUserId?: string;
  companyName?: string;
  tradeName?: string;
  cpf?: string;
  cnpj?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function POST(request: NextRequest) {
  const cfgErr = crmConfigError();
  if (cfgErr) return NextResponse.json({ ok: false, error: cfgErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Payload;
  const registrationType = body.registrationType === "PF" ? "PF" : "PJ";
  const cpf = onlyDigits(body.cpf ?? "");
  const cnpj = onlyDigits(body.cnpj ?? "");
  if (registrationType === "PJ" && !isValidCnpj(cnpj)) {
    return NextResponse.json({ ok: false, error: "CNPJ inválido." }, { status: 400 });
  }
  if (registrationType === "PF" && !isValidCpf(cpf)) {
    return NextResponse.json({ ok: false, error: "CPF inválido." }, { status: 400 });
  }

  const companyName = String(body.companyName ?? "").trim();
  const contactName = String(body.contactName ?? "").trim();
  const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase();
  const authUserId = String(body.authUserId ?? "").trim();
  if (!companyName || !contactName || !contactEmail) {
    return NextResponse.json(
      { ok: false, error: "Preencha empresa, contato e e-mail." },
      { status: 400 },
    );
  }

  const db = crmDb();
  const slugSource =
    body.tradeName?.trim() ||
    companyName ||
    (registrationType === "PJ" ? cnpj : cpf) ||
    `tenant-${randomSuffix()}`;
  const baseSlug = slugify(slugSource) || `tenant-${randomSuffix()}`;
  const candidateSlug = `${baseSlug}-${randomSuffix()}`;

  const documentField = registrationType === "PJ" ? "cnpj" : "cpf";
  const documentValue = registrationType === "PJ" ? cnpj : cpf;

  const existsCheck = await db
    .from("hub_tenants")
    .select("id, slug")
    .filter(`settings->>${documentField}`, "eq", documentValue)
    .maybeSingle();

  if (existsCheck.error && !isMissingPgColumn(existsCheck.error, "settings")) {
    return NextResponse.json(
      { ok: false, error: existsCheck.error.message },
      { status: 500 },
    );
  }

  const existsByDocument = existsCheck.data;

  if (existsByDocument) {
    return NextResponse.json(
      {
        ok: false,
        error: `Já existe tenant cadastrado para este ${registrationType === "PJ" ? "CNPJ" : "CPF"}.`,
      },
      { status: 409 },
    );
  }

  let insert = await db
    .from("hub_tenants")
    .insert({
      slug: candidateSlug,
      nome_exibicao: companyName,
      ativo: true,
      settings: {
        registration_type: registrationType,
        cpf: registrationType === "PF" ? cpf : null,
        cnpj: registrationType === "PJ" ? cnpj : null,
        trade_name: body.tradeName?.trim() || null,
        address: {
          cep: onlyDigits(body.cep ?? ""),
          logradouro: body.logradouro?.trim() || null,
          numero: body.numero?.trim() || null,
          complemento: body.complemento?.trim() || null,
          bairro: body.bairro?.trim() || null,
          cidade: body.cidade?.trim() || null,
          uf: body.uf?.trim()?.toUpperCase() || null,
        },
        primary_contact: {
          name: contactName,
          email: contactEmail,
          phone: onlyDigits(body.contactPhone ?? ""),
        },
        source: "public_landing_tivfia",
      },
    });

  if (insert.error && isMissingPgColumn(insert.error, "settings")) {
    insert = await db
      .from("hub_tenants")
      .insert({
        slug: candidateSlug,
        nome_exibicao: companyName,
        ativo: true,
      });
  }

  if (insert.error) {
    return NextResponse.json(
      { ok: false, error: insert.error.message ?? "Não foi possível criar o tenant." },
      { status: 500 },
    );
  }

  const { data, error } = await db
    .from("hub_tenants")
    .select("id, slug, nome_exibicao")
    .eq("slug", candidateSlug)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Não foi possível criar o tenant." },
      { status: 500 },
    );
  }

  if (authUserId) {
    const billingFields = billingFieldsFromOnboarding({
      registrationType,
      companyName,
      tradeName: body.tradeName,
      cpf,
      cnpj,
      cep: body.cep,
      logradouro: body.logradouro,
      numero: body.numero,
      complemento: body.complemento,
      bairro: body.bairro,
      cidade: body.cidade,
      uf: body.uf,
      contactName,
      contactEmail,
      contactPhone: body.contactPhone,
    });

    const userInsert = await db.from("users").upsert(
      {
        auth_id: authUserId,
        email: contactEmail,
        role: "owner",
        status: "Ativo",
        tenant_id: data.id,
        owner: false,
        ...billingFields,
      },
      { onConflict: "auth_id" },
    );
    if (userInsert.error && isMissingPgColumn(userInsert.error, "document")) {
      const { document: _d, document_type: _t, billing_legal_name: _n, ...legacy } =
        billingFields;
      const fallback = await db.from("users").upsert(
        {
          auth_id: authUserId,
          email: contactEmail,
          name: contactName,
          phone: onlyDigits(body.contactPhone ?? "") || null,
          role: "owner",
          status: "Ativo",
          tenant_id: data.id,
          owner: false,
        },
        { onConflict: "auth_id" },
      );
      if (fallback.error) {
        console.error("[onboarding/tenant] failed to upsert public.users:", fallback.error);
      }
    } else if (userInsert.error) {
      console.error("[onboarding/tenant] failed to upsert public.users:", userInsert.error);
    }
  }

  return NextResponse.json({
    ok: true,
    tenant: data,
    message:
      "Cadastro inicial criado. Próximo passo: provisionar usuário owner em auth.users/public.users.",
  });
}

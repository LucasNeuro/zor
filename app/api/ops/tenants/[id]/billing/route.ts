import { NextRequest, NextResponse } from "next/server";
import { isValidCnpj, isValidCpf, onlyDigits } from "@/lib/brasil-docs";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  avaliarEmissaoCoraTenant,
  cadastroProntoParaCora,
  formatarCnpj,
  resumoEnderecoCadastral,
} from "@/lib/ops/cora-mensalidade";
import { lerEmpresaCadastralTenant } from "@/lib/hub/tenant-empresa-cadastral";
import {
  resolverPerfilCobrancaTenant,
  resumoEnderecoPerfilCobranca,
  salvarPerfilCobrancaTenant,
  sincronizarBillingDoTenant,
  type CoraDocumentType,
  type SalvarBillingInput,
} from "@/lib/hub/user-billing-cadastral";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

function formatarDocumento(document: string, tipo: CoraDocumentType): string {
  const d = onlyDigits(document);
  if (tipo === "CPF" && d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return formatarCnpj(d) || document;
}

function mapCadastroResponse(
  billing: Awaited<ReturnType<typeof resolverPerfilCobrancaTenant>>,
  cadastral: Awaited<ReturnType<typeof lerEmpresaCadastralTenant>>["cadastral"],
) {
  const coraEmissao = avaliarEmissaoCoraTenant(
    billing?.document ?? cadastral?.cnpj ?? null,
    billing?.document_type ?? "CNPJ",
  );
  const pronto = cadastroProntoParaCora(billing, cadastral) && !coraEmissao.bloqueado;
  const docLabel = billing
    ? formatarDocumento(billing.document, billing.document_type)
    : formatarCnpj(cadastral?.cnpj ?? null) || null;

  return {
    documento: docLabel,
    documento_tipo: billing?.document_type ?? (cadastral?.cnpj ? "CNPJ" : null),
    documento_raw: billing?.document ?? onlyDigits(cadastral?.cnpj ?? "") || null,
    cnpj: docLabel,
    razao_social: billing?.legal_name ?? cadastral?.razao_social ?? null,
    nome_fantasia: cadastral?.nome_fantasia ?? null,
    email: billing?.email ?? cadastral?.email ?? null,
    telefone: billing?.phone ?? cadastral?.telefone ?? null,
    endereco: resumoEnderecoPerfilCobranca(billing) ?? resumoEnderecoCadastral(cadastral),
    billing_cep: billing?.cep ?? cadastral?.cep ?? null,
    billing_logradouro: billing?.logradouro ?? cadastral?.logradouro ?? null,
    billing_numero: billing?.numero ?? cadastral?.numero ?? null,
    billing_complemento: billing?.complemento ?? cadastral?.complemento ?? null,
    billing_bairro: billing?.bairro ?? cadastral?.bairro ?? null,
    billing_cidade: billing?.cidade ?? cadastral?.cidade ?? null,
    billing_uf: billing?.uf ?? cadastral?.estado ?? null,
    billing_fonte: billing?.fonte ?? null,
    pronto_cora: pronto,
    cora_emissao_bloqueada: coraEmissao.bloqueado,
    cora_emissao_motivo: coraEmissao.motivo,
  };
}

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(_request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  const db = crmDb();
  const { data: tenant, error } = await db
    .from("hub_tenants")
    .select("id, nome_exibicao, settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado." }, { status: 404 });

  const { cadastral, nome_exibicao } = await lerEmpresaCadastralTenant(db, tenantId);
  await sincronizarBillingDoTenant(db, tenantId, tenant.settings, nome_exibicao, cadastral);
  const billing = await resolverPerfilCobrancaTenant(
    db,
    tenantId,
    cadastral,
    nome_exibicao,
    tenant.settings,
  );

  return NextResponse.json({ data: mapCadastroResponse(billing, cadastral) });
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  let body: Partial<SalvarBillingInput> & { document_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const document_type = body.document_type === "CPF" ? "CPF" : "CNPJ";
  const document = onlyDigits(body.document ?? "");
  const billing_legal_name = String(body.billing_legal_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!billing_legal_name || !email) {
    return NextResponse.json(
      { error: "Informe razão social/nome e e-mail do cliente." },
      { status: 400 },
    );
  }

  if (document_type === "CNPJ" && !isValidCnpj(document)) {
    return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
  }
  if (document_type === "CPF" && !isValidCpf(document)) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }

  const input: SalvarBillingInput = {
    document_type,
    document,
    billing_legal_name,
    email,
    phone: body.phone ?? null,
    billing_cep: body.billing_cep ?? null,
    billing_logradouro: body.billing_logradouro ?? null,
    billing_numero: body.billing_numero ?? null,
    billing_complemento: body.billing_complemento ?? null,
    billing_bairro: body.billing_bairro ?? null,
    billing_cidade: body.billing_cidade ?? null,
    billing_uf: body.billing_uf ?? null,
  };

  const saved = await salvarPerfilCobrancaTenant(crmDb(), tenantId, input);
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 422 });
  }

  const { cadastral } = await lerEmpresaCadastralTenant(crmDb(), tenantId);
  const { data: tenantRow } = await crmDb()
    .from("hub_tenants")
    .select("nome_exibicao, settings")
    .eq("id", tenantId)
    .maybeSingle();
  const billing = await resolverPerfilCobrancaTenant(
    crmDb(),
    tenantId,
    cadastral,
    tenantRow?.nome_exibicao ?? billing_legal_name,
    tenantRow?.settings,
  );

  return NextResponse.json({
    data: mapCadastroResponse(billing ?? saved.profile, cadastral),
    message: "Dados de faturamento salvos. Já pode emitir cobranças para este cliente.",
  });
}

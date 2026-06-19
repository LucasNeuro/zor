import { NextRequest, NextResponse } from "next/server";
import { onlyDigits } from "@/lib/brasil-docs";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  cadastroProntoParaCora,
  formatarCnpj,
  resumoEnderecoCadastral,
  avaliarEmissaoCoraTenant,
} from "@/lib/ops/cora-mensalidade";
import { lerEmpresaCadastralTenant } from "@/lib/hub/tenant-empresa-cadastral";
import {
  resolverPerfilCobrancaTenant,
  resumoEnderecoPerfilCobranca,
  sincronizarBillingDoTenant,
} from "@/lib/hub/user-billing-cadastral";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

function cnpjFromSettings(settings: unknown): string | null {
  if (!settings || typeof settings !== "object") return null;
  const s = settings as Record<string, unknown>;
  const direct = typeof s.cnpj === "string" ? s.cnpj.trim() : "";
  if (direct) return direct;
  const cad = s.empresa_cadastral;
  if (cad && typeof cad === "object") {
    const c = (cad as Record<string, unknown>).cnpj;
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function mapTenantRow(row: {
  id: string;
  slug: string;
  nome_exibicao: string;
  ativo: boolean | null;
  criado_em: string | null;
  trial_ate: string | null;
  settings: unknown;
}) {
  return {
    id: row.id,
    slug: row.slug,
    nome: row.nome_exibicao,
    ativo: row.ativo !== false,
    criado_em: row.criado_em,
    cnpj: cnpjFromSettings(row.settings),
    trial_ate: row.trial_ate,
  };
}

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(_request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  const { data, error } = await crmDb()
    .from("hub_tenants")
    .select("id, slug, nome_exibicao, ativo, criado_em, settings, trial_ate")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Tenant não encontrado." }, { status: 404 });

  const db = crmDb();
  const { cadastral, nome_exibicao } = await lerEmpresaCadastralTenant(db, tenantId);
  await sincronizarBillingDoTenant(db, tenantId, data.settings, nome_exibicao, cadastral);
  const billing = await resolverPerfilCobrancaTenant(
    db,
    tenantId,
    cadastral,
    nome_exibicao,
    data.settings,
  );
  const coraEmissao = avaliarEmissaoCoraTenant(
    billing?.document ?? cadastral?.cnpj ?? null,
    billing?.document_type ?? "CNPJ",
  );
  const pronto = cadastroProntoParaCora(billing, cadastral) && !coraEmissao.bloqueado;
  const docLabel = billing
    ? billing.document_type === "CPF"
      ? billing.document.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
      : formatarCnpj(billing.document) || billing.document
    : formatarCnpj(cadastral?.cnpj ?? null) || null;

  return NextResponse.json({
    data: {
      ...mapTenantRow(data),
      cadastro: billing || cadastral
        ? {
            documento: docLabel,
            documento_tipo: billing?.document_type ?? (cadastral?.cnpj ? "CNPJ" : null),
            documento_raw: billing?.document ?? onlyDigits(cadastral?.cnpj ?? "") || null,
            cnpj: docLabel,
            razao_social: billing?.legal_name ?? cadastral?.razao_social ?? null,
            nome_fantasia: cadastral?.nome_fantasia ?? null,
            email: billing?.email ?? cadastral?.email ?? null,
            telefone: billing?.phone ?? cadastral?.telefone ?? null,
            endereco:
              resumoEnderecoPerfilCobranca(billing) ?? resumoEnderecoCadastral(cadastral),
            billing_cep: billing?.cep ?? cadastral?.cep ?? null,
            billing_logradouro: billing?.logradouro ?? cadastral?.logradouro ?? null,
            billing_numero: billing?.numero ?? cadastral?.numero ?? null,
            billing_bairro: billing?.bairro ?? cadastral?.bairro ?? null,
            billing_cidade: billing?.cidade ?? cadastral?.cidade ?? null,
            billing_uf: billing?.uf ?? cadastral?.estado ?? null,
            billing_fonte: billing?.fonte ?? null,
            pronto_cora: pronto,
            cora_emissao_bloqueada: coraEmissao.bloqueado,
            cora_emissao_motivo: coraEmissao.motivo,
          }
        : {
            documento: null,
            documento_tipo: null,
            cnpj: null,
            razao_social: null,
            nome_fantasia: null,
            email: null,
            telefone: null,
            endereco: null,
            billing_fonte: null,
            pronto_cora: false,
            cora_emissao_bloqueada: false,
            cora_emissao_motivo: null,
          },
    },
  });
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  let body: {
    ativo?: boolean;
    trial_ate?: string | null;
    trial_dias?: number;
    limpar_trial?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  if (body.limpar_trial === true) {
    patch.trial_ate = null;
  } else if (body.trial_ate === null) {
    patch.trial_ate = null;
  } else if (typeof body.trial_ate === "string" && body.trial_ate.trim()) {
    const d = new Date(body.trial_ate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "trial_ate inválido." }, { status: 400 });
    }
    patch.trial_ate = d.toISOString();
  } else if (
    typeof body.trial_dias === "number" &&
    Number.isFinite(body.trial_dias) &&
    body.trial_dias > 0
  ) {
    const d = new Date();
    d.setDate(d.getDate() + Math.round(body.trial_dias));
    patch.trial_ate = d.toISOString();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Informe ativo, trial_dias, trial_ate ou limpar_trial." },
      { status: 400 },
    );
  }

  const { data, error } = await crmDb()
    .from("hub_tenants")
    .update(patch)
    .eq("id", tenantId)
    .select("id, slug, nome_exibicao, ativo, criado_em, settings, trial_ate")
    .maybeSingle();

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("trial_ate") && msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Coluna trial_ate ausente. Execute a migração 20260717140000_hub_tenant_trial_cora.sql no Supabase.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Tenant não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ data: mapTenantRow(data) });
}

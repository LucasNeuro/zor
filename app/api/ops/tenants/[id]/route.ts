import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  cadastroProntoParaCora,
  formatarCnpj,
  resumoEnderecoCadastral,
} from "@/lib/ops/cora-mensalidade";
import { lerEmpresaCadastralTenant } from "@/lib/hub/tenant-empresa-cadastral";
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

  const { cadastral } = await lerEmpresaCadastralTenant(crmDb(), tenantId);

  return NextResponse.json({
    data: {
      ...mapTenantRow(data),
      cadastro: cadastral
        ? {
            cnpj: formatarCnpj(cadastral.cnpj) || null,
            razao_social: cadastral.razao_social || null,
            nome_fantasia: cadastral.nome_fantasia || null,
            email: cadastral.email || null,
            telefone: cadastral.telefone || null,
            endereco: resumoEnderecoCadastral(cadastral),
            pronto_cora: cadastroProntoParaCora(cadastral),
          }
        : {
            cnpj: null,
            razao_social: null,
            nome_fantasia: null,
            email: null,
            telefone: null,
            endereco: null,
            pronto_cora: false,
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

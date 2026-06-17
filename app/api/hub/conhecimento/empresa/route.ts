import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  lerEmpresaCadastralTenant,
  salvarEmpresaCadastralTenant,
  type TenantEmpresaCadastral,
} from "@/lib/hub/tenant-empresa-cadastral";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { normalizarDocumento } from "@/lib/crm/documento-brasil";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseBody(raw: unknown): TenantEmpresaCadastral | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const razao = typeof o.razao_social === "string" ? o.razao_social.trim() : "";
  const fantasia = typeof o.nome_fantasia === "string" ? o.nome_fantasia.trim() : "";
  const cnpj = normalizarDocumento(typeof o.cnpj === "string" ? o.cnpj : "");
  const descricao = typeof o.descricao_curta === "string" ? o.descricao_curta.trim() : "";

  if (!razao && !fantasia && !cnpj && !descricao) return null;

  const str = (k: string) => (typeof o[k] === "string" ? String(o[k]).trim() : "") || null;

  return {
    cnpj,
    razao_social: razao,
    nome_fantasia: fantasia || null,
    situacao_cadastral: str("situacao_cadastral"),
    email: str("email"),
    telefone: str("telefone"),
    cep: str("cep"),
    logradouro: str("logradouro"),
    numero: str("numero"),
    complemento: str("complemento"),
    bairro: str("bairro"),
    cidade: str("cidade"),
    estado: str("estado"),
    cnae_principal: str("cnae_principal"),
    site: str("site"),
    descricao_curta: descricao || null,
    atualizado_em: null,
  };
}

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();
  const { cadastral, nome_exibicao, preenchido_de_cadastro } =
    await lerEmpresaCadastralTenant(supabase, tenantId);

  return NextResponse.json({
    empresa: cadastral,
    nome_exibicao,
    preenchido_de_cadastro,
  });
}

export async function PATCH(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const cadastral = parseBody(body);
  if (!cadastral) {
    return NextResponse.json(
      { error: "Informe ao menos razão social, nome fantasia, CNPJ ou descrição do negócio." },
      { status: 400 }
    );
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();
  const result = await salvarEmpresaCadastralTenant(supabase, tenantId, cadastral);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { cadastral: saved, nome_exibicao, preenchido_de_cadastro } =
    await lerEmpresaCadastralTenant(supabase, tenantId);
  return NextResponse.json({
    ok: true,
    empresa: saved,
    nome_exibicao,
    preenchido_de_cadastro,
  });
}

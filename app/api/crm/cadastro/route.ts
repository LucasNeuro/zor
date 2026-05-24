import { NextRequest, NextResponse } from "next/server";
import { salvarSuperCadastro } from "@/lib/crm/salvar-super-cadastro";
import { validarSuperCadastro } from "@/lib/crm/validar-super-cadastro";
import type { OpenCnpjApiResponse } from "@/lib/crm/opencnpj";
import {
  crmSupabaseAdmin,
  crmSupabaseConfigError,
  insertHubEmpresaCrm,
  insertHubPessoaCrm,
} from "@/lib/crm/hub-insert-crm";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

export async function POST(request: NextRequest) {
  const configErr = crmSupabaseConfigError();
  if (configErr) {
    return NextResponse.json(
      { error: "CRM indisponível: Supabase não configurado.", detail: configErr },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = validarSuperCadastro(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.erro }, { status: 400 });
  }

  const opencnpj =
    body &&
    typeof body === "object" &&
    "opencnpj_snapshot" in body &&
    body.opencnpj_snapshot &&
    typeof body.opencnpj_snapshot === "object"
      ? (body.opencnpj_snapshot as OpenCnpjApiResponse)
      : null;

  const supabase = crmSupabaseAdmin();
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  const result = await salvarSuperCadastro(supabase, parsed.data, {
    tenantId,
    opencnpjSnapshot: opencnpj,
    insertHubPessoa: (row, tid) => insertHubPessoaCrm(supabase, row, tid),
    insertHubEmpresa: (row, tid) => insertHubEmpresaCrm(supabase, row, tid),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status });
  }

  return NextResponse.json(
    {
      data: {
        pessoa_id: result.pessoa_id,
        empresa_id: result.empresa_id ?? null,
        lead_id: result.lead_id ?? null,
        codigo_pessoa: result.codigo_pessoa ?? null,
        codigo_lead: result.codigo_lead ?? null,
        aviso: result.aviso ?? null,
        pessoa: result.pessoa,
      },
    },
    { status: 201 }
  );
}

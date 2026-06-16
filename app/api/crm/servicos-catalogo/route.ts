import { NextRequest, NextResponse } from "next/server";
import { crmDb, crmConfigError } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import {
  listarServicosCatalogo,
  sincronizarServicosFromConhecimento,
} from "@/lib/crm/servicos-catalogo";
import { mensagemErroCatalogo, isCatalogoSchemaMissingError } from "@/lib/crm/schema-status";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const { searchParams } = new URL(request.url);
  const syncIfEmpty = searchParams.get("sync_if_empty") === "1";

  const supabase = crmDb();

  try {
    let data = await listarServicosCatalogo(supabase, tenantId);

    if (!data.length && syncIfEmpty) {
      try {
        await sincronizarServicosFromConhecimento(supabase, tenantId);
        data = await listarServicosCatalogo(supabase, tenantId);
      } catch {
        // Tabela/RPC ainda não aplicada — devolve lista vazia com aviso no cliente.
      }
    }

    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Erro ao listar catálogo de serviços.";
    const message = mensagemErroCatalogo(raw);
    if (message !== raw || isCatalogoSchemaMissingError(raw)) {
      return NextResponse.json(
        {
          error: message,
          data: [],
          total: 0,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const supabase = crmDb();

  try {
    const result = await sincronizarServicosFromConhecimento(supabase, tenantId);
    const data = await listarServicosCatalogo(supabase, tenantId);
    return NextResponse.json({ ...result, data, total: data.length });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Erro ao sincronizar catálogo.";
    const message = mensagemErroCatalogo(raw);
    const status =
      message !== raw || isCatalogoSchemaMissingError(raw) || raw.includes("waje-bootstrap") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

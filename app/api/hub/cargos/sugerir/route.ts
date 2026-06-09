import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  sugerirCargoCatalogoComMistral,
  type CargoCatalogoContextRow,
  type MercadoContextRow,
} from "@/lib/hub/sugerir-cargo-catalogo";
import { cargoTituloFromRow, selectCargosContextoSugerir } from "@/lib/hub/cargo-catalogo-db";
import {
  buscarTrechosAnaliseNegocio,
  buscarTrechosConhecimentoTenant,
  formatarAnaliseNegocioParaPrompt,
  formatarTrechosConhecimentoParaPrompt,
  lerAnaliseNegocioTenant,
} from "@/lib/hub/tenant-conhecimento-rag";
import { tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST { titulo: string }
 * Devolve campos sugeridos para `hub_cargos_catalogo` com base nos cargos e mercados activos no Hub.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) {
    return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });
  }

  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  const [{ data: cargosData, error: cErr }, mercadosQuery] = await Promise.all([
    selectCargosContextoSugerir(supabase),
    supabase.from("hub_mercados").select("sigla,nome,codigo").eq("ativo", true).limit(40),
  ]);

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const cargosExistentes: CargoCatalogoContextRow[] = (cargosData || []).map((r) => ({
    slug: String(r.slug ?? ""),
    titulo: cargoTituloFromRow(r) || null,
    segmento: (r.segmento as string | undefined) ?? null,
    especialidade: (r.especialidade as string | undefined) ?? null,
    nivel: (r.nivel as number | undefined) ?? null,
  }));

  let mercados: MercadoContextRow[] | undefined;
  const { data: mercadosData, error: mErr } = mercadosQuery;
  if (!mErr && mercadosData?.length) {
    mercados = mercadosData.map((r) => ({
      sigla: String((r as { sigla?: string }).sigla ?? (r as { codigo?: string }).codigo ?? ""),
      nome: (r as { nome?: string }).nome ?? null,
    }));
  }

  const [analiseCache, trechosCargo, trechosNegocio] = await Promise.all([
    lerAnaliseNegocioTenant(supabase, tenantId),
    buscarTrechosConhecimentoTenant(
      supabase,
      tenantId,
      `${titulo} atendimento cliente serviço operação`,
      { limit: 4, threshold: 0.58 }
    ),
    buscarTrechosAnaliseNegocio(supabase, tenantId),
  ]);

  const blocos: string[] = [];
  if (analiseCache?.analise) {
    blocos.push(`## Perfil consolidado do negócio\n${formatarAnaliseNegocioParaPrompt(analiseCache.analise)}`);
  }
  const trechos = [...trechosCargo, ...trechosNegocio].filter(
    (t, i, arr) => arr.findIndex((x) => x.conteudo.slice(0, 100) === t.conteudo.slice(0, 100)) === i
  );
  const trechosFmt = formatarTrechosConhecimentoParaPrompt(trechos.slice(0, 8));
  if (trechosFmt) blocos.push(trechosFmt);
  const conhecimentoEmpresa = blocos.join("\n\n");

  const out = await sugerirCargoCatalogoComMistral({
    tituloPedido: titulo,
    cargosExistentes,
    mercados,
    conhecimentoEmpresa: conhecimentoEmpresa || undefined,
  });

  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 502 });
  }

  return NextResponse.json({ sugestao: out.sugestao });
}

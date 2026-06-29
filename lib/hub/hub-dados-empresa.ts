/**
 * Consulta dados operacionais do tenant via views vw_rel_* (agentes internos).
 * Leitura só — sem SQL livre.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RELATORIO_VIEWS_CATALOGO,
  relatorioViewById,
  type RelatorioViewId,
} from "@/lib/crm/relatorio-views-catalog";
import { carregarRelatorio } from "@/lib/crm/relatorios-data";
import { defaultTenantId } from "@/lib/tenant-default";

/** Views sensíveis — bloqueadas para agentes internos. */
const VIEWS_BLOQUEADAS = new Set<RelatorioViewId>(["vw_rel_users_acesso"]);

const VIEWS_PERMITIDAS = new Set<RelatorioViewId>(
  RELATORIO_VIEWS_CATALOGO.map((v) => v.id).filter((id) => !VIEWS_BLOQUEADAS.has(id))
);

const LIMITE_MAX = 50;
const LIMITE_PADRAO = 25;

export function listarViewsHubDadosEmpresa(): Array<{ id: RelatorioViewId; label: string; categoria: string }> {
  return RELATORIO_VIEWS_CATALOGO.filter((v) => VIEWS_PERMITIDAS.has(v.id)).map((v) => ({
    id: v.id,
    label: v.label,
    categoria: v.categoria,
  }));
}

export function viewPermitidaHubDadosEmpresa(viewId: string): viewId is RelatorioViewId {
  return VIEWS_PERMITIDAS.has(viewId as RelatorioViewId);
}

function resumoViewsParaPrompt(): string {
  const porCat = new Map<string, string[]>();
  for (const v of RELATORIO_VIEWS_CATALOGO) {
    if (!VIEWS_PERMITIDAS.has(v.id)) continue;
    const arr = porCat.get(v.categoria) ?? [];
    arr.push(`${v.id} (${v.label})`);
    porCat.set(v.categoria, arr);
  }
  const linhas: string[] = [];
  for (const [cat, ids] of porCat) {
    linhas.push(`- ${cat}: ${ids.join("; ")}`);
  }
  return linhas.join("\n");
}

export const HUB_DADOS_EMPRESA_VIEWS_PROMPT = resumoViewsParaPrompt();

export type HubDadosEmpresaArgs = {
  view: string;
  colunas?: string[];
  limite?: number;
  filtro_texto?: string;
  filtro_coluna?: string;
};

export async function executarHubDadosEmpresa(
  supabase: SupabaseClient,
  tenantId: string,
  args: HubDadosEmpresaArgs,
  ctx: { agenteSlug: string }
): Promise<string> {
  const tenant = tenantId?.trim() || defaultTenantId();
  const viewRaw = String(args.view || "").trim();

  if (!viewRaw) {
    return JSON.stringify({
      erro: "view_obrigatoria",
      views_disponiveis: listarViewsHubDadosEmpresa().slice(0, 12).map((v) => v.id),
      dica: "Use o id vw_rel_* (ex.: vw_rel_leads_enriquecidos, vw_rel_fluxo_caixa).",
    });
  }

  if (!viewPermitidaHubDadosEmpresa(viewRaw)) {
    if (VIEWS_BLOQUEADAS.has(viewRaw as RelatorioViewId)) {
      return JSON.stringify({ erro: "view_restrita", view: viewRaw });
    }
    const def = relatorioViewById(viewRaw);
    if (!def) {
      return JSON.stringify({
        erro: "view_desconhecida",
        view: viewRaw,
        exemplos: ["vw_rel_leads_enriquecidos", "vw_rel_negocios_pipeline", "vw_rel_fluxo_caixa"],
      });
    }
    return JSON.stringify({ erro: "view_nao_permitida", view: viewRaw });
  }

  const limite = Math.min(
    LIMITE_MAX,
    Math.max(1, Number.isFinite(Number(args.limite)) ? Number(args.limite) : LIMITE_PADRAO)
  );

  let colunas: string[] | undefined;
  if (Array.isArray(args.colunas) && args.colunas.length > 0) {
    colunas = args.colunas.map((c) => String(c).trim()).filter(Boolean).slice(0, 20);
  }

  try {
    const dataset = await carregarRelatorio(supabase, viewRaw, tenant, colunas, limite);

    let rows = dataset.rows;
    const filtroCol = String(args.filtro_coluna || "").trim();
    const filtroTxt = String(args.filtro_texto || "").trim().toLowerCase();

    if (filtroTxt && filtroCol && rows.length > 0 && filtroCol in (rows[0] as object)) {
      rows = rows.filter((r) =>
        String((r as Record<string, unknown>)[filtroCol] ?? "")
          .toLowerCase()
          .includes(filtroTxt)
      );
    }

    try {
      await supabase.from("hub_acoes_ia").insert({
        agente_slug: ctx.agenteSlug,
        tipo: "hub_dados_empresa",
        descricao: `Consulta ${viewRaw} (${rows.length} linhas)`,
        tenant_id: tenant,
        metadata: {
          view: viewRaw,
          linhas: rows.length,
          limite,
          filtro_coluna: filtroCol || null,
          filtro_texto: filtroTxt || null,
        },
      });
    } catch {
      /* auditoria opcional */
    }

    return JSON.stringify({
      ok: true,
      view: viewRaw,
      tenant_id: tenant,
      total_linhas: rows.length,
      colunas: dataset.headers,
      linhas: rows,
      ...(dataset.aviso ? { aviso: dataset.aviso } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_consulta";
    return JSON.stringify({ erro: "consulta_falhou", view: viewRaw, detalhe: msg });
  }
}

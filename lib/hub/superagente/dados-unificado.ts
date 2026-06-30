/**
 * Acesso unificado a views vw_rel_* e catálogo completo (superagentes internos).
 * Escrita via hub_operacao_empresa — sem SQL livre.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RELATORIO_VIEWS_CATALOGO,
  type RelatorioViewId,
} from "@/lib/crm/relatorio-views-catalog";
import {
  executarHubDadosEmpresa,
  listarViewsHubDadosEmpresa,
  viewPermitidaHubDadosEmpresa,
} from "@/lib/hub/hub-dados-empresa";
import { carregarRelatorio } from "@/lib/crm/relatorios-data";
import { relatorioViewById } from "@/lib/crm/relatorio-views-catalog";
import { HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT } from "@/lib/hub/hub-operacao-empresa";
import { defaultTenantId } from "@/lib/tenant-default";

const VIEWS_EXTRA_BLOQUEADAS = new Set<RelatorioViewId>(["vw_rel_users_acesso"]);

export function catalogoSuperagenteDadosCompleto(): Array<{
  id: string;
  label: string;
  categoria: string;
  colunas: string[];
  fonte: string;
}> {
  return RELATORIO_VIEWS_CATALOGO.filter((v) => !VIEWS_EXTRA_BLOQUEADAS.has(v.id)).map((v) => ({
    id: v.id,
    label: v.label,
    categoria: v.categoria,
    colunas: v.colunas.slice(0, 24),
    fonte: v.fonte,
  }));
}

export type SuperagenteDadosArgs = {
  acao: "catalogar" | "consultar";
  view?: string;
  colunas?: string[];
  limite?: number;
  filtro_texto?: string;
  filtro_coluna?: string;
  categoria?: string;
};

export async function executarSuperagenteDados(
  supabase: SupabaseClient,
  tenantId: string,
  args: SuperagenteDadosArgs,
  ctx: { agenteSlug: string }
): Promise<string> {
  const acao = args.acao === "consultar" ? "consultar" : "catalogar";
  const tenant = tenantId?.trim() || defaultTenantId();

  if (acao === "catalogar") {
    let items = catalogoSuperagenteDadosCompleto();
    const cat = String(args.categoria || "").trim().toLowerCase();
    if (cat) {
      items = items.filter((i) => i.categoria.toLowerCase() === cat);
    }
    return JSON.stringify({
      ok: true,
      total_views: items.length,
      views: items.slice(0, 40),
      entidades_escrita: "Use hub_operacao_empresa para criar/actualizar registos.",
      entidades_resumo: HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT.split("\n").slice(0, 12),
      views_legado_hub_dados: listarViewsHubDadosEmpresa().slice(0, 8).map((v) => v.id),
      dica: "consultar: acao=consultar, view=vw_rel_* (ex. vw_rel_leads_enriquecidos).",
    });
  }

  const view = String(args.view || "").trim();
  if (!view) {
    return JSON.stringify({ erro: "view_obrigatoria_para_consultar", exemplos: ["vw_rel_fluxo_caixa"] });
  }

  if (VIEWS_EXTRA_BLOQUEADAS.has(view as RelatorioViewId)) {
    return JSON.stringify({ erro: "view_restrita_superagente", view });
  }

  if (viewPermitidaHubDadosEmpresa(view)) {
    return executarHubDadosEmpresa(
      supabase,
      tenant,
      {
        view,
        colunas: args.colunas,
        limite: args.limite,
        filtro_texto: args.filtro_texto,
        filtro_coluna: args.filtro_coluna,
      },
      ctx
    );
  }

  if (!relatorioViewById(view)) {
    return JSON.stringify({ erro: "view_desconhecida", view });
  }

  const limite = Math.min(80, Math.max(1, Number(args.limite) || 25));
  const colunas = Array.isArray(args.colunas)
    ? args.colunas.map((c) => String(c).trim()).filter(Boolean).slice(0, 24)
    : undefined;

  try {
    const dataset = await carregarRelatorio(supabase, view as RelatorioViewId, tenant, colunas, limite);
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
    return JSON.stringify({
      ok: true,
      view,
      superagente_expandido: true,
      total_linhas: rows.length,
      colunas: dataset.headers,
      linhas: rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_consulta";
    return JSON.stringify({ erro: "consulta_falhou", view, detalhe: msg });
  }
}

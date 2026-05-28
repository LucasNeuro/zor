import type { SupabaseClient } from "@supabase/supabase-js";
import { POSTGREST_LEAD_TERMINAIS } from "@/lib/crm/estagio-filters";
import { safeCount } from "@/lib/crm/metricas-safe";

export type FinanceKpis = {
  aPagarAberto: number;
  aReceberAberto: number;
  vencidoTotal: number;
  vencidoPagar: number;
  vencidoReceber: number;
  saldoProjetado: number;
  vence7dTotal: number;
  vence7dCount: number;
};

export type FinanceAcaoItem = {
  label: string;
  valor: number;
  count: number;
  href: string;
  cor: string;
};

export type FinanceAprovacaoResumo = {
  id: string;
  descricao: string;
  tipo: string;
  valor_envolvido: number;
  criado_em: string;
};

export type FinancePipelineResumo = {
  receitaPotencialLeads: number;
  receitaPotencialNegocios: number;
  negociosSitDown: number;
};

export type LancamentoVencimento = {
  id: string;
  tipo: "pagar" | "receber";
  descricao: string;
  valor: number;
  vencimento: string | null;
  status: string;
  diasAte: number | null;
};

export type FinanceDashboardPayload = {
  kpis: FinanceKpis;
  acao: FinanceAcaoItem[];
  aprovacoes: FinanceAprovacaoResumo[];
  pipeline: FinancePipelineResumo;
  proximosVencimentos: LancamentoVencimento[];
};

function hojeLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diasAteVencimento(vencimento: string | null): number | null {
  if (!vencimento) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(`${String(vencimento).slice(0, 10)}T12:00:00`);
  return Math.round((v.getTime() - hoje.getTime()) / 86400000);
}

type ContaRow = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string | null;
  status: string;
};

function somaPendentes(rows: ContaRow[]): number {
  return rows
    .filter((r) => r.status === "pendente")
    .reduce((s, r) => s + Number(r.valor || 0), 0);
}

function filtrarVencidos(rows: ContaRow[], hoje: string): ContaRow[] {
  return rows.filter(
    (r) => r.status === "pendente" && r.vencimento != null && String(r.vencimento).slice(0, 10) < hoje
  );
}

function filtrarVence7d(rows: ContaRow[], hoje: string, limite: string): ContaRow[] {
  return rows.filter((r) => {
    if (r.status !== "pendente" || !r.vencimento) return false;
    const v = String(r.vencimento).slice(0, 10);
    return v >= hoje && v <= limite;
  });
}

export async function aggregateFinanceDashboard(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FinanceDashboardPayload> {
  const hoje = hojeLocalISO();
  const limite7 = addDaysISO(hoje, 7);

  const [pagarRes, receberRes, aprovRes, leadsPipeRes, negPipeRes, negSitRes] =
    await Promise.all([
      supabase
        .from("hub_contas_pagar")
        .select("id, descricao, valor, vencimento, status")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order("vencimento", { ascending: true, nullsFirst: false }),
      supabase
        .from("hub_contas_receber")
        .select("id, descricao, valor, vencimento, status")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order("vencimento", { ascending: true, nullsFirst: false }),
      supabase
        .from("hub_aprovacoes")
        .select("id, descricao, tipo, valor_envolvido, criado_em")
        .eq("status", "pendente")
        .in("tipo", ["pagamento", "financeiro"])
        .order("criado_em", { ascending: false })
        .limit(5),
      supabase
        .from("hub_leads_crm")
        .select("valor_estimado")
        .eq("tenant_id", tenantId)
        .not("estagio", "in", POSTGREST_LEAD_TERMINAIS),
      supabase
        .from("hub_negocios")
        .select("valor_estimado")
        .eq("tenant_id", tenantId)
        .in("status", ["aberto", "em_negociacao"]),
      safeCount(
        supabase
          .from("hub_negocios")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .in("status", ["aberto", "em_negociacao"])
          .eq("etapa", "sit-down")
      ),
    ]);

  const pagar: ContaRow[] = (pagarRes.data ?? []).map((r) => ({
    id: String(r.id),
    descricao: String(r.descricao ?? ""),
    valor: Number(r.valor ?? 0),
    vencimento: r.vencimento != null ? String(r.vencimento) : null,
    status: String(r.status ?? "pendente"),
  }));

  const receber: ContaRow[] = (receberRes.data ?? []).map((r) => ({
    id: String(r.id),
    descricao: String(r.descricao ?? ""),
    valor: Number(r.valor ?? 0),
    vencimento: r.vencimento != null ? String(r.vencimento) : null,
    status: String(r.status ?? "pendente"),
  }));

  const vencidosPagar = filtrarVencidos(pagar, hoje);
  const vencidosReceber = filtrarVencidos(receber, hoje);
  const vence7Pagar = filtrarVence7d(pagar, hoje, limite7);
  const vence7Receber = filtrarVence7d(receber, hoje, limite7);

  const aPagarAberto = somaPendentes(pagar);
  const aReceberAberto = somaPendentes(receber);
  const vencidoPagar = vencidosPagar.reduce((s, r) => s + r.valor, 0);
  const vencidoReceber = vencidosReceber.reduce((s, r) => s + r.valor, 0);
  const vence7dTotal =
    vence7Pagar.reduce((s, r) => s + r.valor, 0) +
    vence7Receber.reduce((s, r) => s + r.valor, 0);

  const kpis: FinanceKpis = {
    aPagarAberto,
    aReceberAberto,
    vencidoTotal: vencidoPagar + vencidoReceber,
    vencidoPagar,
    vencidoReceber,
    saldoProjetado: aReceberAberto - aPagarAberto,
    vence7dTotal,
    vence7dCount: vence7Pagar.length + vence7Receber.length,
  };

  const acao: FinanceAcaoItem[] = [];
  if (vencidosPagar.length > 0) {
    acao.push({
      label: "Contas a pagar vencidas",
      valor: vencidoPagar,
      count: vencidosPagar.length,
      href: "/crm/financeiro/pagar?status=pendente&vencido=1",
      cor: "#f85149",
    });
  }
  if (vencidosReceber.length > 0) {
    acao.push({
      label: "Contas a receber vencidas",
      valor: vencidoReceber,
      count: vencidosReceber.length,
      href: "/crm/financeiro/receber?status=pendente&vencido=1",
      cor: "#d29922",
    });
  }
  if (vence7Pagar.length + vence7Receber.length > 0) {
    acao.push({
      label: "Vencem em 7 dias",
      valor: vence7dTotal,
      count: vence7Pagar.length + vence7Receber.length,
      href: "/crm/financeiro/pagar?status=pendente&proximos=7",
      cor: "#c9a24a",
    });
  }

  const leadsRows = leadsPipeRes.error ? [] : (leadsPipeRes.data ?? []);
  const negRows = negPipeRes.error ? [] : (negPipeRes.data ?? []);
  const receitaPotencialLeads = leadsRows.reduce(
    (s, r) => s + Number((r as { valor_estimado?: number }).valor_estimado ?? 0),
    0
  );
  const receitaPotencialNegocios = negRows.reduce(
    (s, r) => s + Number((r as { valor_estimado?: number }).valor_estimado ?? 0),
    0
  );

  const unified: LancamentoVencimento[] = [
    ...pagar
      .filter((r) => r.status === "pendente")
      .map((r) => ({
        id: r.id,
        tipo: "pagar" as const,
        descricao: r.descricao,
        valor: r.valor,
        vencimento: r.vencimento,
        status: r.status,
        diasAte: diasAteVencimento(r.vencimento),
      })),
    ...receber
      .filter((r) => r.status === "pendente")
      .map((r) => ({
        id: r.id,
        tipo: "receber" as const,
        descricao: r.descricao,
        valor: r.valor,
        vencimento: r.vencimento,
        status: r.status,
        diasAte: diasAteVencimento(r.vencimento),
      })),
  ];

  unified.sort((a, b) => {
    if (!a.vencimento && !b.vencimento) return 0;
    if (!a.vencimento) return 1;
    if (!b.vencimento) return -1;
    return String(a.vencimento).localeCompare(String(b.vencimento));
  });

  const aprovacoes: FinanceAprovacaoResumo[] = (aprovRes.data ?? []).map((a) => ({
    id: String(a.id),
    descricao: String(a.descricao ?? "Aprovação"),
    tipo: String(a.tipo ?? "financeiro"),
    valor_envolvido: Number(a.valor_envolvido ?? 0),
    criado_em: String(a.criado_em),
  }));

  return {
    kpis,
    acao,
    aprovacoes,
    pipeline: {
      receitaPotencialLeads,
      receitaPotencialNegocios,
      negociosSitDown: negSitRes,
    },
    proximosVencimentos: unified.slice(0, 10),
  };
}

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { isMissingPgColumn } from "@/lib/tenant-default";

export type RelatorioEntidade =
  | "leads"
  | "negocios"
  | "empresas"
  | "imoveis"
  | "contas_pagar"
  | "contas_receber"
  | "financeiro";

export type RelatorioDataset = {
  entidade: RelatorioEntidade;
  headers: string[];
  rows: Record<string, unknown>[];
  aviso?: string;
};

const LIMIT = 500;

const SQL_FIX_HINT =
  "docs/sql/relatorios-schema-fix.sql (SQL Editor Supabase → Run → API Reload schema)";

function errorText(error: PostgrestError | null): string {
  if (!error) return "";
  return [error.message, error.details, error.hint, error.code]
    .filter((p) => p != null && String(p).trim())
    .join(" — ");
}

function isTableMissing(error: PostgrestError | null): boolean {
  const m = errorText(error).toLowerCase();
  return m.includes("could not find the table") || (m.includes("does not exist") && m.includes("relation"));
}

type QueryOutcome = {
  rows: Record<string, unknown>[];
  error?: string;
  aviso?: string;
};

/** Relatórios: sem filtro tenant_id; tenta selects alternativos se coluna em falta. */
async function selectSimple(
  supabase: SupabaseClient,
  table: string,
  selectCandidates: string[],
  order: { column: string; ascending: boolean; nullsFirst?: boolean }
): Promise<QueryOutcome> {
  let lastError: PostgrestError | null = null;

  for (const select of selectCandidates) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(order.column, {
        ascending: order.ascending,
        nullsFirst: order.nullsFirst ?? false,
      })
      .limit(LIMIT);

    if (!error) {
      return { rows: (data ?? []) as unknown as Record<string, unknown>[] };
    }

    lastError = error;
    if (!isMissingPgColumn(error)) break;
  }

  if (!lastError) {
    return { rows: [] };
  }

  if (isTableMissing(lastError)) {
    return {
      rows: [],
      aviso: `Tabela ${table} não existe no Supabase. Execute: ${SQL_FIX_HINT}`,
    };
  }

  return { rows: [], error: errorText(lastError) || "Erro ao consultar dados" };
}

export async function carregarRelatorio(
  supabase: SupabaseClient,
  entidade: RelatorioEntidade,
  _tenantId: string
): Promise<RelatorioDataset> {
  if (entidade === "leads") {
    const out = await selectSimple(
      supabase,
      "hub_leads_crm",
      ["nome, telefone, email, origem, estagio, valor_estimado, criado_em"],
      { column: "criado_em", ascending: false }
    );
    if (out.error) throw new Error(out.error);
    const headers = ["nome", "telefone", "email", "origem", "estagio", "valor_estimado", "criado_em"];
    return { entidade, headers, rows: out.rows, aviso: out.aviso };
  }

  if (entidade === "negocios") {
    const out = await selectSimple(
      supabase,
      "hub_negocios",
      [
        "codigo, titulo, prefixo_mercado, etapa, status, valor_estimado, criado_em",
        "codigo, titulo, etapa, status, valor_estimado, criado_em",
      ],
      { column: "criado_em", ascending: false }
    );
    if (out.error) throw new Error(out.error);
    const headers = ["codigo", "titulo", "prefixo_mercado", "etapa", "status", "valor_estimado", "criado_em"];
    return { entidade, headers, rows: out.rows, aviso: out.aviso };
  }

  if (entidade === "empresas") {
    const out = await selectSimple(
      supabase,
      "hub_empresas",
      [
        "razao_social, nome_fantasia, cnpj, segmento, prefixo_mercado, criado_em",
        "razao_social, nome_fantasia, cnpj, segmento, criado_em",
        "razao_social, nome_fantasia, cnpj, criado_em",
      ],
      { column: "criado_em", ascending: false }
    );
    if (out.error) throw new Error(out.error);
    const headers = out.rows[0]
      ? Object.keys(out.rows[0] as object)
      : ["razao_social", "nome_fantasia", "cnpj", "segmento", "prefixo_mercado", "criado_em"];
    return { entidade, headers, rows: out.rows, aviso: out.aviso };
  }

  if (entidade === "imoveis") {
    const out = await selectSimple(
      supabase,
      "hub_imoveis",
      ["codigo, titulo, tipo, status, valor, cidade, estado, criado_em"],
      { column: "criado_em", ascending: false }
    );
    if (out.error) throw new Error(out.error);
    const headers = ["codigo", "titulo", "tipo", "status", "valor", "cidade", "estado", "criado_em"];
    return { entidade, headers, rows: out.rows, aviso: out.aviso };
  }

  if (entidade === "contas_pagar") {
    const out = await selectSimple(
      supabase,
      "hub_contas_pagar",
      ["descricao, valor, vencimento, status, criado_em"],
      { column: "vencimento", ascending: true, nullsFirst: false }
    );
    if (out.error) throw new Error(out.error);
    const headers = ["descricao", "valor", "vencimento", "status", "criado_em"];
    return { entidade, headers, rows: out.rows, aviso: out.aviso };
  }

  if (entidade === "contas_receber") {
    const out = await selectSimple(
      supabase,
      "hub_contas_receber",
      ["descricao, valor, vencimento, status, criado_em"],
      { column: "vencimento", ascending: true, nullsFirst: false }
    );
    if (out.error) throw new Error(out.error);
    const headers = ["descricao", "valor", "vencimento", "status", "criado_em"];
    return { entidade, headers, rows: out.rows, aviso: out.aviso };
  }

  if (entidade === "financeiro") {
    const headers = ["tipo", "descricao", "valor", "vencimento", "status", "criado_em"];
    const [pagarOut, receberOut] = await Promise.all([
      selectSimple(
        supabase,
        "hub_contas_pagar",
        ["descricao, valor, vencimento, status, criado_em"],
        { column: "vencimento", ascending: true, nullsFirst: false }
      ),
      selectSimple(
        supabase,
        "hub_contas_receber",
        ["descricao, valor, vencimento, status, criado_em"],
        { column: "vencimento", ascending: true, nullsFirst: false }
      ),
    ]);

    if (pagarOut.error) throw new Error(pagarOut.error);
    if (receberOut.error) throw new Error(receberOut.error);

    const rows: Record<string, unknown>[] = [
      ...pagarOut.rows.map((r) => ({ tipo: "pagar", ...r })),
      ...receberOut.rows.map((r) => ({ tipo: "receber", ...r })),
    ];

    const aviso = [pagarOut.aviso, receberOut.aviso].filter(Boolean).join(" ");

    return { entidade, headers, rows, ...(aviso ? { aviso } : {}) };
  }

  throw new Error(
    "entidade inválida (leads|negocios|empresas|imoveis|contas_pagar|contas_receber|financeiro)"
  );
}

export const RELATORIO_ENTIDADES_UI = [
  { id: "leads" as const, label: "Leads" },
  { id: "negocios" as const, label: "Negócios" },
  { id: "empresas" as const, label: "Empresas" },
  { id: "imoveis" as const, label: "Imóveis" },
  { id: "financeiro" as const, label: "Financeiro" },
];

export const RELATORIO_HEADER_LABELS: Record<string, string> = {
  nome: "Nome",
  telefone: "Telefone",
  email: "E-mail",
  origem: "Origem",
  estagio: "Estágio",
  valor_estimado: "Valor estimado",
  criado_em: "Criado em",
  codigo: "Código",
  titulo: "Título",
  prefixo_mercado: "Mercado",
  etapa: "Etapa",
  status: "Status",
  razao_social: "Razão social",
  nome_fantasia: "Nome fantasia",
  cnpj: "CNPJ",
  segmento: "Segmento",
  mercado: "Mercado",
  tipo: "Tipo",
  valor: "Valor",
  cidade: "Cidade",
  estado: "Estado",
  descricao: "Descrição",
  vencimento: "Vencimento",
};

export function formatarCelulaRelatorio(header: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (header === "valor_estimado" || header === "valor") {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
  }
  if (header === "criado_em" || header === "vencimento") {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  return String(value);
}

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { isMissingPgColumn } from "@/lib/tenant-default";
import {
  relatorioViewById,
  resolveRelatorioViewId,
  type RelatorioEntidade,
  type RelatorioViewId,
} from "@/lib/crm/relatorio-views-catalog";
import { colunasFallbackView } from "@/lib/crm/relatorio-view-columns-fallback";

export type { RelatorioEntidade, RelatorioViewId };

export type RelatorioColunasMeta = {
  viewId: RelatorioViewId;
  disponiveis: string[];
  recomendadas: string[];
  aviso?: string;
};

const COLUNAS_OCULTAS = new Set(["tenant_id", "id"]);

export type RelatorioDataset = {
  viewId: RelatorioViewId;
  headers: string[];
  rows: Record<string, unknown>[];
  aviso?: string;
};

const LIMIT = 500;

const SQL_FIX_HINT =
  "docs/sql/waje-bootstrap-prioridade.sql (Supabase SQL Editor → Run → Settings → Reload schema)";

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

async function selectFromSource(
  supabase: SupabaseClient,
  table: string,
  select: string,
  order: { column: string; ascending: boolean; nullsFirst?: boolean },
  tenantId?: string,
  rowLimit = LIMIT
): Promise<QueryOutcome> {
  let query = supabase.from(table).select(select);
  const tenant = tenantId?.trim();
  if (tenant) {
    query = query.eq("tenant_id", tenant);
  }
  const { data, error } = await query
    .order(order.column, {
      ascending: order.ascending,
      nullsFirst: order.nullsFirst ?? false,
    })
    .limit(rowLimit);

  if (!error) {
    return { rows: (data ?? []) as unknown as Record<string, unknown>[] };
  }

  if (isTableMissing(error)) {
    return {
      rows: [],
      aviso: `Fonte ${table} não existe no Supabase. Execute: ${SQL_FIX_HINT}`,
    };
  }

  return { rows: [], error: errorText(error) || "Erro ao consultar dados" };
}

function ordenarColunas(disponiveis: string[], recomendadas: string[]): string[] {
  const recSet = new Set(recomendadas);
  const rec = recomendadas.filter((c) => disponiveis.includes(c));
  const rest = disponiveis
    .filter((c) => !recSet.has(c))
    .sort((a, b) => labelColunaRelatorio(a).localeCompare(labelColunaRelatorio(b), "pt"));
  return [...rec, ...rest];
}

function filtrarColunasVisiveis(keys: string[]): string[] {
  return keys.filter((k) => !COLUNAS_OCULTAS.has(k));
}

async function descobrirColunasFonte(
  supabase: SupabaseClient,
  fonte: string,
  tableFallback?: { table: string; select: string }
): Promise<{ keys: string[]; aviso?: string }> {
  const { data, error } = await supabase.from(fonte).select("*").limit(1);
  if (!error && data?.[0]) {
    return { keys: filtrarColunasVisiveis(Object.keys(data[0] as object)) };
  }

  if (tableFallback) {
    const fb = await supabase.from(tableFallback.table).select(tableFallback.select).limit(1);
    if (!fb.error && fb.data?.[0]) {
      return {
        keys: filtrarColunasVisiveis(Object.keys(fb.data[0] as object)),
        aviso: `View ${fonte} indisponível; colunas da tabela ${tableFallback.table}.`,
      };
    }
    const parsed = tableFallback.select.split(",").map((s) => s.trim()).filter(Boolean);
    if (parsed.length) return { keys: parsed, aviso: `Colunas do catálogo (${tableFallback.table}).` };
  }

  if (isTableMissing(error)) {
    return { keys: [], aviso: `Fonte ${fonte} não existe no Supabase. Execute: ${SQL_FIX_HINT}` };
  }

  return { keys: [] };
}

/** Lista todas as colunas da view (live + fallback do catálogo). */
export async function listarColunasRelatorio(
  supabase: SupabaseClient,
  viewIdOrEntidade: RelatorioViewId | RelatorioEntidade | string
): Promise<RelatorioColunasMeta> {
  const viewId = resolveRelatorioViewId(viewIdOrEntidade);
  const def = relatorioViewById(viewId);
  if (!def) throw new Error(`view_id inválido: ${viewIdOrEntidade}`);

  const recomendadas = def.colunas;
  const discovered = await descobrirColunasFonte(supabase, def.fonte, def.tableFallback);
  let disponiveis = discovered.keys;

  if (!disponiveis.length) {
    disponiveis = colunasFallbackView(viewId);
  }

  if (!disponiveis.length) {
    disponiveis = recomendadas;
  }

  const merged = [...new Set([...recomendadas, ...disponiveis])];
  return {
    viewId,
    disponiveis: ordenarColunas(merged, recomendadas),
    recomendadas,
    ...(discovered.aviso ? { aviso: discovered.aviso } : {}),
  };
}

export function labelColunaRelatorio(key: string): string {
  return RELATORIO_HEADER_LABELS[key] ?? key.replace(/_/g, " ");
}

async function carregarFluxoCaixaFallback(
  supabase: SupabaseClient,
  tenantId?: string,
  rowLimit = LIMIT
): Promise<QueryOutcome> {
  const receber = await selectFromSource(
    supabase,
    "hub_contas_receber",
    "descricao, valor, vencimento, status, criado_em",
    { column: "vencimento", ascending: true },
    tenantId,
    rowLimit
  );
  if (receber.error || (receber.aviso && receber.rows.length === 0)) {
    return receber;
  }

  const pagar = await selectFromSource(
    supabase,
    "hub_contas_pagar",
    "descricao, valor, vencimento, status, criado_em",
    { column: "vencimento", ascending: true },
    tenantId,
    rowLimit
  );

  const rows: Record<string, unknown>[] = [
    ...receber.rows.map((r) => ({ tipo: "receber", ...r } as Record<string, unknown>)),
    ...(pagar.rows ?? []).map((r) => ({ tipo: "pagar", ...r } as Record<string, unknown>)),
  ].sort((a, b) => {
    const da = String(a.vencimento ?? "");
    const db = String(b.vencimento ?? "");
    return da.localeCompare(db);
  });

  return {
    rows: rows.slice(0, rowLimit),
    aviso:
      receber.aviso ||
      pagar.aviso ||
      "View vw_rel_fluxo_caixa indisponível; dados unidos das tabelas hub_contas_receber e hub_contas_pagar.",
  };
}

/** Carrega dataset por view_id (ou entidade legada). */
export async function carregarRelatorio(
  supabase: SupabaseClient,
  viewIdOrEntidade: RelatorioViewId | RelatorioEntidade | string,
  tenantId: string,
  colunasSelecionadas?: string[],
  rowLimit = LIMIT
): Promise<RelatorioDataset> {
  const viewId = resolveRelatorioViewId(viewIdOrEntidade);
  const def = relatorioViewById(viewId);
  if (!def) {
    throw new Error(`view_id inválido: ${viewIdOrEntidade}`);
  }

  const colunas =
    colunasSelecionadas && colunasSelecionadas.length > 0
      ? colunasSelecionadas
      : def.colunas;

  let out: QueryOutcome;

  if (viewId === "vw_rel_fluxo_caixa") {
    out = await selectFromSource(
      supabase,
      def.fonte,
      colunas.join(", "),
      {
        column: def.orderColumn,
        ascending: def.orderAsc ?? false,
      },
      tenantId,
      rowLimit
    );
    if (out.error || out.aviso) {
      out = await carregarFluxoCaixaFallback(supabase, tenantId, rowLimit);
    }
  } else {
    const select = colunas.join(", ");
    out = await selectFromSource(
      supabase,
      def.fonte,
      select,
      {
        column: def.orderColumn,
        ascending: def.orderAsc ?? false,
      },
      tenantId,
      rowLimit
    );

    if ((out.error || out.aviso) && def.tableFallback) {
      out = await selectFromSource(
        supabase,
        def.tableFallback.table,
        def.tableFallback.select,
        {
          column: def.orderColumn,
          ascending: def.orderAsc ?? false,
        },
        tenantId,
        rowLimit
      );
      if (!out.error && out.rows.length >= 0) {
        out.aviso = out.aviso || `View ${def.fonte} indisponível; dados da tabela ${def.tableFallback.table}.`;
      }
    }
  }

  if (out.error) throw new Error(out.error);

  const headers =
    colunasSelecionadas && colunasSelecionadas.length > 0
      ? colunasSelecionadas.filter((c) => out.rows.length === 0 || c in (out.rows[0] as object))
      : out.rows.length > 0
        ? colunas.filter((c) => c in (out.rows[0] as object))
        : colunas.length > 0
          ? colunas
          : out.rows[0]
            ? Object.keys(out.rows[0] as object)
            : [];

  return {
    viewId,
    headers: headers.length > 0 ? headers : colunas,
    rows: out.rows,
    ...(out.aviso ? { aviso: out.aviso } : {}),
  };
}

export { RELATORIO_ENTIDADES_UI } from "@/lib/crm/relatorio-views-catalog";

export const RELATORIO_HEADER_LABELS: Record<string, string> = {
  nome: "Nome",
  name: "Nome",
  telefone: "Telefone",
  email: "E-mail",
  email_exibicao: "E-mail",
  origem: "Origem",
  estagio: "Estágio",
  estagio_atendimento: "Estágio atendimento",
  estagio_funil: "Estágio funil",
  valor_estimado: "Valor estimado",
  valor_fechado: "Valor fechado",
  criado_em: "Criado em",
  atualizado_em: "Atualizado em",
  created_at: "Criado em",
  codigo: "Código",
  titulo: "Título",
  etapa: "Etapa",
  status: "Status",
  tipo: "Tipo",
  valor: "Valor",
  cidade: "Cidade",
  estado: "Estado",
  descricao: "Descrição",
  vencimento: "Vencimento",
  lead_nome: "Lead",
  lead_telefone: "Tel. lead",
  lead_estagio: "Estágio lead",
  pessoa_nome: "Pessoa",
  pessoa_codigo: "Cód. pessoa",
  pessoa_cidade: "Cidade pessoa",
  empresa_nome: "Empresa",
  empresa_cnpj: "CNPJ empresa",
  pipeline_nome: "Pipeline",
  negocio_titulo: "Negócio",
  negocio_codigo: "Cód. negócio",
  conteudo: "Conteúdo",
  criado_por: "Criado por",
  feito_por: "Feito por",
  feito_por_tipo: "Tipo autor",
  canal: "Canal",
  direcao: "Direção",
  ia_ativa: "IA ativa",
  total_mensagens: "Mensagens",
  ultima_mensagem_em: "Última mensagem",
  ultima_mensagem_fila_em: "Última fila",
  remetente: "Remetente",
  tipo_conteudo: "Tipo conteúdo",
  conversa_canal: "Canal conversa",
  whatsapp_status: "Status WhatsApp",
  tentativas: "Tentativas",
  recebida_em: "Recebida em",
  enviada_em: "Enviada em",
  agente_slug: "Agente",
  agente_nome: "Agente",
  attempts: "Tentativas",
  last_error: "Último erro",
  cargo: "Cargo",
  area: "Área",
  modo_operacao: "Modo operação",
  motor_ferramentas_habilitado: "Ferramentas IA",
  ativo: "Ativo",
  chave: "Chave",
  nivel_engajamento: "Engajamento",
  resumo_ia: "Resumo IA",
  modelo_usado: "Modelo",
  tokens_input: "Tokens entrada",
  tokens_output: "Tokens saída",
  custo_brl: "Custo (R$)",
  foi_escalado: "Escalado",
  sucesso: "Sucesso",
  kpi_nome: "KPI",
  dentro_da_meta: "Na meta",
  nivel_alerta: "Alerta",
  valor_meta: "Meta",
  valor_atencao: "Atenção",
  frequencia: "Frequência",
  campanha_id: "Campanha",
  plataforma: "Plataforma",
  cpl: "CPL",
  roas: "ROAS",
  impressoes: "Impressões",
  cliques: "Cliques",
  conversoes: "Conversões",
  verba_consumida: "Verba",
  nome_arquivo: "Arquivo",
  chunks_count: "Chunks",
  mime_type: "MIME",
  indexado_em: "Indexado em",
  tamanho_bytes: "Tamanho",
  integracao_id: "Integração",
  ferramenta_key: "Chave ferramenta",
  metodo_http: "Método HTTP",
  politica: "Política",
  actor_nome: "Utilizador",
  acao: "Ação",
  entidade: "Entidade",
  resumo: "Resumo",
  role: "Papel",
  cargo_acesso: "Cargo acesso",
  cnpj: "CNPJ",
  documento: "Documento",
  tipo_pessoa: "Tipo pessoa",
  valor_envolvido: "Valor envolvido",
  prazo: "Prazo",
  confianca_ia: "Confiança IA",
  lido: "Lido",
  resolvido: "Resolvido",
  aberta_em: "Aberta em",
  encerrada_em: "Encerrada em",
  score: "Score",
  campanha: "Campanha",
  agente_responsavel: "Agente responsável",
  humano_responsavel: "Humano responsável",
  proxima_acao: "Próxima ação",
  data_proxima_acao: "Data próxima ação",
  ultimo_contato: "Último contacto",
  ultima_mensagem: "Última mensagem",
  ultima_mensagem_fila: "Última msg. fila",
  pessoa_estado: "UF pessoa",
  motivo_perda: "Motivo perda",
  ia_modelo: "Modelo IA",
  ultima_mensagem_preview: "Prévia mensagem",
  remetente_numero: "Nº remetente",
  remetente_email: "E-mail remetente",
  tipo_midia: "Tipo mídia",
  tipo_conversa: "Tipo conversa",
  erro: "Erro",
  processada_em: "Processada em",
  prioridade: "Prioridade",
  max_attempts: "Máx. tentativas",
  run_after: "Executar após",
  available_at: "Disponível em",
  updated_at: "Atualizado em",
  confianca: "Confiança",
  nivel: "Nível",
  personalidade: "Personalidade",
  tom_voz: "Tom de voz",
  modelo_padrao: "Modelo padrão",
  whatsapp_numero: "WhatsApp",
  email_from: "E-mail remetente",
  email_ativo: "E-mail ativo",
  tokens_usados: "Tokens usados",
  resultado: "Resultado",
  kpi_slug: "Slug KPI",
  kpi_categoria: "Categoria KPI",
  kpi_unidade: "Unidade KPI",
  periodo_inicio: "Período início",
  periodo_fim: "Período fim",
  amostras: "Amostras",
  valor_critico: "Valor crítico",
  aprovado_por: "Aprovado por",
  aprovado_em: "Aprovado em",
  mensagem: "Mensagem",
  notificado_whatsapp: "Notif. WhatsApp",
  ctr: "CTR",
  cpa: "CPA",
  status_campanha: "Status campanha",
  descricao_curta: "Descrição curta",
  actor_email: "E-mail utilizador",
  entidade_id: "ID entidade",
  phone: "Telefone",
  cargo_slug: "Slug cargo",
  receber_novo_lead: "Alerta novo lead",
  receber_aprovacao: "Alerta aprovação",
  area_atuacao: "Área atuação",
  conversa_status: "Status conversa",
  email_status: "Status e-mail",
  agente_id: "ID agente",
  motivo_escalada: "Motivo escalada",
  tempo_resposta_ms: "Tempo resposta (ms)",
  razao_social: "Razão social",
  nome_fantasia: "Nome fantasia",
  segmento: "Segmento",
  prefixo_mercado: "Mercado",
  mercado: "Mercado",
};

export function formatarCelulaRelatorio(header: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (
    header === "valor_estimado" ||
    header === "valor_fechado" ||
    header === "valor" ||
    header === "valor_envolvido" ||
    header === "custo_brl" ||
    header === "cpl" ||
    header === "verba_consumida"
  ) {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
  }
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }
  if (
    header === "criado_em" ||
    header === "vencimento" ||
    header === "created_at" ||
    header === "enviada_em" ||
    header === "recebida_em" ||
    header === "ultima_mensagem_em" ||
    header === "indexado_em" ||
    header === "prazo" ||
    header === "periodo_fim"
  ) {
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

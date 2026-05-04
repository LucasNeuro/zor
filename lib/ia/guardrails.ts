import { createClient, SupabaseClient } from "@supabase/supabase-js";

// CAMADA 1 — IMUTÁVEL: só alterada por migrations/código
const TABELAS_IMUTAVEIS = [
  "hub_kpis_definicao",
  "hub_responsabilidades",
];

// CAMADA 2 — CONFIGURÁVEL: só humano via painel, com aprovação
const TABELAS_SO_HUMANO = [
  "hub_agente_identidade",
  "hub_agente_configuracao",
  "hub_hierarquia",
  "hub_personalidade",
  "hub_kpis_metas",
  "hub_scripts",
  "hub_regras_ia",
  "hub_regras_negocio",
  "hub_fluxos",
  "hub_briefings",
  "hub_ml_historico",
];

// CAMADA 3 — OPERACIONAL: IA opera livremente (apenas inserção/leitura)
const TABELAS_OPERACIONAIS = [
  "hub_memorias_lead",
  "hub_prompt_logs",
  "hub_fila_mensagens",
  "hub_acoes_ia",
  "hub_kpis_resultados",
  "hub_ml_observacoes",
  "hub_ml_sugestoes",
  "hub_aprovacoes",
  "hub_decision_logs",
  "hub_conversas_log",
  "hub_metricas_trafego",
  "hub_qualidade_agente",
  "hub_arquivos",
];

type Operacao = "ler" | "inserir" | "atualizar" | "deletar";
type Origem = "ia" | "humano";

interface TentativaBloqueada {
  origem: Origem;
  tabela: string;
  operacao: Operacao;
  motivo: string;
  timestamp: string;
  dados?: unknown;
}

const tentativasBloqueadas: TentativaBloqueada[] = [];

export function verificarPermissao(
  tabela: string,
  operacao: Operacao,
  origem: Origem
): { permitido: boolean; motivo?: string } {
  if (origem === "humano") {
    if (TABELAS_IMUTAVEIS.includes(tabela) && operacao !== "ler") {
      return {
        permitido: false,
        motivo: `Tabela imutável: "${tabela}" só pode ser alterada via migration de código.`,
      };
    }
    return { permitido: true };
  }

  // IA
  if (TABELAS_IMUTAVEIS.includes(tabela)) {
    if (operacao !== "ler") {
      return {
        permitido: false,
        motivo: `IA bloqueada: "${tabela}" é imutável e não pode ser modificada.`,
      };
    }
    return { permitido: true };
  }

  if (TABELAS_SO_HUMANO.includes(tabela)) {
    if (operacao !== "ler") {
      return {
        permitido: false,
        motivo: `IA bloqueada: "${tabela}" só pode ser modificada por humano via painel.`,
      };
    }
    return { permitido: true };
  }

  if (TABELAS_OPERACIONAIS.includes(tabela)) {
    if (operacao === "deletar") {
      return {
        permitido: false,
        motivo: `IA nunca deleta dados. Operação "${operacao}" em "${tabela}" bloqueada.`,
      };
    }
    return { permitido: true };
  }

  return {
    permitido: false,
    motivo: `Tabela desconhecida: "${tabela}" não está registrada em nenhuma camada de segurança.`,
  };
}

export class DBSeguro {
  private client: SupabaseClient;
  private origem: Origem;

  constructor(origem: Origem) {
    this.origem = origem;

    if (origem === "humano") {
      this.client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
    } else {
      this.client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
  }

  async ler<T = unknown>(
    tabela: string,
    query: (client: SupabaseClient) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
  ): Promise<T[]> {
    const perm = verificarPermissao(tabela, "ler", this.origem);
    if (!perm.permitido) {
      await this.registrarTentativaBloqueada(tabela, "ler", perm.motivo!);
      throw new Error(`[DBSeguro] ${perm.motivo}`);
    }
    const { data, error } = await query(this.client);
    if (error) throw new Error(`[DBSeguro] Erro ao ler "${tabela}": ${error.message}`);
    return (data || []) as T[];
  }

  async inserir<T = unknown>(tabela: string, dados: Record<string, unknown>): Promise<T> {
    const perm = verificarPermissao(tabela, "inserir", this.origem);
    if (!perm.permitido) {
      await this.registrarTentativaBloqueada(tabela, "inserir", perm.motivo!, dados);
      throw new Error(`[DBSeguro] ${perm.motivo}`);
    }
    const { data, error } = await this.client.from(tabela).insert(dados).select().single();
    if (error) throw new Error(`[DBSeguro] Erro ao inserir em "${tabela}": ${error.message}`);
    return data as T;
  }

  async atualizar(
    tabela: string,
    dados: Record<string, unknown>,
    filtro: Record<string, unknown>
  ): Promise<void> {
    const perm = verificarPermissao(tabela, "atualizar", this.origem);
    if (!perm.permitido) {
      await this.registrarTentativaBloqueada(tabela, "atualizar", perm.motivo!, dados);
      throw new Error(`[DBSeguro] ${perm.motivo}`);
    }
    let query = this.client.from(tabela).update(dados);
    for (const [chave, valor] of Object.entries(filtro)) {
      query = query.eq(chave, valor) as typeof query;
    }
    const { error } = await query;
    if (error) throw new Error(`[DBSeguro] Erro ao atualizar "${tabela}": ${error.message}`);
  }

  async deletar(tabela: string, filtro: Record<string, unknown>): Promise<void> {
    const perm = verificarPermissao(tabela, "deletar", this.origem);
    if (!perm.permitido) {
      await this.registrarTentativaBloqueada(tabela, "deletar", perm.motivo!);
      throw new Error(`[DBSeguro] ${perm.motivo}`);
    }
    let query = this.client.from(tabela).delete();
    for (const [chave, valor] of Object.entries(filtro)) {
      query = query.eq(chave, valor) as typeof query;
    }
    const { error } = await query;
    if (error) throw new Error(`[DBSeguro] Erro ao deletar em "${tabela}": ${error.message}`);
  }

  private async registrarTentativaBloqueada(
    tabela: string,
    operacao: Operacao,
    motivo: string,
    dados?: unknown
  ): Promise<void> {
    const registro: TentativaBloqueada = {
      origem: this.origem,
      tabela,
      operacao,
      motivo,
      timestamp: new Date().toISOString(),
      dados,
    };
    tentativasBloqueadas.push(registro);

    // Persiste no banco se possível (sem bloquear em erro)
    try {
      const clientAuditoria = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await clientAuditoria.from("hub_auditoria_seguranca").insert({
        origem: this.origem,
        tabela,
        operacao,
        motivo,
        metadata: dados ? { dados } : {},
      });
    } catch {
      // falha silenciosa para não bloquear o fluxo principal
    }
  }
}

export function dbIA(): DBSeguro {
  return new DBSeguro("ia");
}

export function dbHumano(): DBSeguro {
  return new DBSeguro("humano");
}

export async function buscarTentativasBloqueadas(horas = 24): Promise<unknown[]> {
  try {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const desde = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
    const { data } = await client
      .from("hub_auditoria_seguranca")
      .select("*")
      .gte("criado_em", desde)
      .order("criado_em", { ascending: false });
    return data || tentativasBloqueadas;
  } catch {
    return tentativasBloqueadas;
  }
}

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileText,
  Home,
  LineChart,
  MessageSquare,
  Plug,
  ScrollText,
  StickyNote,
  Target,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { RelatorioFiltroTipo } from "@/lib/crm/painel-filtros";

export type RelatorioViewCategoria =
  | "comercial"
  | "atendimento"
  | "cadastros"
  | "operacao"
  | "financeiro"
  | "ia_agentes"
  | "marketing"
  | "sistema";

export type RelatorioViewId =
  | "vw_rel_leads_enriquecidos"
  | "vw_rel_negocios_pipeline"
  | "vw_rel_pessoas_cadastro"
  | "vw_rel_empresas_cadastro"
  | "vw_rel_atividades_timeline"
  | "vw_rel_notas_crm"
  | "vw_rel_conversas_atendimento"
  | "vw_rel_mensagens_detalhe"
  | "vw_rel_fila_mensagens"
  | "vw_rel_msg_jobs"
  | "vw_rel_atendentes_crm"
  | "vw_rel_memorias_lead"
  | "vw_rel_agentes_hub"
  | "vw_rel_prompt_logs"
  | "vw_rel_acoes_ia"
  | "vw_rel_kpis_resultados"
  | "vw_rel_kpis_metas"
  | "vw_rel_aprovacoes"
  | "vw_rel_alertas_operacao"
  | "vw_rel_metricas_trafego"
  | "vw_rel_conhecimento_tenant"
  | "vw_rel_rag_documentos"
  | "vw_rel_integracoes_hub"
  | "vw_rel_ferramentas_externas"
  | "vw_rel_auditoria_sistema"
  | "vw_rel_contatos_notificacao"
  | "vw_rel_users_acesso"
  | "vw_rel_contas_receber"
  | "vw_rel_contas_pagar"
  | "vw_rel_fluxo_caixa"
  | "vw_rel_imoveis_captacao";

export type RelatorioViewDef = {
  id: RelatorioViewId;
  label: string;
  descricao: string;
  categoria: RelatorioViewCategoria;
  fonte: string;
  colunas: string[];
  filtros: RelatorioFiltroTipo[];
  legacyEntidade?: string;
  tableFallback?: { table: string; select: string };
  orderColumn: string;
  orderAsc?: boolean;
};

export const RELATORIO_VIEW_CATEGORIA_LABEL: Record<RelatorioViewCategoria, string> = {
  comercial: "COMERCIAL & CRM",
  atendimento: "ATENDIMENTO & WHATSAPP",
  cadastros: "CADASTROS",
  operacao: "OPERAÇÃO",
  financeiro: "FINANCEIRO",
  ia_agentes: "IA & AGENTES",
  marketing: "MARKETING & CONHECIMENTO",
  sistema: "SISTEMA & ACESSO",
};

export const RELATORIO_VIEW_CATEGORIA_ORDEM: RelatorioViewCategoria[] = [
  "comercial",
  "atendimento",
  "cadastros",
  "operacao",
  "financeiro",
  "ia_agentes",
  "marketing",
  "sistema",
];

export const RELATORIO_VIEW_ICONE: Record<RelatorioViewId, LucideIcon> = {
  vw_rel_leads_enriquecidos: UserRound,
  vw_rel_negocios_pipeline: Briefcase,
  vw_rel_pessoas_cadastro: Users,
  vw_rel_empresas_cadastro: Building2,
  vw_rel_atividades_timeline: ClipboardList,
  vw_rel_notas_crm: StickyNote,
  vw_rel_conversas_atendimento: MessageSquare,
  vw_rel_mensagens_detalhe: MessageSquare,
  vw_rel_fila_mensagens: MessageSquare,
  vw_rel_msg_jobs: Wrench,
  vw_rel_atendentes_crm: Users,
  vw_rel_memorias_lead: BookOpen,
  vw_rel_agentes_hub: Cpu,
  vw_rel_prompt_logs: ScrollText,
  vw_rel_acoes_ia: Cpu,
  vw_rel_kpis_resultados: Target,
  vw_rel_kpis_metas: Target,
  vw_rel_aprovacoes: CheckCircle2,
  vw_rel_alertas_operacao: AlertTriangle,
  vw_rel_metricas_trafego: LineChart,
  vw_rel_conhecimento_tenant: BookOpen,
  vw_rel_rag_documentos: FileText,
  vw_rel_integracoes_hub: Plug,
  vw_rel_ferramentas_externas: Plug,
  vw_rel_auditoria_sistema: ScrollText,
  vw_rel_contatos_notificacao: Users,
  vw_rel_users_acesso: Users,
  vw_rel_contas_receber: Wallet,
  vw_rel_contas_pagar: Wallet,
  vw_rel_fluxo_caixa: BarChart3,
  vw_rel_imoveis_captacao: Home,
};

export const RELATORIO_VIEWS_CATALOGO: RelatorioViewDef[] = [
  {
    id: "vw_rel_leads_enriquecidos",
    label: "Leads enriquecidos",
    descricao: "Lead + pessoa, pipeline, última mensagem da fila e score de qualificação.",
    categoria: "comercial",
    fonte: "vw_rel_leads_enriquecidos",
    colunas: [
      "nome",
      "telefone",
      "email_exibicao",
      "origem",
      "estagio",
      "estagio_atendimento",
      "score",
      "valor_estimado",
      "pessoa_nome",
      "pipeline_nome",
      "ultima_mensagem_fila_em",
      "criado_em",
    ],
    filtros: ["search", "periodo", "estagio", "origem"],
    legacyEntidade: "leads",
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_negocios_pipeline",
    label: "Negócios no pipeline",
    descricao: "Oportunidades com lead, pessoa, empresa e etapa do funil comercial.",
    categoria: "comercial",
    fonte: "vw_rel_negocios_pipeline",
    colunas: [
      "codigo",
      "titulo",
      "etapa",
      "status",
      "valor_estimado",
      "lead_nome",
      "empresa_nome",
      "pipeline_nome",
      "criado_em",
    ],
    filtros: ["search", "periodo", "estagio", "status"],
    legacyEntidade: "negocios",
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_atividades_timeline",
    label: "Atividades da timeline",
    descricao: "Histórico unificado de mensagens, ligações, propostas e ações no CRM.",
    categoria: "comercial",
    fonte: "vw_rel_atividades_timeline",
    colunas: ["tipo", "descricao", "feito_por", "feito_por_tipo", "lead_nome", "negocio_titulo", "criado_em"],
    filtros: ["search", "periodo"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_notas_crm",
    label: "Notas internas",
    descricao: "Notas de lead e negócio com autor e data de criação.",
    categoria: "comercial",
    fonte: "vw_rel_notas_crm",
    colunas: ["conteudo", "criado_por", "lead_nome", "negocio_titulo", "criado_em"],
    filtros: ["search", "periodo"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_memorias_lead",
    label: "Memórias de qualificação",
    descricao: "Dados extraídos pela IA por lead: chaves, resumo e nível de engajamento.",
    categoria: "comercial",
    fonte: "vw_rel_memorias_lead",
    colunas: ["lead_nome", "chave", "valor", "nivel_engajamento", "resumo_ia", "criado_em"],
    filtros: ["search", "periodo"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_conversas_atendimento",
    label: "Conversas ativas",
    descricao: "Sessões por canal com status, IA e volume de mensagens.",
    categoria: "atendimento",
    fonte: "vw_rel_conversas_atendimento",
    colunas: [
      "lead_nome",
      "canal",
      "status",
      "ia_ativa",
      "total_mensagens",
      "ultima_mensagem_em",
      "aberta_em",
      "criado_em",
    ],
    filtros: ["search", "periodo", "status"],
    orderColumn: "ultima_mensagem_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_mensagens_detalhe",
    label: "Mensagens detalhadas",
    descricao: "Cada mensagem com remetente, canal da conversa e status de entrega.",
    categoria: "atendimento",
    fonte: "vw_rel_mensagens_detalhe",
    colunas: [
      "lead_nome",
      "remetente",
      "tipo_conteudo",
      "conteudo",
      "conversa_canal",
      "whatsapp_status",
      "enviada_em",
    ],
    filtros: ["search", "periodo"],
    orderColumn: "enviada_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_fila_mensagens",
    label: "Fila de mensagens",
    descricao: "Entrada e saída WhatsApp/e-mail: pendentes, erros e tentativas.",
    categoria: "atendimento",
    fonte: "vw_rel_fila_mensagens",
    colunas: [
      "lead_nome",
      "direcao",
      "canal",
      "status",
      "conteudo",
      "agente_responsavel",
      "tentativas",
      "recebida_em",
    ],
    filtros: ["search", "periodo", "status"],
    orderColumn: "recebida_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_msg_jobs",
    label: "Jobs de envio",
    descricao: "Fila assíncrona de mensagens com prioridade, tentativas e erros.",
    categoria: "atendimento",
    fonte: "vw_rel_msg_jobs",
    colunas: [
      "lead_nome",
      "canal",
      "tipo",
      "status",
      "telefone",
      "agente_slug",
      "attempts",
      "last_error",
      "created_at",
    ],
    filtros: ["search", "periodo", "status"],
    orderColumn: "created_at",
    orderAsc: false,
  },
  {
    id: "vw_rel_atendentes_crm",
    label: "Atendentes humanos",
    descricao: "Equipe de atendimento com cargo, telefone e vínculo a agente IA.",
    categoria: "atendimento",
    fonte: "vw_rel_atendentes_crm",
    colunas: ["nome", "telefone", "email", "cargo", "agente_slug", "ativo", "criado_em"],
    filtros: ["search"],
    orderColumn: "nome",
    orderAsc: true,
  },
  {
    id: "vw_rel_pessoas_cadastro",
    label: "Pessoas",
    descricao: "Cadastro PF/PJ com empresa vinculada, cidade e origem.",
    categoria: "cadastros",
    fonte: "vw_rel_pessoas_cadastro",
    colunas: ["codigo", "nome", "telefone", "email", "tipo", "cidade", "empresa_nome", "criado_em"],
    filtros: ["search", "periodo", "origem"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_empresas_cadastro",
    label: "Empresas",
    descricao: "Empresas do tenant com CNPJ, contato e localização.",
    categoria: "cadastros",
    fonte: "vw_rel_empresas_cadastro",
    colunas: ["nome", "cnpj", "email", "telefone", "cidade", "estado", "ativo", "criado_em"],
    filtros: ["search", "periodo"],
    legacyEntidade: "empresas",
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_imoveis_captacao",
    label: "Imóveis em captação",
    descricao: "Portfólio imobiliário com tipo, status, valor e localização.",
    categoria: "operacao",
    fonte: "vw_rel_imoveis_captacao",
    colunas: ["codigo", "titulo", "tipo", "status", "valor", "cidade", "estado", "criado_em"],
    filtros: ["search", "periodo", "status"],
    legacyEntidade: "imoveis",
    tableFallback: {
      table: "hub_imoveis",
      select: "codigo, titulo, tipo, status, valor, cidade, estado, criado_em",
    },
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_aprovacoes",
    label: "Aprovações pendentes",
    descricao: "Pedidos de aprovação da IA com valor, prazo e status.",
    categoria: "operacao",
    fonte: "vw_rel_aprovacoes",
    colunas: [
      "tipo",
      "descricao",
      "status",
      "agente_nome",
      "valor_envolvido",
      "lead_nome",
      "prazo",
      "criado_em",
    ],
    filtros: ["search", "periodo", "status"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_alertas_operacao",
    label: "Alertas operacionais",
    descricao: "Alertas críticos e sugestões gerados pelos agentes.",
    categoria: "operacao",
    fonte: "vw_rel_alertas_operacao",
    colunas: ["tipo", "titulo", "agente_slug", "lido", "resolvido", "lead_nome", "criado_em"],
    filtros: ["search", "periodo", "status"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_contas_receber",
    label: "Contas a receber",
    descricao: "Recebíveis com vencimento e status de cobrança.",
    categoria: "financeiro",
    fonte: "vw_rel_contas_receber",
    colunas: ["descricao", "valor", "vencimento", "status", "criado_em"],
    filtros: ["search", "periodo", "status"],
    legacyEntidade: "contas_receber",
    tableFallback: {
      table: "hub_contas_receber",
      select: "descricao, valor, vencimento, status, criado_em",
    },
    orderColumn: "vencimento",
    orderAsc: true,
  },
  {
    id: "vw_rel_contas_pagar",
    label: "Contas a pagar",
    descricao: "Despesas e obrigações com data de vencimento.",
    categoria: "financeiro",
    fonte: "vw_rel_contas_pagar",
    colunas: ["descricao", "valor", "vencimento", "status", "criado_em"],
    filtros: ["search", "periodo", "status"],
    legacyEntidade: "contas_pagar",
    tableFallback: {
      table: "hub_contas_pagar",
      select: "descricao, valor, vencimento, status, criado_em",
    },
    orderColumn: "vencimento",
    orderAsc: true,
  },
  {
    id: "vw_rel_fluxo_caixa",
    label: "Fluxo de caixa",
    descricao: "Visão unificada de contas a pagar e a receber.",
    categoria: "financeiro",
    fonte: "vw_rel_fluxo_caixa",
    colunas: ["tipo", "descricao", "valor", "vencimento", "status", "criado_em"],
    filtros: ["search", "periodo", "status"],
    legacyEntidade: "financeiro",
    orderColumn: "vencimento",
    orderAsc: true,
  },
  {
    id: "vw_rel_agentes_hub",
    label: "Agentes IA",
    descricao: "Modelos do hub com cargo, canal, ferramentas e estado.",
    categoria: "ia_agentes",
    fonte: "vw_rel_agentes_hub",
    colunas: [
      "nome",
      "agente_slug",
      "cargo",
      "area",
      "modo_operacao",
      "motor_ferramentas_habilitado",
      "ativo",
      "criado_em",
    ],
    filtros: ["search"],
    orderColumn: "nome",
    orderAsc: true,
  },
  {
    id: "vw_rel_prompt_logs",
    label: "Logs de prompts IA",
    descricao: "Chamadas ao modelo com tokens, custo e escalonamentos.",
    categoria: "ia_agentes",
    fonte: "vw_rel_prompt_logs",
    colunas: [
      "agente_slug",
      "lead_nome",
      "modelo_usado",
      "tokens_input",
      "tokens_output",
      "custo_brl",
      "foi_escalado",
      "criado_em",
    ],
    filtros: ["search", "periodo"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_acoes_ia",
    label: "Ações da IA",
    descricao: "Ações executadas pelos agentes com resultado e custo.",
    categoria: "ia_agentes",
    fonte: "vw_rel_acoes_ia",
    colunas: ["agente_slug", "tipo", "descricao", "sucesso", "lead_nome", "custo_brl", "criado_em"],
    filtros: ["search", "periodo"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_kpis_resultados",
    label: "Resultados de KPIs",
    descricao: "Medições por agente com meta, alerta e período.",
    categoria: "ia_agentes",
    fonte: "vw_rel_kpis_resultados",
    colunas: [
      "kpi_nome",
      "agente_slug",
      "valor",
      "dentro_da_meta",
      "nivel_alerta",
      "periodo_fim",
      "criado_em",
    ],
    filtros: ["search", "periodo"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_kpis_metas",
    label: "Metas de KPIs",
    descricao: "Metas configuradas por agente e indicador.",
    categoria: "ia_agentes",
    fonte: "vw_rel_kpis_metas",
    colunas: ["kpi_nome", "agente_slug", "valor_meta", "valor_atencao", "frequencia", "ativo"],
    filtros: ["search"],
    orderColumn: "kpi_nome",
    orderAsc: true,
  },
  {
    id: "vw_rel_metricas_trafego",
    label: "Métricas de tráfego",
    descricao: "Campanhas Meta/Google com CPL, ROAS, CTR e conversões.",
    categoria: "marketing",
    fonte: "vw_rel_metricas_trafego",
    colunas: [
      "campanha_id",
      "plataforma",
      "cpl",
      "roas",
      "impressoes",
      "cliques",
      "conversoes",
      "verba_consumida",
      "criado_em",
    ],
    filtros: ["search", "periodo", "status"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_conhecimento_tenant",
    label: "Base de conhecimento",
    descricao: "Documentos indexados do tenant com status e chunks.",
    categoria: "marketing",
    fonte: "vw_rel_conhecimento_tenant",
    colunas: ["titulo", "nome_arquivo", "status", "chunks_count", "mime_type", "indexado_em", "criado_em"],
    filtros: ["search", "periodo", "status"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_rag_documentos",
    label: "Documentos RAG dos agentes",
    descricao: "Playbooks e materiais por agente com status de indexação.",
    categoria: "marketing",
    fonte: "vw_rel_rag_documentos",
    colunas: ["agente_slug", "nome_arquivo", "status", "origem", "tamanho_bytes", "criado_em"],
    filtros: ["search", "periodo", "status"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_integracoes_hub",
    label: "Integrações",
    descricao: "Conectores ativos (Google, Gmail, webhooks) por tenant.",
    categoria: "sistema",
    fonte: "vw_rel_integracoes_hub",
    colunas: ["nome", "integracao_id", "status", "ativo", "criado_em"],
    filtros: ["search", "status"],
    orderColumn: "nome",
    orderAsc: true,
  },
  {
    id: "vw_rel_ferramentas_externas",
    label: "Ferramentas externas",
    descricao: "APIs customizadas expostas aos agentes IA.",
    categoria: "sistema",
    fonte: "vw_rel_ferramentas_externas",
    colunas: ["titulo", "ferramenta_key", "metodo_http", "politica", "ativo", "criado_em"],
    filtros: ["search"],
    orderColumn: "titulo",
    orderAsc: true,
  },
  {
    id: "vw_rel_auditoria_sistema",
    label: "Auditoria do sistema",
    descricao: "Registo de ações de utilizadores no CRM.",
    categoria: "sistema",
    fonte: "vw_rel_auditoria_sistema",
    colunas: ["actor_nome", "acao", "entidade", "resumo", "criado_em"],
    filtros: ["search", "periodo"],
    orderColumn: "criado_em",
    orderAsc: false,
  },
  {
    id: "vw_rel_contatos_notificacao",
    label: "Contatos de notificação",
    descricao: "Quem recebe alertas de lead, aprovação e encaminhamento.",
    categoria: "sistema",
    fonte: "vw_rel_contatos_notificacao",
    colunas: ["nome", "telefone", "email", "cargo", "canal", "ativo", "criado_em"],
    filtros: ["search"],
    orderColumn: "nome",
    orderAsc: true,
  },
  {
    id: "vw_rel_users_acesso",
    label: "Utilizadores e acessos",
    descricao: "Utilizadores do portal com cargo de permissões.",
    categoria: "sistema",
    fonte: "vw_rel_users_acesso",
    colunas: ["name", "email", "role", "status", "cargo_acesso", "created_at"],
    filtros: ["search", "status"],
    orderColumn: "name",
    orderAsc: true,
  },
];

const CATALOGO_BY_ID = new Map(RELATORIO_VIEWS_CATALOGO.map((v) => [v.id, v]));

const LEGACY_ENTIDADE_TO_VIEW: Record<string, RelatorioViewId> = {
  leads: "vw_rel_leads_enriquecidos",
  negocios: "vw_rel_negocios_pipeline",
  empresas: "vw_rel_empresas_cadastro",
  imoveis: "vw_rel_imoveis_captacao",
  contas_pagar: "vw_rel_contas_pagar",
  contas_receber: "vw_rel_contas_receber",
  financeiro: "vw_rel_fluxo_caixa",
};

export function relatorioViewById(id: string): RelatorioViewDef | undefined {
  return CATALOGO_BY_ID.get(id as RelatorioViewId);
}

export function resolveRelatorioViewId(raw: string | null | undefined): RelatorioViewId {
  if (raw && CATALOGO_BY_ID.has(raw as RelatorioViewId)) {
    return raw as RelatorioViewId;
  }
  if (raw && LEGACY_ENTIDADE_TO_VIEW[raw]) {
    return LEGACY_ENTIDADE_TO_VIEW[raw];
  }
  return "vw_rel_leads_enriquecidos";
}

export function relatorioViewsPorCategoria(): Array<{
  categoria: RelatorioViewCategoria;
  label: string;
  views: RelatorioViewDef[];
}> {
  return RELATORIO_VIEW_CATEGORIA_ORDEM.map((cat) => ({
    categoria: cat,
    label: RELATORIO_VIEW_CATEGORIA_LABEL[cat],
    views: RELATORIO_VIEWS_CATALOGO.filter((v) => v.categoria === cat),
  })).filter((g) => g.views.length > 0);
}

export type RelatorioEntidade =
  | "leads"
  | "negocios"
  | "empresas"
  | "imoveis"
  | "contas_pagar"
  | "contas_receber"
  | "financeiro";

export function viewIdFromEntidade(entidade: RelatorioEntidade): RelatorioViewId {
  return resolveRelatorioViewId(entidade);
}

export const RELATORIO_ENTIDADES_UI = [
  { id: "leads" as const, label: "Leads" },
  { id: "negocios" as const, label: "Negócios" },
  { id: "empresas" as const, label: "Empresas" },
  { id: "imoveis" as const, label: "Imóveis" },
  { id: "financeiro" as const, label: "Financeiro" },
];

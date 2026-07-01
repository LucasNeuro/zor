/**
 * Entidades operacionais do tenant (CRM, financeiro, config, IA) — superagentes internos.
 * Exclui: users, credenciais, filas de mensagens, logs append-only, plataforma global.
 */

export type OperacaoEntidadeSlug =
  | "lead"
  | "negocio"
  | "pessoa"
  | "empresa"
  | "nota"
  | "conta_receber"
  | "conta_pagar"
  | "atividade"
  | "aprovacao"
  | "alerta"
  | "conversa"
  | "servico_catalogo"
  | "parceiro"
  | "servico"
  | "proposta"
  | "kpi_meta"
  | "kpi_resultado"
  | "pipeline"
  | "atendente"
  | "briefing"
  | "contato_notificacao"
  | "fluxo"
  | "regra_ia"
  | "regra_negocio"
  | "script_ia"
  | "conhecimento_agente"
  | "memoria_lead"
  | "memoria_agente"
  | "hierarquia"
  | "personalidade"
  | "arquivo"
  | "responsabilidade"
  | "mensalidade"
  | "agenda_config"
  | "followup_config"
  | "ciclo_ia"
  | "metricas_trafego";

export type OperacaoEntidadeConfig = {
  tabela: string;
  view?: string;
  label: string;
  camposLeitura: string[];
  camposCriar?: string[];
  camposAtualizar?: string[];
  statusArquivar?: string;
};

export const OPERACAO_ENTIDADE_CATALOGO: Array<{
  id: OperacaoEntidadeSlug;
  label: string;
  pode_criar: boolean;
  pode_atualizar: boolean;
}> = [
  { id: "lead", label: "Lead CRM", pode_criar: true, pode_atualizar: true },
  { id: "negocio", label: "Negócio", pode_criar: true, pode_atualizar: true },
  { id: "pessoa", label: "Pessoa", pode_criar: true, pode_atualizar: true },
  { id: "empresa", label: "Empresa", pode_criar: true, pode_atualizar: true },
  { id: "nota", label: "Nota CRM", pode_criar: true, pode_atualizar: true },
  { id: "conta_receber", label: "Conta a receber", pode_criar: true, pode_atualizar: true },
  { id: "conta_pagar", label: "Conta a pagar", pode_criar: true, pode_atualizar: true },
  { id: "atividade", label: "Atividade / timeline", pode_criar: true, pode_atualizar: true },
  { id: "aprovacao", label: "Aprovação", pode_criar: true, pode_atualizar: true },
  { id: "alerta", label: "Alerta operação", pode_criar: true, pode_atualizar: true },
  { id: "conversa", label: "Conversa", pode_criar: true, pode_atualizar: true },
  { id: "servico_catalogo", label: "Catálogo de serviços", pode_criar: true, pode_atualizar: true },
  { id: "parceiro", label: "Parceiro", pode_criar: true, pode_atualizar: true },
  { id: "servico", label: "Serviço catálogo legado", pode_criar: true, pode_atualizar: true },
  { id: "proposta", label: "Proposta", pode_criar: true, pode_atualizar: true },
  { id: "kpi_meta", label: "Meta KPI", pode_criar: true, pode_atualizar: true },
  { id: "kpi_resultado", label: "Resultado KPI", pode_criar: true, pode_atualizar: true },
  { id: "pipeline", label: "Pipeline funil", pode_criar: true, pode_atualizar: true },
  { id: "atendente", label: "Atendente humano CRM", pode_criar: true, pode_atualizar: true },
  { id: "briefing", label: "Briefing interno", pode_criar: true, pode_atualizar: true },
  { id: "contato_notificacao", label: "Contacto notificação", pode_criar: true, pode_atualizar: true },
  { id: "fluxo", label: "Fluxo operacional", pode_criar: true, pode_atualizar: true },
  { id: "regra_ia", label: "Regra IA", pode_criar: true, pode_atualizar: true },
  { id: "regra_negocio", label: "Regra de negócio", pode_criar: true, pode_atualizar: true },
  { id: "script_ia", label: "Script IA", pode_criar: true, pode_atualizar: true },
  { id: "conhecimento_agente", label: "Conhecimento do agente", pode_criar: true, pode_atualizar: true },
  { id: "memoria_lead", label: "Memória do lead", pode_criar: true, pode_atualizar: true },
  { id: "memoria_agente", label: "Memória do agente", pode_criar: true, pode_atualizar: true },
  { id: "hierarquia", label: "Hierarquia org.", pode_criar: true, pode_atualizar: true },
  { id: "personalidade", label: "Personalidade agente", pode_criar: true, pode_atualizar: true },
  { id: "arquivo", label: "Arquivo / anexo", pode_criar: true, pode_atualizar: true },
  { id: "responsabilidade", label: "Responsabilidade KPI", pode_criar: true, pode_atualizar: true },
  { id: "mensalidade", label: "Mensalidade tenant", pode_criar: true, pode_atualizar: true },
  { id: "agenda_config", label: "Config. agenda tenant", pode_criar: true, pode_atualizar: true },
  { id: "followup_config", label: "Config. follow-up", pode_criar: true, pode_atualizar: true },
  { id: "ciclo_ia", label: "Ciclo IA programado", pode_criar: true, pode_atualizar: true },
  { id: "metricas_trafego", label: "Métricas tráfego pago", pode_criar: true, pode_atualizar: true },
];

export const OPERACAO_ENTIDADES_CONFIG: Record<OperacaoEntidadeSlug, OperacaoEntidadeConfig> = {
  lead: {
    tabela: "hub_leads_crm",
    view: "vw_rel_leads_enriquecidos",
    label: "Lead CRM",
    camposLeitura: [
      "id", "nome", "telefone", "email", "estagio", "estagio_funil", "score", "valor_estimado",
      "interesse_principal", "agente_responsavel", "humano_responsavel", "origem", "pessoa_id",
      "criado_em", "atualizado_em",
    ],
    camposCriar: ["nome", "telefone", "email", "estagio", "valor_estimado", "interesse_principal", "origem", "tags"],
    camposAtualizar: [
      "nome", "telefone", "email", "estagio", "score", "valor_estimado", "interesse_principal",
      "agente_responsavel", "humano_responsavel", "tags", "metadata",
    ],
    statusArquivar: "spam_invalido",
  },
  negocio: {
    tabela: "hub_negocios",
    view: "vw_rel_negocios_pipeline",
    label: "Negócio",
    camposLeitura: [
      "id", "titulo", "status", "etapa", "valor_estimado", "valor_fechado", "lead_id", "pessoa_id",
      "servico_catalogo_id", "criado_em", "atualizado_em",
    ],
    camposCriar: ["titulo", "lead_id", "valor_estimado", "descricao", "etapa", "status", "servico_catalogo_id"],
    camposAtualizar: ["titulo", "status", "etapa", "valor_estimado", "valor_fechado", "descricao"],
    statusArquivar: "cancelado",
  },
  pessoa: {
    tabela: "hub_pessoas",
    view: "vw_rel_pessoas_cadastro",
    label: "Pessoa",
    camposLeitura: ["id", "codigo", "nome", "telefone", "email", "origem", "cidade", "estado", "criado_em"],
    camposCriar: ["nome", "telefone", "email", "origem", "cidade", "estado", "tipo"],
    camposAtualizar: ["nome", "telefone", "email", "origem", "cidade", "estado", "tags"],
  },
  empresa: {
    tabela: "hub_empresas",
    label: "Empresa",
    camposLeitura: ["id", "codigo", "nome", "cnpj", "email", "telefone", "cidade", "estado", "ativo", "criado_em"],
    camposCriar: ["nome", "cnpj", "email", "telefone", "cidade", "estado"],
    camposAtualizar: ["nome", "cnpj", "email", "telefone", "cidade", "estado", "ativo"],
  },
  nota: {
    tabela: "hub_notas",
    view: "vw_rel_notas_crm",
    label: "Nota CRM",
    camposLeitura: ["id", "lead_id", "negocio_id", "conteudo", "criado_por", "criado_em", "atualizado_em"],
    camposCriar: ["conteudo", "lead_id", "negocio_id"],
    camposAtualizar: ["conteudo"],
  },
  conta_receber: {
    tabela: "hub_contas_receber",
    view: "vw_rel_contas_receber",
    label: "Conta a receber",
    camposLeitura: ["id", "descricao", "valor", "vencimento", "status", "negocio_id", "lead_id", "criado_em"],
    camposCriar: ["descricao", "valor", "vencimento", "status", "negocio_id", "lead_id", "servico_catalogo_id"],
    camposAtualizar: ["descricao", "valor", "vencimento", "status"],
    statusArquivar: "cancelado",
  },
  conta_pagar: {
    tabela: "hub_contas_pagar",
    view: "vw_rel_contas_pagar",
    label: "Conta a pagar",
    camposLeitura: ["id", "descricao", "valor", "vencimento", "status", "criado_em"],
    camposCriar: ["descricao", "valor", "vencimento", "status", "fornecedor_empresa_id"],
    camposAtualizar: ["descricao", "valor", "vencimento", "status"],
    statusArquivar: "cancelado",
  },
  atividade: {
    tabela: "hub_atividades",
    view: "vw_rel_atividades_timeline",
    label: "Atividade / timeline",
    camposLeitura: ["id", "lead_id", "negocio_id", "tipo", "descricao", "feito_por", "criado_em"],
    camposCriar: ["lead_id", "negocio_id", "tipo", "descricao"],
    camposAtualizar: ["tipo", "descricao", "metadata"],
  },
  aprovacao: {
    tabela: "hub_aprovacoes",
    view: "vw_rel_aprovacoes",
    label: "Aprovação",
    camposLeitura: ["id", "descricao", "tipo", "status", "lead_id", "valor_envolvido", "criado_em"],
    camposCriar: ["tipo", "descricao", "motivo", "lead_id", "valor_envolvido", "dados"],
    camposAtualizar: ["status", "observacao", "motivo_rejeicao"],
  },
  alerta: {
    tabela: "hub_alertas",
    view: "vw_rel_alertas_operacao",
    label: "Alerta operação",
    camposLeitura: ["id", "titulo", "tipo", "mensagem", "lido", "resolvido", "lead_id", "criado_em"],
    camposCriar: ["tipo", "titulo", "mensagem", "lead_id", "dados"],
    camposAtualizar: ["lido", "resolvido", "titulo", "mensagem"],
    statusArquivar: "resolvido",
  },
  conversa: {
    tabela: "hub_conversas",
    label: "Conversa",
    camposLeitura: ["id", "lead_id", "canal", "status", "ia_ativa", "total_mensagens", "criado_em"],
    camposCriar: ["lead_id", "canal", "pessoa_id", "status"],
    camposAtualizar: ["status", "ia_ativa", "ia_pausada_motivo"],
  },
  servico_catalogo: {
    tabela: "hub_tenant_servicos_catalogo",
    label: "Catálogo de serviços",
    camposLeitura: ["id", "slug", "nome", "descricao", "preco_referencia", "tipo", "ativo", "criado_em"],
    camposCriar: ["slug", "nome", "descricao", "preco_referencia", "tipo", "ativo"],
    camposAtualizar: ["nome", "descricao", "preco_referencia", "tipo", "ativo"],
  },
  parceiro: {
    tabela: "hub_parceiros",
    label: "Parceiro",
    camposLeitura: ["id", "codigo", "especialidade", "status_homologacao", "disponivel", "criado_em"],
    camposCriar: ["codigo", "especialidade", "disponivel"],
    camposAtualizar: ["disponivel", "status_homologacao", "especialidade"],
  },
  servico: {
    tabela: "hub_servicos",
    label: "Serviço catálogo",
    camposLeitura: ["id", "nome", "descricao", "categoria", "ativo", "criado_em"],
    camposCriar: ["nome", "descricao", "categoria", "faixa_preco_min", "faixa_preco_max", "ativo"],
    camposAtualizar: ["nome", "descricao", "categoria", "ativo", "faixa_preco_min", "faixa_preco_max"],
  },
  proposta: {
    tabela: "hub_propostas",
    label: "Proposta",
    camposLeitura: ["id", "titulo", "valor", "status", "lead_id", "negocio_id", "criado_em"],
    camposCriar: ["titulo", "valor", "lead_id", "negocio_id", "servico_id", "escopo", "status"],
    camposAtualizar: ["titulo", "valor", "status", "escopo"],
    statusArquivar: "recusada",
  },
  kpi_meta: {
    tabela: "hub_kpis_metas",
    view: "vw_rel_kpis_metas",
    label: "Meta KPI",
    camposLeitura: ["id", "kpi_slug", "agente_slug", "valor_meta", "frequencia", "ativo", "criado_em"],
    camposCriar: ["kpi_slug", "agente_slug", "valor_meta", "valor_atencao", "valor_critico", "frequencia", "ativo"],
    camposAtualizar: ["valor_meta", "valor_atencao", "valor_critico", "frequencia", "ativo"],
  },
  kpi_resultado: {
    tabela: "hub_kpis_resultados",
    view: "vw_rel_kpis_resultados",
    label: "Resultado KPI",
    camposLeitura: ["id", "kpi_slug", "agente_slug", "valor", "periodo_inicio", "periodo_fim", "criado_em"],
    camposCriar: ["kpi_slug", "agente_slug", "valor", "periodo_inicio", "periodo_fim", "dentro_da_meta"],
    camposAtualizar: ["valor", "dentro_da_meta", "nivel_alerta", "metadata"],
  },
  pipeline: {
    tabela: "hub_pipelines",
    label: "Pipeline funil",
    camposLeitura: ["id", "slug", "nome", "tipo", "mercado_sigla", "ativo", "ordem", "criado_em"],
    camposCriar: ["slug", "nome", "tipo", "mercado_sigla", "ativo", "ordem"],
    camposAtualizar: ["nome", "ativo", "ordem", "mercado_sigla"],
  },
  atendente: {
    tabela: "hub_atendentes_crm",
    label: "Atendente humano CRM",
    camposLeitura: ["id", "nome", "telefone", "email", "cargo", "agente_slug", "ativo", "criado_em"],
    camposCriar: ["nome", "telefone", "email", "cargo", "agente_slug", "ativo"],
    camposAtualizar: ["nome", "telefone", "email", "cargo", "agente_slug", "ativo", "metadata"],
  },
  briefing: {
    tabela: "hub_briefings",
    label: "Briefing interno",
    camposLeitura: ["id", "tipo", "titulo", "status", "lead_id", "prazo", "criado_em"],
    camposCriar: ["tipo", "titulo", "descricao", "lead_id", "objetivo", "prazo", "status"],
    camposAtualizar: ["titulo", "descricao", "status", "prazo", "objetivo", "dados"],
  },
  contato_notificacao: {
    tabela: "hub_contatos_notificacao",
    label: "Contacto notificação",
    camposLeitura: ["id", "nome", "telefone", "email", "cargo", "ativo", "criado_em"],
    camposCriar: ["nome", "telefone", "email", "cargo", "canal", "ativo"],
    camposAtualizar: ["nome", "telefone", "email", "ativo", "receber_novo_lead", "receber_aprovacao"],
  },
  fluxo: {
    tabela: "hub_fluxos",
    label: "Fluxo operacional",
    camposLeitura: ["id", "nome", "area", "ativo", "agente_slug", "criado_em"],
    camposCriar: ["nome", "area", "descricao", "etapas", "agente_slug", "ativo"],
    camposAtualizar: ["nome", "descricao", "etapas", "ativo", "proximo_passo"],
  },
  regra_ia: {
    tabela: "hub_regras_ia",
    label: "Regra IA",
    camposLeitura: ["id", "nome", "categoria", "ativo", "agente_slug", "prioridade", "criado_em"],
    camposCriar: ["nome", "categoria", "descricao", "condicao", "acao", "agente_slug", "ativo"],
    camposAtualizar: ["nome", "descricao", "condicao", "acao", "ativo", "prioridade"],
  },
  regra_negocio: {
    tabela: "hub_regras_negocio",
    label: "Regra de negócio",
    camposLeitura: ["id", "nome", "categoria", "ativo", "prioridade", "criado_em"],
    camposCriar: ["nome", "categoria", "descricao", "condicao", "acao", "ativo"],
    camposAtualizar: ["nome", "descricao", "condicao", "acao", "ativo", "prioridade"],
  },
  script_ia: {
    tabela: "hub_scripts",
    label: "Script IA",
    camposLeitura: ["id", "nome", "fase", "tipo", "agente_slug", "ativo", "criado_em"],
    camposCriar: ["agente_slug", "fase", "tipo", "nome", "template", "conteudo", "ativo"],
    camposAtualizar: ["nome", "template", "conteudo", "ativo", "prioridade"],
  },
  conhecimento_agente: {
    tabela: "hub_agente_conhecimento",
    label: "Conhecimento do agente",
    camposLeitura: ["id", "agente_slug", "secao", "titulo", "ativo", "ordem", "criado_em"],
    camposCriar: ["agente_slug", "secao", "titulo", "conteudo", "ordem", "ativo"],
    camposAtualizar: ["titulo", "conteudo", "ordem", "ativo"],
  },
  memoria_lead: {
    tabela: "hub_memorias_lead",
    label: "Memória do lead",
    camposLeitura: ["id", "lead_id", "chave", "valor", "resumo_ia", "criado_em"],
    camposCriar: ["lead_id", "chave", "valor", "resumo_ia", "dados_coletados"],
    camposAtualizar: ["chave", "valor", "resumo_ia", "dados_coletados", "preferencias_detectadas"],
  },
  memoria_agente: {
    tabela: "hub_memorias_agente",
    label: "Memória do agente",
    camposLeitura: ["id", "agente_slug", "chave", "origem", "criado_em"],
    camposCriar: ["agente_slug", "chave", "valor", "origem"],
    camposAtualizar: ["chave", "valor"],
  },
  hierarquia: {
    tabela: "hub_hierarquia",
    label: "Hierarquia org.",
    camposLeitura: ["id", "nome", "cargo", "area", "nivel_org", "agente_slug", "criado_em"],
    camposCriar: ["nome", "cargo", "area", "nivel_org", "agente_slug", "superior_id"],
    camposAtualizar: ["nome", "cargo", "area", "responsabilidades", "skills"],
  },
  personalidade: {
    tabela: "hub_personalidade",
    label: "Personalidade agente",
    camposLeitura: ["id", "agente_slug", "humor", "personalidade", "criado_em"],
    camposCriar: ["agente_slug", "humor", "personalidade", "tom_comunicacao"],
    camposAtualizar: ["humor", "personalidade", "descricao_comportamento", "tom_comunicacao"],
  },
  arquivo: {
    tabela: "hub_arquivos",
    label: "Arquivo / anexo",
    camposLeitura: ["id", "nome", "tipo", "origem", "url", "lead_id", "agente_slug", "criado_em"],
    camposCriar: ["nome", "tipo", "origem", "bucket", "caminho", "url", "lead_id", "agente_slug"],
    camposAtualizar: ["nome", "metadata"],
  },
  responsabilidade: {
    tabela: "hub_responsabilidades",
    label: "Responsabilidade KPI",
    camposLeitura: ["id", "supervisor_slug", "subordinado_slug", "kpi_slug", "descricao", "ativo", "criado_em"],
    camposCriar: ["supervisor_slug", "subordinado_slug", "kpi_slug", "descricao", "frequencia", "ativo"],
    camposAtualizar: ["descricao", "frequencia", "ativo"],
  },
  mensalidade: {
    tabela: "hub_tenant_mensalidades",
    label: "Mensalidade tenant",
    camposLeitura: ["id", "competencia", "valor_centavos", "status", "vencimento", "criado_em"],
    camposCriar: ["competencia", "valor_centavos", "status", "vencimento", "notas"],
    camposAtualizar: ["status", "vencimento", "notas", "pago_em"],
  },
  agenda_config: {
    tabela: "hub_tenant_agenda_config",
    label: "Config. agenda tenant",
    camposLeitura: ["id", "duracao_reserva_min", "abertura", "fechamento", "timezone", "criado_em"],
    camposCriar: ["duracao_reserva_min", "abertura", "fechamento", "timezone", "com_meet"],
    camposAtualizar: ["duracao_reserva_min", "abertura", "fechamento", "timezone", "com_meet"],
  },
  followup_config: {
    tabela: "hub_followup_config",
    label: "Config. follow-up",
    camposLeitura: ["id", "mercado", "passo", "horas_espera", "mensagem_template", "ativo", "criado_em"],
    camposCriar: ["mercado", "passo", "horas_espera", "mensagem_template", "ativo"],
    camposAtualizar: ["horas_espera", "mensagem_template", "ativo"],
  },
  ciclo_ia: {
    tabela: "hub_ciclos_ia",
    label: "Ciclo IA programado",
    camposLeitura: ["id", "agente_slug", "nome", "tipo", "ativo", "cron_expressao", "criado_em"],
    camposCriar: ["agente_slug", "nome", "descricao", "tipo", "cron_expressao", "intervalo_minutos", "ativo"],
    camposAtualizar: ["nome", "descricao", "ativo", "cron_expressao", "intervalo_minutos", "configuracoes"],
  },
  metricas_trafego: {
    tabela: "hub_metricas_trafego",
    label: "Métricas tráfego pago",
    camposLeitura: ["id", "campanha_id", "plataforma", "cpl", "roas", "verba_consumida", "criado_em"],
    camposCriar: ["campanha_id", "plataforma", "cpl", "roas", "ctr", "verba_consumida", "status_campanha"],
    camposAtualizar: ["cpl", "roas", "ctr", "verba_consumida", "status_campanha", "conversoes"],
  },
};

/** Chaves hub_int_crm_ent_* para todas as entidades operacionais. */
export const OPERACAO_ENTIDADES_TOOL_KEYS = OPERACAO_ENTIDADE_CATALOGO.map(
  (e) => `hub_int_crm_ent_${e.id}` as const
);

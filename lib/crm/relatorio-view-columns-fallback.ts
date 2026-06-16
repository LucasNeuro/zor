import type { RelatorioViewId } from "@/lib/crm/relatorio-views-catalog";

/** Colunas expostas por cada view (espelha a migration SQL; sem tenant_id). */
export const RELATORIO_VIEW_COLUNAS_FALLBACK: Record<RelatorioViewId, string[]> = {
  vw_rel_leads_enriquecidos: [
    "codigo", "nome", "telefone", "email", "email_exibicao", "origem", "campanha",
    "estagio", "estagio_funil", "estagio_atendimento", "score", "valor_estimado",
    "agente_responsavel", "humano_responsavel", "proxima_acao", "data_proxima_acao",
    "ultimo_contato", "ultima_mensagem", "criado_em", "atualizado_em",
    "pessoa_codigo", "pessoa_nome", "pessoa_cidade", "pessoa_estado", "pipeline_nome",
    "ultima_mensagem_fila", "ultima_mensagem_fila_em",
  ],
  vw_rel_negocios_pipeline: [
    "codigo", "titulo", "descricao", "tipo", "etapa", "status", "valor_estimado",
    "valor_fechado", "motivo_perda", "proxima_acao", "criado_em", "atualizado_em",
    "lead_nome", "lead_telefone", "lead_estagio", "pessoa_nome", "empresa_nome",
    "empresa_cnpj", "pipeline_nome",
  ],
  vw_rel_pessoas_cadastro: [
    "codigo", "nome", "telefone", "email", "tipo", "tipo_pessoa", "documento",
    "cidade", "estado", "origem", "area_atuacao", "criado_em", "empresa_nome", "empresa_cnpj",
  ],
  vw_rel_empresas_cadastro: [
    "codigo", "nome", "cnpj", "email", "telefone", "cidade", "estado", "ativo",
    "criado_em", "atualizado_em",
  ],
  vw_rel_atividades_timeline: [
    "tipo", "descricao", "feito_por", "feito_por_tipo", "criado_em",
    "lead_nome", "lead_telefone", "negocio_titulo", "negocio_codigo",
  ],
  vw_rel_notas_crm: [
    "conteudo", "criado_por", "criado_em", "atualizado_em", "lead_nome", "negocio_titulo",
  ],
  vw_rel_conversas_atendimento: [
    "canal", "status", "ia_ativa", "ia_modelo", "total_mensagens", "ultima_mensagem_em",
    "ultima_mensagem_preview", "aberta_em", "encerrada_em", "criado_em",
    "lead_nome", "lead_telefone", "lead_estagio", "pessoa_nome",
  ],
  vw_rel_mensagens_detalhe: [
    "remetente", "agente_id", "tipo_conteudo", "conteudo", "whatsapp_status",
    "email_status", "enviada_em", "criado_em", "conversa_canal", "conversa_status",
    "lead_nome", "lead_telefone",
  ],
  vw_rel_fila_mensagens: [
    "remetente_numero", "remetente_email", "conteudo", "tipo_midia", "status", "direcao",
    "canal", "tipo_conversa", "agente_responsavel", "tentativas", "erro",
    "recebida_em", "enviada_em", "processada_em", "criado_em",
    "lead_nome", "lead_telefone", "lead_estagio",
  ],
  vw_rel_msg_jobs: [
    "canal", "tipo", "status", "prioridade", "attempts", "max_attempts", "telefone",
    "agente_slug", "run_after", "available_at", "last_error", "created_at", "updated_at",
    "lead_nome", "lead_telefone",
  ],
  vw_rel_atendentes_crm: [
    "nome", "telefone", "email", "cargo", "agente_slug", "ativo", "criado_em", "atualizado_em",
  ],
  vw_rel_memorias_lead: [
    "chave", "valor", "nivel_engajamento", "resumo_ia", "confianca", "criado_por", "criado_em",
    "lead_nome", "lead_telefone", "lead_estagio",
  ],
  vw_rel_agentes_hub: [
    "agente_slug", "nome", "cargo", "area", "nivel", "personalidade", "tom_voz",
    "modelo_padrao", "modo_operacao", "whatsapp_numero", "email_from", "email_ativo",
    "motor_ferramentas_habilitado", "ativo", "criado_em", "atualizado_em",
  ],
  vw_rel_prompt_logs: [
    "agente_slug", "modelo_usado", "tokens_input", "tokens_output", "custo_brl",
    "tempo_resposta_ms", "confianca", "foi_escalado", "motivo_escalada", "criado_em", "lead_nome",
  ],
  vw_rel_acoes_ia: [
    "agente_slug", "tipo", "descricao", "resultado", "tokens_usados", "custo_brl",
    "sucesso", "erro", "criado_em", "lead_nome",
  ],
  vw_rel_kpis_resultados: [
    "kpi_slug", "kpi_nome", "kpi_categoria", "kpi_unidade", "agente_slug", "valor",
    "periodo_inicio", "periodo_fim", "amostras", "dentro_da_meta", "nivel_alerta", "criado_em",
  ],
  vw_rel_kpis_metas: [
    "kpi_slug", "kpi_nome", "kpi_categoria", "agente_slug", "valor_meta", "valor_atencao",
    "valor_critico", "frequencia", "ativo", "criado_em",
  ],
  vw_rel_aprovacoes: [
    "tipo", "agente_slug", "agente_nome", "descricao", "status", "valor_envolvido", "prazo",
    "confianca_ia", "aprovado_por", "aprovado_em", "criado_em", "lead_nome",
  ],
  vw_rel_alertas_operacao: [
    "tipo", "agente_slug", "titulo", "mensagem", "lido", "resolvido",
    "notificado_whatsapp", "criado_em", "lead_nome",
  ],
  vw_rel_metricas_trafego: [
    "campanha_id", "plataforma", "cpl", "roas", "ctr", "cpa", "impressoes", "cliques",
    "conversoes", "verba_consumida", "status_campanha", "criado_em",
  ],
  vw_rel_conhecimento_tenant: [
    "nome_arquivo", "titulo", "mime_type", "tamanho_bytes", "status", "chunks_count",
    "criado_em", "indexado_em",
  ],
  vw_rel_rag_documentos: [
    "agente_slug", "nome_arquivo", "mime_type", "tamanho_bytes", "status", "origem",
    "criado_em", "atualizado_em",
  ],
  vw_rel_integracoes_hub: [
    "integracao_id", "nome", "status", "ativo", "criado_em", "atualizado_em",
  ],
  vw_rel_ferramentas_externas: [
    "ferramenta_key", "titulo", "descricao_curta", "metodo_http", "politica", "ativo", "criado_em",
  ],
  vw_rel_auditoria_sistema: [
    "actor_nome", "actor_email", "acao", "entidade", "entidade_id", "resumo", "criado_em",
  ],
  vw_rel_contatos_notificacao: [
    "nome", "telefone", "email", "cargo", "ativo", "receber_novo_lead", "receber_aprovacao", "canal", "criado_em",
  ],
  vw_rel_users_acesso: [
    "name", "email", "phone", "role", "status", "cargo_acesso", "cargo_slug", "created_at",
  ],
  vw_rel_contas_receber: ["descricao", "valor", "vencimento", "status", "criado_em"],
  vw_rel_contas_pagar: ["descricao", "valor", "vencimento", "status", "criado_em"],
  vw_rel_fluxo_caixa: ["tipo", "descricao", "valor", "vencimento", "status", "criado_em"],
  vw_rel_imoveis_captacao: [
    "codigo", "titulo", "tipo", "status", "valor", "cidade", "estado", "criado_em",
  ],
};

export function colunasFallbackView(viewId: RelatorioViewId): string[] {
  return RELATORIO_VIEW_COLUNAS_FALLBACK[viewId] ?? [];
}

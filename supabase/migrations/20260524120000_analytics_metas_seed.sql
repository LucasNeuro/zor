-- Analytics: KPI fila + metas por agente (doc mestre §6.1.7)

INSERT INTO public.hub_kpis_definicao (slug, nome, descricao, unidade)
VALUES
  ('mensagens_fila_pendentes', 'Mensagens na fila', 'Entrada pendente em hub_fila_mensagens', 'un')
ON CONFLICT (slug) DO NOTHING;

DO $$
BEGIN
  ALTER TABLE public.hub_kpis_metas
    ADD CONSTRAINT hub_kpis_metas_slug_agente_key UNIQUE (kpi_slug, agente_slug);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.hub_kpis_metas (kpi_slug, agente_slug, valor_meta, tenant_id)
VALUES
  ('taxa_qualificacao', 'sdr', 40, default_obra10_tenant_id()),
  ('taxa_qualificacao', 'atendente', 35, default_obra10_tenant_id()),
  ('taxa_conversao_negocio', 'gerente_atendimento', 15, default_obra10_tenant_id()),
  ('mensagens_fila_pendentes', 'atendente', 10, default_obra10_tenant_id()),
  ('mensagens_fila_pendentes', 'gerente_atendimento', 5, default_obra10_tenant_id()),
  ('aprovacoes_pendentes', 'diretor_geral_ia', 5, default_obra10_tenant_id())
ON CONFLICT (kpi_slug, agente_slug) DO NOTHING;

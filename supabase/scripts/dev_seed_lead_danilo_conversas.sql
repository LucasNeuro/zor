-- DEV / PREVIEW — conversa simulada para visualizar balões (Lead · IA · Humano)
-- Alvo: lead Danilo (#LED-2026-0001 ou nome ILIKE 'Danilo%')
-- Seguro para reexecutar: remove apenas mensagens demo (metadata.demo = chat_preview)

BEGIN;

DO $$
DECLARE
  v_lead_id   uuid;
  v_tenant_id uuid;
  v_telefone  text;
  v_conversa  uuid;
  v_agente_ia text;
  t0          timestamptz := now() - interval '2 hours';
BEGIN
  SELECT l.id, l.tenant_id, COALESCE(NULLIF(regexp_replace(l.telefone, '\D', '', 'g'), ''), '5514985626300')
  INTO v_lead_id, v_tenant_id, v_telefone
  FROM public.hub_leads_crm l
  WHERE l.codigo = 'LED-2026-0001'
     OR l.nome ILIKE 'Danilo%'
  ORDER BY CASE WHEN l.codigo = 'LED-2026-0001' THEN 0 ELSE 1 END, l.criado_em DESC
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'Lead Danilo não encontrado. Crie o lead ou ajuste codigo/nome no script.';
  END IF;

  SELECT COALESCE(
    (SELECT agente_slug FROM public.hub_agente_identidade WHERE ativo = true ORDER BY criado_em LIMIT 1),
    'lia'
  )
  INTO v_agente_ia;

  -- Remove demo anterior
  DELETE FROM public.hub_fila_mensagens
  WHERE lead_id = v_lead_id
    AND COALESCE(metadata->>'demo', '') = 'chat_preview';

  DELETE FROM public.hub_mensagens
  WHERE lead_id = v_lead_id
    AND COALESCE(metadados->>'demo', '') = 'chat_preview';

  -- Conversa ativa (reutiliza se já existir demo)
  SELECT c.id INTO v_conversa
  FROM public.hub_conversas c
  WHERE c.lead_id = v_lead_id
    AND COALESCE(c.dados_extras->>'demo', '') = 'chat_preview'
  LIMIT 1;

  IF v_conversa IS NULL THEN
    INSERT INTO public.hub_conversas (
      lead_id,
      canal,
      status,
      ia_ativa,
      ia_modelo,
      total_mensagens,
      ultima_mensagem_em,
      ultima_mensagem_preview,
      dados_extras,
      tenant_id
    )
    VALUES (
      v_lead_id,
      'whatsapp',
      'ativa',
      true,
      'mistral-small-latest',
      8,
      t0 + interval '95 minutes',
      'Combinado, pode ser às 10h. Obrigado!',
      '{"demo":"chat_preview"}'::jsonb,
      v_tenant_id
    )
    RETURNING id INTO v_conversa;
  END IF;

  -- hub_fila_mensagens — é o que o CRM lê em /api/crm/atendimento/mensagens
  INSERT INTO public.hub_fila_mensagens (
    lead_id, conversa_id, remetente_numero, conteudo, direcao, agente_id,
    status, resposta_enviada, enviada_em, canal, tenant_id, metadata, criado_em
  )
  VALUES
    (
      v_lead_id, v_conversa, v_telefone,
      'Olá! Vi o anúncio no Instagram e quero saber mais sobre os serviços da Waje.',
      'entrada', NULL, 'enviado', false, t0 + interval '0 minutes', 'whatsapp', v_tenant_id,
      '{"demo":"chat_preview","participante":"lead"}'::jsonb, t0 + interval '0 minutes'
    ),
    (
      v_lead_id, v_conversa, v_telefone,
      'Olá Danilo! Sou a Lia, assistente comercial da Waje. Posso te ajudar a entender qual solução faz mais sentido. Qual é o seu principal interesse agora?',
      'saida', v_agente_ia, 'enviado', true, t0 + interval '2 minutes', 'whatsapp', v_tenant_id,
      jsonb_build_object('demo', 'chat_preview', 'participante', 'ia', 'agente_slug', v_agente_ia),
      t0 + interval '2 minutes'
    ),
    (
      v_lead_id, v_conversa, v_telefone,
      'Preciso de apoio comercial para minha empresa de software — estamos estruturando o funil de vendas.',
      'entrada', NULL, 'enviado', false, t0 + interval '8 minutes', 'whatsapp', v_tenant_id,
      '{"demo":"chat_preview","participante":"lead"}'::jsonb, t0 + interval '8 minutes'
    ),
    (
      v_lead_id, v_conversa, v_telefone,
      'Perfeito, Danilo. Para te orientar melhor: qual faixa de investimento você considera para este projeto nos próximos 60 dias?',
      'saida', v_agente_ia, 'enviado', true, t0 + interval '10 minutes', 'whatsapp', v_tenant_id,
      jsonb_build_object('demo', 'chat_preview', 'participante', 'ia', 'agente_slug', v_agente_ia),
      t0 + interval '10 minutes'
    ),
    (
      v_lead_id, v_conversa, v_telefone,
      'Entre R$ 15 mil e R$ 30 mil. Quero começar ainda este mês.',
      'entrada', NULL, 'enviado', false, t0 + interval '18 minutes', 'whatsapp', v_tenant_id,
      '{"demo":"chat_preview","participante":"lead"}'::jsonb, t0 + interval '18 minutes'
    ),
    (
      v_lead_id, v_conversa, v_telefone,
      'Registrei o perfil e o valor estimado. Se quiser, um consultor humano pode assumir agora para fechar os próximos passos com você.',
      'saida', v_agente_ia, 'enviado', true, t0 + interval '20 minutes', 'whatsapp', v_tenant_id,
      jsonb_build_object('demo', 'chat_preview', 'participante', 'ia', 'agente_slug', v_agente_ia),
      t0 + interval '20 minutes'
    ),
    (
      v_lead_id, v_conversa, v_telefone,
      'Danilo, aqui é o Lucas da Waje. Vi o histórico com a Lia — posso agendar uma call amanhã às 10h para alinhar proposta?',
      'saida', 'operador-demo', 'enviado', true, t0 + interval '35 minutes', 'whatsapp', v_tenant_id,
      '{"demo":"chat_preview","participante":"humano","feito_por_tipo":"humano","operador_nome":"Consultor demo"}'::jsonb,
      t0 + interval '35 minutes'
    ),
    (
      v_lead_id, v_conversa, v_telefone,
      'Combinado, pode ser às 10h. Obrigado!',
      'entrada', NULL, 'enviado', false, t0 + interval '42 minutes', 'whatsapp', v_tenant_id,
      '{"demo":"chat_preview","participante":"lead"}'::jsonb, t0 + interval '42 minutes'
    );

  -- hub_mensagens — espelho canônico (se quiser usar em outros ecrãs)
  INSERT INTO public.hub_mensagens (
    conversa_id, lead_id, remetente, agente_id, tipo_conteudo, conteudo,
    tenant_id, enviada_em, metadados
  )
  SELECT
    v_conversa,
    v_lead_id,
    CASE
      WHEN f.direcao = 'entrada' THEN 'lead'
      WHEN COALESCE(f.metadata->>'participante', '') = 'humano' THEN 'humano'
      ELSE 'ia'
    END,
    f.agente_id,
    'texto',
    f.conteudo,
    v_tenant_id,
    f.enviada_em,
    COALESCE(f.metadata, '{}'::jsonb)
  FROM public.hub_fila_mensagens f
  WHERE f.lead_id = v_lead_id
    AND COALESCE(f.metadata->>'demo', '') = 'chat_preview';

  UPDATE public.hub_leads_crm
  SET
    ultimo_contato = t0 + interval '42 minutes',
    ultima_mensagem = 'Combinado, pode ser às 10h. Obrigado!',
    humano_responsavel = NULL,
    atualizado_em = now()
  WHERE id = v_lead_id;

  UPDATE public.hub_conversas
  SET
    total_mensagens = 8,
    ultima_mensagem_em = t0 + interval '42 minutes',
    ultima_mensagem_preview = 'Combinado, pode ser às 10h. Obrigado!',
    atualizado_em = now()
  WHERE id = v_conversa;

  RAISE NOTICE 'Conversa demo inserida para lead % (agente IA: %, conversa: %)', v_lead_id, v_agente_ia, v_conversa;
END $$;

COMMIT;

-- Verificação rápida:
-- SELECT direcao, agente_id, left(conteudo, 60) AS preview, enviada_em
-- FROM hub_fila_mensagens
-- WHERE lead_id = (SELECT id FROM hub_leads_crm WHERE codigo = 'LED-2026-0001' LIMIT 1)
-- ORDER BY enviada_em;

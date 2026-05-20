-- Garante que todos os agentes com linha WhatsApp (UAZAPI) operem como canal_whatsapp
-- com motor de ferramentas e cargo de atendimento com perguntas essenciais fluidas.

UPDATE public.hub_agente_identidade
SET
  modo_operacao = 'canal_whatsapp',
  ciclo_execucao_padrao = COALESCE(ciclo_execucao_padrao, 'interacao'),
  motor_ferramentas_habilitado = true,
  uso_ferramentas_ia = COALESCE(uso_ferramentas_ia, '{}'::jsonb) || jsonb_build_object(
    'hub_atualizar_lead', true,
    'hub_lead_memorias', true,
    'hub_lead_resumo', true,
    'hub_registar_nota_lead', true
  ),
  atualizado_em = now()
WHERE ativo IS NOT DISTINCT FROM true
  AND arquivado_em IS NULL
  AND NULLIF(trim(coalesce(uazapi_instance_token, '')), '') IS NOT NULL;

-- Cargos de atendimento / qualificação: perguntas essenciais (padrão Obra10+ do wizard)
UPDATE public.hub_cargos_catalogo
SET
  usar_perguntas_essenciais = true,
  ordem_perguntas_essenciais = COALESCE(
    NULLIF(trim(ordem_perguntas_essenciais), ''),
    'inicio'
  ),
  saudacao_cliente = COALESCE(
    NULLIF(trim(saudacao_cliente), ''),
    'Oi, tudo bem? Meu nome é [Nome], da Obra10+. Vi que você entrou em contato conosco — como posso te ajudar hoje? Qual seu Nome?'
  ),
  comprimento_padrao = COALESCE(
    NULLIF(trim(comprimento_padrao), ''),
    'Respostas devem ser objetivas, com no máximo 2 frases por mensagem.'
  ),
  perguntas_essenciais = CASE
    WHEN coalesce(array_length(perguntas_essenciais, 1), 0) >= 1 THEN perguntas_essenciais
    ELSE ARRAY[
      'Qual é o principal objetivo que você busca com esse projeto ou reforma?',
      'Qual é o seu orçamento estimado para esse projeto?',
      'Qual é o prazo que você tem em mente para iniciar ou concluir?',
      'Quem são os decisores envolvidos nesse processo?',
      'Já trabalhou com algum fornecedor ou prestador de serviço neste tipo de projeto?'
    ]::text[]
  END,
  atualizado_em = now()
WHERE ativo IS NOT DISTINCT FROM true
  AND (
    concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|atend|comercial|vendas|closer|capta|obra10|whatsapp)'
    OR coalesce(array_length(perguntas_essenciais, 1), 0) >= 1
    OR usar_perguntas_essenciais = true
  );

COMMENT ON COLUMN public.hub_cargos_catalogo.perguntas_essenciais IS
  'Perguntas obrigatórias do cargo; a engine injeta só a próxima por turno (não lista completa ao cliente).';

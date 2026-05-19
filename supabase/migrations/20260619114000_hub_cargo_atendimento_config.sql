-- Configuração operacional por cargo para canais externos (WhatsApp etc.)
-- Mantém comportamento e conhecimento no catálogo de cargos, reduzindo redundância no wizard.

ALTER TABLE IF EXISTS public.hub_cargos_catalogo
  ADD COLUMN IF NOT EXISTS saudacao_cliente text,
  ADD COLUMN IF NOT EXISTS usar_perguntas_essenciais boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordem_perguntas_essenciais text NOT NULL DEFAULT 'inicio',
  ADD COLUMN IF NOT EXISTS perguntas_essenciais text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS comprimento_padrao text;

-- Backfill inicial com padrões por tipo de cargo (100% editáveis no CRM).
UPDATE public.hub_cargos_catalogo
SET
  saudacao_cliente = CASE
    WHEN trim(coalesce(saudacao_cliente, '')) <> '' THEN saudacao_cliente
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|closer|vendas|comercial|inside sales|pré-venda|pre-venda)'
      THEN 'Olá! Aqui é o time de atendimento. Posso te ajudar com algumas perguntas rápidas?'
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(suporte|support|atendimento|help|sac|pós-venda|pos-venda)'
      THEN 'Olá! Aqui é o suporte. Me conta rapidamente o que aconteceu para eu te ajudar.'
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(operaç|operac|analista|finance|cobran|backoffice|processo)'
      THEN 'Olá! Vou validar seu pedido e já te atualizo com o próximo passo.'
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(marketing|tráfego|trafego|copy|social|conteúdo|conteudo)'
      THEN 'Olá! Vamos entender seu objetivo para te direcionar da melhor forma.'
    ELSE 'Olá! Aqui é o time de atendimento. Como posso te ajudar hoje?'
  END,
  usar_perguntas_essenciais = CASE
    WHEN usar_perguntas_essenciais = true THEN true
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|closer|vendas|comercial|inside sales|pré-venda|pre-venda|suporte|support|atendimento|help|sac|pós-venda|pos-venda|operaç|operac|analista|finance|cobran|backoffice|processo|marketing|tráfego|trafego|copy|social|conteúdo|conteudo)'
      THEN true
    ELSE false
  END,
  ordem_perguntas_essenciais = CASE
    WHEN coalesce(ordem_perguntas_essenciais, '') IN ('inicio', 'final') THEN ordem_perguntas_essenciais
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(operaç|operac|analista|finance|cobran|backoffice|processo)'
      THEN 'final'
    ELSE 'inicio'
  END,
  perguntas_essenciais = CASE
    WHEN coalesce(array_length(perguntas_essenciais, 1), 0) > 0 THEN perguntas_essenciais
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|closer|vendas|comercial|inside sales|pré-venda|pre-venda)'
      THEN ARRAY[
        'Qual o seu nome?',
        'O que procura no momento?',
        'Qual região ou faixa de valor?',
        'Qual o prazo para decidir?'
      ]::text[]
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(suporte|support|atendimento|help|sac|pós-venda|pos-venda)'
      THEN ARRAY[
        'O que aconteceu exatamente?',
        'Quando começou o problema?',
        'Qual produto/serviço está envolvido?',
        'Qual é o melhor contato para retorno?'
      ]::text[]
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(operaç|operac|analista|finance|cobran|backoffice|processo)'
      THEN ARRAY[
        'Qual é a sua solicitação principal?',
        'Você tem algum número de pedido/protocolo?',
        'Há prazo limite para essa solicitação?'
      ]::text[]
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(marketing|tráfego|trafego|copy|social|conteúdo|conteudo)'
      THEN ARRAY[
        'Qual objetivo principal da campanha/projeto?',
        'Qual o público-alvo?',
        'Qual orçamento ou limite de investimento?'
      ]::text[]
    ELSE perguntas_essenciais
  END,
  comprimento_padrao = CASE
    WHEN trim(coalesce(comprimento_padrao, '')) <> '' THEN comprimento_padrao
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(operaç|operac|analista|finance|cobran|backoffice|processo)'
      THEN 'Máx. 3 frases por mensagem; priorize clareza.'
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|closer|vendas|comercial|inside sales|pré-venda|pre-venda|suporte|support|atendimento|help|sac|pós-venda|pos-venda|marketing|tráfego|trafego|copy|social|conteúdo|conteudo)'
      THEN 'Máx. 2 frases por mensagem.'
    ELSE 'Máx. 2 frases por mensagem.'
  END;

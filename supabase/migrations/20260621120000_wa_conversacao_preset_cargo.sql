-- Cargo canónico do preset «Conversação WhatsApp Waje» (playbook + perguntas + proatividade).

INSERT INTO public.hub_cargos_catalogo (
  slug,
  titulo,
  segmento,
  especialidade,
  area,
  nivel,
  modelo_padrao,
  modelo_critico,
  modelo_alto_valor,
  descricao_curta,
  descricao,
  saudacao_cliente,
  usar_perguntas_essenciais,
  ordem_perguntas_essenciais,
  perguntas_essenciais,
  comprimento_padrao,
  prompt_template,
  pode_fazer_padrao,
  nao_pode_fazer_padrao,
  ativo
) VALUES (
  'atendimento-whatsapp-waje',
  'Atendimento WhatsApp — Conversação',
  'Atendimento',
  'WhatsApp',
  'atendimento',
  2,
  'mistral-small-latest',
  'mistral-small-latest',
  'mistral-small-latest',
  'Primeiro atendimento e qualificação em WhatsApp com playbook, menus e follow-up.',
  'Agente de conversação WhatsApp. Acolhe, qualifica com perguntas sequenciais, usa base de conhecimento e playbook publicado. Regista dados no CRM e encaminha ao humano quando necessário.',
  'Olá! Meu nome é [Nome]. Vi que você entrou em contato — como posso te ajudar hoje? Qual é o seu nome, por gentileza?',
  true,
  'inicio',
  ARRAY[
    'Qual é o seu nome?',
    'O que você busca no momento?',
    'Qual região ou contexto se aplica?',
    'Qual o prazo para decidir ou avançar?',
    'Prefere falar com um atendente humano agora?'
  ]::text[],
  'Máx. 2–3 linhas por mensagem; uma pergunta por vez.',
  'Siga o playbook publicado como fonte principal. Use a base de conhecimento da empresa — não invente preços, prazos ou condições. Seja proativo: sempre indique o próximo passo. Uma pergunta por mensagem. Use hub_whatsapp_menu para triagem e decisões binárias. Registe dados com hub_atualizar_lead.',
  ARRAY[
    'Acolher e qualificar leads no WhatsApp',
    'Conduzir fluxo do playbook com menus',
    'Registar dados no CRM durante a conversa',
    'Responder com base na documentação indexada'
  ]::text[],
  ARRAY[
    'Inventar preços, prazos ou políticas não documentadas',
    'Prometer resultados sem base na base de conhecimento',
    'Mencionar cargo interno (SDR, qualificador)',
    'Repetir menu de triagem já respondido'
  ]::text[],
  true
)
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  segmento = EXCLUDED.segmento,
  especialidade = EXCLUDED.especialidade,
  area = EXCLUDED.area,
  descricao_curta = EXCLUDED.descricao_curta,
  descricao = EXCLUDED.descricao,
  saudacao_cliente = COALESCE(NULLIF(trim(hub_cargos_catalogo.saudacao_cliente), ''), EXCLUDED.saudacao_cliente),
  usar_perguntas_essenciais = EXCLUDED.usar_perguntas_essenciais,
  ordem_perguntas_essenciais = EXCLUDED.ordem_perguntas_essenciais,
  perguntas_essenciais = CASE
    WHEN coalesce(array_length(hub_cargos_catalogo.perguntas_essenciais, 1), 0) >= 1
      THEN hub_cargos_catalogo.perguntas_essenciais
    ELSE EXCLUDED.perguntas_essenciais
  END,
  comprimento_padrao = COALESCE(NULLIF(trim(hub_cargos_catalogo.comprimento_padrao), ''), EXCLUDED.comprimento_padrao),
  prompt_template = COALESCE(NULLIF(trim(hub_cargos_catalogo.prompt_template), ''), EXCLUDED.prompt_template),
  pode_fazer_padrao = CASE
    WHEN coalesce(array_length(hub_cargos_catalogo.pode_fazer_padrao, 1), 0) >= 1
      THEN hub_cargos_catalogo.pode_fazer_padrao
    ELSE EXCLUDED.pode_fazer_padrao
  END,
  nao_pode_fazer_padrao = CASE
    WHEN coalesce(array_length(hub_cargos_catalogo.nao_pode_fazer_padrao, 1), 0) >= 1
      THEN hub_cargos_catalogo.nao_pode_fazer_padrao
    ELSE EXCLUDED.nao_pode_fazer_padrao
  END,
  ativo = true,
  atualizado_em = now();

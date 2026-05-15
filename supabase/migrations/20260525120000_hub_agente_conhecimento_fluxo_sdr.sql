-- Permite secção POP / fluxo operacional (id técnico fluxo_sdr) em hub_agente_conhecimento.secao
ALTER TABLE public.hub_agente_conhecimento
  DROP CONSTRAINT IF EXISTS hub_agente_conhecimento_secao_check;

ALTER TABLE public.hub_agente_conhecimento
  ADD CONSTRAINT hub_agente_conhecimento_secao_check
  CHECK (
    secao IN (
      'empresa',
      'servicos',
      'atendimento',
      'proibicoes',
      'exemplos',
      'objeccoes',
      'fluxo_sdr'
    )
  );

-- Origens de memória para superagentes internos (WhatsApp gestor, ciclos).

ALTER TABLE public.hub_memorias_agente
  DROP CONSTRAINT IF EXISTS hub_memorias_agente_origem_check;

ALTER TABLE public.hub_memorias_agente
  ADD CONSTRAINT hub_memorias_agente_origem_check
  CHECK (
    origem IN (
      'ia_engine',
      'briefing',
      'whatsapp',
      'gestor_whatsapp',
      'manual',
      'ciclo_programado'
    )
  );

COMMENT ON TABLE public.hub_memorias_agente IS
  'Memórias persistentes do superagente interno — reutilizadas em copiloto, WhatsApp gestor e ciclos (entre dias).';

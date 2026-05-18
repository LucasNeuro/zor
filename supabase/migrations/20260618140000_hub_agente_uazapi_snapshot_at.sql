-- Momento em que o espelho uazapi_connection_status (e campos relacionados) foi gravado no hub.
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS uazapi_snapshot_at TIMESTAMPTZ;

COMMENT ON COLUMN public.hub_agente_identidade.uazapi_snapshot_at IS
  'Última gravação local do estado UAZAPI (wizard/ficha); Canais lê só daqui, sem bater na API externa.';

-- Proxy regional UAZAPI por agente (cidade do número / pareamento QR).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS uazapi_proxy_country TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_proxy_state TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_proxy_city TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.uazapi_proxy_country IS 'ISO alpha-2 (ex. br) para POST /instance/connect.';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_proxy_state IS 'UF/submotion (ex. sp) quando exigido pelo catálogo UAZAPI.';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_proxy_city IS 'Slug da cidade (cities[].value) para proxy regional UAZAPI.';

-- Idempotente: colunas de mídia em hub_fila_mensagens / hub_mensagens (chat CRM).
-- Rode no SQL Editor se o deploy ainda não aplicou 20260622240000_hub_fila_mensagens_midia_cols.sql

ALTER TABLE public.hub_fila_mensagens
  ADD COLUMN IF NOT EXISTS tipo_conteudo TEXT DEFAULT 'texto',
  ADD COLUMN IF NOT EXISTS nome_arquivo TEXT,
  ADD COLUMN IF NOT EXISTS url_midia TEXT,
  ADD COLUMN IF NOT EXISTS tipo_midia TEXT;

ALTER TABLE public.hub_mensagens
  ADD COLUMN IF NOT EXISTS url_midia TEXT,
  ADD COLUMN IF NOT EXISTS nome_arquivo TEXT;

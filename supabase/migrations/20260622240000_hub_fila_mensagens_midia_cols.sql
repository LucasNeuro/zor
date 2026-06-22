-- Mídia no histórico CRM (atendimento humano + WhatsApp): colunas alinhadas a hub_mensagens.

ALTER TABLE public.hub_fila_mensagens
  ADD COLUMN IF NOT EXISTS tipo_conteudo TEXT DEFAULT 'texto',
  ADD COLUMN IF NOT EXISTS nome_arquivo TEXT,
  ADD COLUMN IF NOT EXISTS url_midia TEXT,
  ADD COLUMN IF NOT EXISTS tipo_midia TEXT;

ALTER TABLE public.hub_mensagens
  ADD COLUMN IF NOT EXISTS url_midia TEXT,
  ADD COLUMN IF NOT EXISTS nome_arquivo TEXT;

COMMENT ON COLUMN public.hub_fila_mensagens.tipo_conteudo IS
  'texto | audio | imagem | documento | video — espelha hub_mensagens para UI do chat CRM.';
COMMENT ON COLUMN public.hub_fila_mensagens.nome_arquivo IS
  'Nome do ficheiro quando direcao=saida com anexo (atendimento humano).';

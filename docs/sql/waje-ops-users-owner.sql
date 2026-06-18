-- Acesso operacional Waje (/ops) via coluna owner em public.users
-- Idempotente — cole no SQL Editor do Supabase

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS owner BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.owner IS
  'Equipe Waje com acesso ao console operacional (/ops). Não confundir com dono do tenant CRM.';

CREATE INDEX IF NOT EXISTS idx_users_owner_ops
  ON public.users (owner)
  WHERE owner = true;

-- Liberar acesso (ajuste o e-mail):
-- UPDATE public.users SET owner = true WHERE lower(trim(email)) = 'seu-email@waje.com.br';

NOTIFY pgrst, 'reload schema';

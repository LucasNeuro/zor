-- Rodar no Supabase SQL Editor antes de emitir cobranças Cora.
-- Espelha: supabase/migrations/20260718140000_users_billing_cora.sql

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS document_type text NULL,
  ADD COLUMN IF NOT EXISTS document text NULL,
  ADD COLUMN IF NOT EXISTS billing_legal_name text NULL,
  ADD COLUMN IF NOT EXISTS billing_cep text NULL,
  ADD COLUMN IF NOT EXISTS billing_logradouro text NULL,
  ADD COLUMN IF NOT EXISTS billing_numero text NULL,
  ADD COLUMN IF NOT EXISTS billing_complemento text NULL,
  ADD COLUMN IF NOT EXISTS billing_bairro text NULL,
  ADD COLUMN IF NOT EXISTS billing_cidade text NULL,
  ADD COLUMN IF NOT EXISTS billing_uf text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_document_type_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_document_type_check
      CHECK (document_type IS NULL OR document_type IN ('CPF', 'CNPJ'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_tenant_billing_doc
  ON public.users (tenant_id, document)
  WHERE document IS NOT NULL AND tenant_id IS NOT NULL;

UPDATE public.users u
SET tenant_id = t.id
FROM public.hub_tenants t
WHERE u.tenant_id IS NULL
  AND t.settings IS NOT NULL
  AND lower(trim(u.email)) = lower(trim(t.settings->'primary_contact'->>'email'));

UPDATE public.users u
SET
  document_type = COALESCE(
    u.document_type,
    CASE
      WHEN nullif(regexp_replace(coalesce(t.settings->>'cpf', ''), '\D', '', 'g'), '') IS NOT NULL THEN 'CPF'
      WHEN nullif(regexp_replace(coalesce(t.settings->>'cnpj', ''), '\D', '', 'g'), '') IS NOT NULL THEN 'CNPJ'
      WHEN nullif(regexp_replace(coalesce(t.settings->'empresa_cadastral'->>'cnpj', ''), '\D', '', 'g'), '') IS NOT NULL THEN 'CNPJ'
      WHEN upper(coalesce(t.settings->>'registration_type', 'PJ')) = 'PF' THEN 'CPF'
      ELSE 'CNPJ'
    END
  ),
  document = COALESCE(
    nullif(regexp_replace(coalesce(u.document, ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce(t.settings->>'cpf', ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce(t.settings->>'cnpj', ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce(t.settings->'empresa_cadastral'->>'cnpj', ''), '\D', '', 'g'), '')
  ),
  billing_legal_name = COALESCE(
    nullif(trim(u.billing_legal_name), ''),
    nullif(trim(t.nome_exibicao), ''),
    nullif(trim(t.settings->>'trade_name'), ''),
    nullif(trim(t.settings->'empresa_cadastral'->>'razao_social'), ''),
    nullif(trim(u.name), '')
  ),
  billing_cep = COALESCE(
    nullif(regexp_replace(coalesce(u.billing_cep, ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce(t.settings->'address'->>'cep', ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce(t.settings->'empresa_cadastral'->>'cep', ''), '\D', '', 'g'), '')
  ),
  billing_logradouro = COALESCE(
    nullif(trim(u.billing_logradouro), ''),
    nullif(trim(t.settings->'address'->>'logradouro'), ''),
    nullif(trim(t.settings->'empresa_cadastral'->>'logradouro'), '')
  ),
  billing_numero = COALESCE(
    nullif(trim(u.billing_numero), ''),
    nullif(trim(t.settings->'address'->>'numero'), ''),
    nullif(trim(t.settings->'empresa_cadastral'->>'numero'), '')
  ),
  billing_complemento = COALESCE(
    nullif(trim(u.billing_complemento), ''),
    nullif(trim(t.settings->'address'->>'complemento'), ''),
    nullif(trim(t.settings->'empresa_cadastral'->>'complemento'), '')
  ),
  billing_bairro = COALESCE(
    nullif(trim(u.billing_bairro), ''),
    nullif(trim(t.settings->'address'->>'bairro'), ''),
    nullif(trim(t.settings->'empresa_cadastral'->>'bairro'), '')
  ),
  billing_cidade = COALESCE(
    nullif(trim(u.billing_cidade), ''),
    nullif(trim(t.settings->'address'->>'cidade'), ''),
    nullif(trim(t.settings->'empresa_cadastral'->>'cidade'), '')
  ),
  billing_uf = COALESCE(
    nullif(upper(trim(u.billing_uf)), ''),
    nullif(upper(trim(t.settings->'address'->>'uf')), ''),
    nullif(upper(trim(t.settings->'empresa_cadastral'->>'estado')), '')
  )
FROM public.hub_tenants t
WHERE u.tenant_id = t.id
  AND (
    u.document IS NULL
    OR u.billing_legal_name IS NULL
    OR u.billing_cep IS NULL
  );

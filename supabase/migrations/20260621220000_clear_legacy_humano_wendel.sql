-- Remove placeholder legado de demo (wendel) — handoff humano passa a exigir "Assumir" com utilizador logado.
UPDATE public.hub_leads_crm
SET humano_responsavel = NULL,
    atualizado_em = now()
WHERE lower(trim(humano_responsavel)) = 'wendel';

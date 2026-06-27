-- Corrige nomes de lead gravados por engano (frases de conversa, ex.: «Oi está aí»).
-- Preferência: wa_push_name no metadata → capitalizar → senão Lead + últimos 4 dígitos do telefone.

UPDATE hub_leads_crm l
SET
  nome = COALESCE(
    NULLIF(
      initcap(
        trim(
          regexp_replace(
            COALESCE(l.metadata->>'wa_push_name', ''),
            '\s+',
            ' ',
            'g'
          )
        )
      ),
      ''
    ),
    'Lead ' || right(regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g'), 4)
  ),
  atualizado_em = now()
WHERE
  nome IS NOT NULL
  AND length(trim(nome)) >= 2
  AND (
    lower(trim(nome)) LIKE 'lead %'
    OR lower(trim(nome)) ~ '\m(oi|olá|ola|está|esta|aí|ai|agenda|perguntei|desmarque|tudo|bem|sobre|minha|tenho)\M'
  );

-- Remove memória «nome» inválida (IA/playbook antigo).
DELETE FROM hub_memorias_lead m
WHERE m.chave = 'nome'
  AND EXISTS (
    SELECT 1
    FROM hub_leads_crm l
    WHERE l.id = m.lead_id
      AND (
        lower(trim(m.valor)) ~ '\m(oi|olá|ola|está|esta|aí|ai|agenda|perguntei|desmarque|tudo|bem|sobre|minha|tenho)\M'
      )
  );

-- Alinha pessoa ligada quando o nome ainda é frase inválida.
UPDATE hub_pessoas p
SET
  nome = l.nome,
  atualizado_em = now()
FROM hub_leads_crm l
WHERE l.pessoa_id = p.id
  AND l.nome IS NOT NULL
  AND p.nome IS DISTINCT FROM l.nome
  AND (
    lower(trim(p.nome)) ~ '\m(oi|olá|ola|está|esta|aí|ai|agenda|perguntei|desmarque|tudo|bem|sobre|minha|tenho)\M'
    OR lower(trim(p.nome)) LIKE 'lead %'
  );

-- Rode no SQL Editor do Supabase (produção) para validar Maria e demais agentes WhatsApp.

SELECT
  i.agente_slug,
  i.nome,
  i.cargo,
  i.modo_operacao,
  i.motor_ferramentas_habilitado,
  i.uazapi_connection_status,
  (i.uazapi_instance_token IS NOT NULL AND trim(i.uazapi_instance_token) <> '') AS tem_token,
  i.uso_ferramentas_ia,
  c.titulo AS cargo_catalogo,
  c.usar_perguntas_essenciais,
  c.ordem_perguntas_essenciais,
  array_length(c.perguntas_essenciais, 1) AS qtd_perguntas,
  left(c.saudacao_cliente, 80) AS saudacao_preview
FROM public.hub_agente_identidade i
LEFT JOIN public.hub_cargos_catalogo c
  ON trim(c.titulo) = trim(i.cargo)
  AND c.ativo = true
WHERE i.ativo = true
  AND i.arquivado_em IS NULL
  AND (
    i.modo_operacao = 'canal_whatsapp'
    OR NULLIF(trim(coalesce(i.uazapi_instance_token, '')), '') IS NOT NULL
  )
ORDER BY i.agente_slug;

-- Detalhe das perguntas essenciais do cargo da Maria (ajuste o slug se necessário)
SELECT
  i.agente_slug,
  c.titulo,
  c.usar_perguntas_essenciais,
  unnest(c.perguntas_essenciais) WITH ORDINALITY AS pergunta(linha, ordem)
FROM public.hub_agente_identidade i
JOIN public.hub_cargos_catalogo c ON trim(c.titulo) = trim(i.cargo) AND c.ativo = true
WHERE i.agente_slug = 'maria';

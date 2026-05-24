/** Select enxuto para listagem CRM (sem módulos aninhados — usa `modulo_atual`). */
export const HUB_PARCEIRO_LIST_SELECT = `
  id,
  codigo,
  nome,
  telefone,
  email,
  especialidade,
  mercado,
  cidade,
  estado,
  status,
  modulo_atual,
  recebe_leads,
  comissao_pct,
  total_leads_recebidos,
  total_leads_convertidos,
  criado_em,
  hub_parceiros_captacao(estagio, origem),
  hub_parceiros_homologacao(estagio, modulos_concluidos, data_conclusao)
`;

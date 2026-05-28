/** Tipos de interesse do lead (Documento Funcional PDF). */

export const TIPOS_INTERESSE_LEAD = [
  { id: "comprar_imovel", label: "Comprar imóvel" },
  { id: "vender_imovel", label: "Vender imóvel" },
  { id: "projeto_arquitetura", label: "Projeto de arquitetura" },
  { id: "obra_reforma", label: "Obra ou reforma" },
  { id: "engenharia", label: "Engenharia" },
  { id: "servico", label: "Serviço específico" },
  { id: "produto_material", label: "Produto ou material" },
  { id: "fornecedor_homologacao", label: "Fornecedor em homologação" },
  { id: "outro", label: "Outro" },
] as const;

export type TipoInteresseLeadId = (typeof TIPOS_INTERESSE_LEAD)[number]["id"];

export type CampoLeadConfig = {
  key: string;
  label: string;
  obrigatorio?: boolean;
  type?: "text" | "select" | "textarea";
  options?: { value: string; label: string }[];
};

const METRAGEM_OPTS = [
  { value: "ate_50", label: "Até 50 m²" },
  { value: "50_100", label: "50 a 100 m²" },
  { value: "100_300", label: "100 a 300 m²" },
  { value: "300_500", label: "300 a 500 m²" },
  { value: "acima_500", label: "Acima de 500 m²" },
  { value: "nao_sabe", label: "Não sabe informar" },
];

const PRAZO_OPTS = [
  { value: "imediato", label: "Imediato" },
  { value: "30_dias", label: "Até 30 dias" },
  { value: "1_3_meses", label: "1 a 3 meses" },
  { value: "3_6_meses", label: "3 a 6 meses" },
  { value: "nao_sabe", label: "Ainda não sabe" },
  { value: "pesquisando", label: "Só pesquisando" },
];

export const CAMPOS_POR_TIPO: Record<TipoInteresseLeadId, CampoLeadConfig[]> = {
  comprar_imovel: [
    { key: "cidade", label: "Cidade", obrigatorio: true },
    { key: "compra_venda", label: "Comprar ou vender", obrigatorio: true, type: "select", options: [{ value: "compra", label: "Compra" }] },
    { key: "bairro", label: "Bairro" },
    { key: "tipo_imovel", label: "Tipo de imóvel" },
  ],
  vender_imovel: [
    { key: "cidade", label: "Cidade", obrigatorio: true },
    { key: "compra_venda", label: "Comprar ou vender", obrigatorio: true, type: "select", options: [{ value: "venda", label: "Venda" }] },
    { key: "bairro", label: "Bairro" },
  ],
  projeto_arquitetura: [
    { key: "cidade", label: "Cidade", obrigatorio: true },
    { key: "bairro", label: "Bairro", obrigatorio: true },
    { key: "tipo_imovel", label: "Tipo de imóvel", obrigatorio: true },
    { key: "metragem", label: "Metragem aproximada", obrigatorio: true, type: "select", options: METRAGEM_OPTS },
    { key: "prazo_inicio", label: "Quando pretende começar", obrigatorio: true, type: "select", options: PRAZO_OPTS },
  ],
  obra_reforma: [
    { key: "cidade", label: "Cidade", obrigatorio: true },
    { key: "bairro", label: "Bairro", obrigatorio: true },
    { key: "tipo_servico", label: "Tipo de serviço", obrigatorio: true },
    { key: "tem_projeto", label: "Já tem projeto", obrigatorio: true, type: "select", options: [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }] },
    { key: "metragem", label: "Metragem", obrigatorio: true, type: "select", options: METRAGEM_OPTS },
    { key: "prazo_inicio", label: "Prazo desejado", obrigatorio: true, type: "select", options: PRAZO_OPTS },
  ],
  engenharia: [
    { key: "cidade", label: "Cidade", obrigatorio: true },
    { key: "demanda", label: "Demanda técnica", obrigatorio: true },
  ],
  servico: [
    { key: "cidade", label: "Cidade", obrigatorio: true },
    { key: "bairro", label: "Bairro", obrigatorio: true },
    { key: "servico_desejado", label: "Serviço desejado", obrigatorio: true },
    { key: "urgencia", label: "Urgência", obrigatorio: true, type: "select", options: [{ value: "baixa", label: "Baixa" }, { value: "media", label: "Média" }, { value: "alta", label: "Alta" }, { value: "emergencial", label: "Emergencial" }] },
  ],
  produto_material: [
    { key: "produto_interesse", label: "Produto de interesse", obrigatorio: true },
    { key: "cidade", label: "Cidade", obrigatorio: true },
    { key: "prazo_compra", label: "Prazo de compra", obrigatorio: true, type: "select", options: PRAZO_OPTS },
  ],
  fornecedor_homologacao: [
    { key: "segmento", label: "Segmento", obrigatorio: true },
    { key: "cidade", label: "Cidade", obrigatorio: true },
    { key: "regiao_atendimento", label: "Região de atendimento", obrigatorio: true },
    { key: "pf_pj", label: "PF ou PJ", obrigatorio: true, type: "select", options: [{ value: "pf", label: "Pessoa física" }, { value: "pj", label: "Empresa" }] },
  ],
  outro: [{ key: "observacoes", label: "Observações", type: "textarea" }],
};

/** Prefixo de mercado sugerido para conversão em negócio. */
export function prefixoMercadoFromTipoInteresse(tipo: string): string {
  const map: Record<string, string> = {
    comprar_imovel: "IMB",
    vender_imovel: "IMB",
    projeto_arquitetura: "ARQ",
    obra_reforma: "OBR",
    engenharia: "ENG",
    servico: "SRV",
    produto_material: "PRO",
    fornecedor_homologacao: "FOR",
  };
  return map[tipo] ?? "IMB";
}

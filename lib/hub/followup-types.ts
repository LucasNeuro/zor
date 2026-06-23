export type FollowupTipoConteudo = "texto" | "imagem" | "texto_imagem";

export type HubAgenteFollowupConfig = {
  id: string;
  tenant_id: string | null;
  agente_slug: string;
  ativo: boolean;
  arquivar_apos_dias: number;
  criado_em?: string;
  atualizado_em?: string;
};

export type HubAgenteFollowupPasso = {
  id: string;
  config_id: string;
  tenant_id: string | null;
  agente_slug: string;
  ordem: number;
  atraso_horas: number;
  tipo_conteudo: FollowupTipoConteudo;
  texto_template: string | null;
  imagem_url: string | null;
  legenda_imagem: string | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

export const FOLLOWUP_PASSOS_DEFAULT: Array<{
  ordem: number;
  atraso_horas: number;
  tipo_conteudo: FollowupTipoConteudo;
  texto_template: string;
}> = [
  {
    ordem: 1,
    atraso_horas: 2,
    tipo_conteudo: "texto",
    texto_template:
      "Olá {nome}, passando para saber se ainda posso ajudar com o seu pedido. Estou à disposição!",
  },
  {
    ordem: 2,
    atraso_horas: 24,
    tipo_conteudo: "texto",
    texto_template:
      "Oi {nome}, não tive retorno desde a nossa última conversa. Posso esclarecer alguma dúvida?",
  },
  {
    ordem: 3,
    atraso_horas: 48,
    tipo_conteudo: "texto",
    texto_template:
      "{nome}, este é um último lembrete. Se preferir, responda quando for melhor para você.",
  },
];

export function interpolarTemplateFollowup(
  template: string,
  vars: { nome?: string; mercado?: string }
): string {
  const nome = (vars.nome || "tudo bem").split(" ")[0] || "tudo bem";
  const mercado = vars.mercado || "geral";
  return template.replace(/\{nome\}/gi, nome).replace(/\{mercado\}/gi, mercado);
}

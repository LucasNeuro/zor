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
  atraso_minutos: number;
  tipo_conteudo: FollowupTipoConteudo;
  texto_template: string | null;
  imagem_url: string | null;
  legenda_imagem: string | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

export function atrasoTotalMinutos(p: {
  atraso_horas: number;
  atraso_minutos?: number | null;
}): number {
  const h = Number.isFinite(p.atraso_horas) ? Math.max(0, p.atraso_horas) : 0;
  const m = Number.isFinite(p.atraso_minutos ?? 0) ? Math.max(0, p.atraso_minutos ?? 0) : 0;
  return h * 60 + m;
}

export function validarAtrasoPasso(horas: number, minutos: number): string | null {
  if (!Number.isFinite(horas) || horas < 0 || horas > 8760) return "Horas inválidas (0–8760).";
  if (!Number.isFinite(minutos) || minutos < 0 || minutos > 59) return "Minutos inválidos (0–59).";
  const total = horas * 60 + minutos;
  if (total < 1) return "Atraso mínimo: 1 minuto.";
  if (total > 8760 * 60) return "Atraso máximo excedido.";
  return null;
}

export function formatarAtrasoPasso(p: {
  atraso_horas: number;
  atraso_minutos?: number | null;
}): string {
  const h = p.atraso_horas ?? 0;
  const m = p.atraso_minutos ?? 0;
  const parts: string[] = [];
  if (h > 0) parts.push(h === 1 ? "1h" : `${h}h`);
  if (m > 0) parts.push(m === 1 ? "1min" : `${m}min`);
  if (parts.length === 0) return "1min";
  if (h >= 24 && m === 0 && h % 24 === 0) return `${h / 24}d`;
  return parts.join(" ");
}

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

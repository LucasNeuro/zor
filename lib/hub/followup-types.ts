export type FollowupTipoConteudo = "texto" | "imagem" | "texto_imagem";

export type FollowupGatilhoTipo = "silencio" | "horario";

export type HubAgenteFollowupConfig = {
  id: string;
  tenant_id: string | null;
  agente_slug: string;
  ativo: boolean;
  arquivar_apos_dias: number;
  gatilho_tipo?: FollowupGatilhoTipo;
  gatilho_dias?: number;
  gatilho_horas?: number;
  gatilho_minutos?: number;
  gatilho_hora_dia?: string | null;
  criado_em?: string;
  atualizado_em?: string;
};

export type HubAgenteFollowupPasso = {
  id: string;
  config_id: string;
  tenant_id: string | null;
  agente_slug: string;
  ordem: number;
  atraso_dias?: number;
  atraso_horas: number;
  atraso_minutos: number;
  tipo_conteudo: FollowupTipoConteudo;
  texto_template: string | null;
  imagem_url: string | null;
  legenda_imagem: string | null;
  disparo_hora_dia?: string | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

export type AtrasoCampos = {
  atraso_dias?: number | null;
  atraso_horas: number;
  atraso_minutos?: number | null;
};

export function normalizarAtrasoCampos(p: Partial<AtrasoCampos>): {
  atraso_dias: number;
  atraso_horas: number;
  atraso_minutos: number;
} {
  return {
    atraso_dias: Number.isFinite(p.atraso_dias ?? 0) ? Math.max(0, Math.min(365, p.atraso_dias ?? 0)) : 0,
    atraso_horas: Number.isFinite(p.atraso_horas) ? Math.max(0, Math.min(8760, p.atraso_horas ?? 0)) : 0,
    atraso_minutos: Number.isFinite(p.atraso_minutos ?? 0)
      ? Math.max(0, Math.min(59, p.atraso_minutos ?? 0))
      : 0,
  };
}

export function atrasoTotalMinutos(p: AtrasoCampos): number {
  const n = normalizarAtrasoCampos(p);
  return n.atraso_dias * 24 * 60 + n.atraso_horas * 60 + n.atraso_minutos;
}

export function validarAtrasoPasso(
  horas: number,
  minutos: number,
  dias = 0
): string | null {
  const n = normalizarAtrasoCampos({ atraso_dias: dias, atraso_horas: horas, atraso_minutos: minutos });
  if (n.atraso_dias > 365) return "Dias inválidos (0–365).";
  if (n.atraso_horas > 8760) return "Horas inválidas (0–8760).";
  const total = atrasoTotalMinutos(n);
  if (total < 1) return "Atraso mínimo: 1 minuto.";
  if (total > 8760 * 60) return "Atraso máximo excedido.";
  return null;
}

export function validarHoraDia(v: string | null | undefined): string | null {
  if (v == null || !String(v).trim()) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim());
  if (!m) return "Hora inválida (use HH:MM).";
  const hh = Number.parseInt(m[1]!, 10);
  const mm = Number.parseInt(m[2]!, 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "Hora inválida (00:00–23:59).";
  return null;
}

export function formatarHoraDiaInput(v: string | null | undefined): string {
  const err = validarHoraDia(v);
  if (err || !v?.trim()) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return "";
  return `${String(Number.parseInt(m[1]!, 10)).padStart(2, "0")}:${m[2]}`;
}

export function formatarAtrasoPasso(p: AtrasoCampos): string {
  const n = normalizarAtrasoCampos(p);
  const parts: string[] = [];
  if (n.atraso_dias > 0) parts.push(n.atraso_dias === 1 ? "1d" : `${n.atraso_dias}d`);
  if (n.atraso_horas > 0) parts.push(n.atraso_horas === 1 ? "1h" : `${n.atraso_horas}h`);
  if (n.atraso_minutos > 0) parts.push(n.atraso_minutos === 1 ? "1min" : `${n.atraso_minutos}min`);
  if (parts.length === 0) return "1min";
  return parts.join(" ");
}

export function formatarGatilhoConfig(config: Pick<
  HubAgenteFollowupConfig,
  "gatilho_tipo" | "gatilho_dias" | "gatilho_horas" | "gatilho_minutos" | "gatilho_hora_dia"
>): string {
  const silencio = formatarAtrasoPasso({
    atraso_dias: config.gatilho_dias ?? 0,
    atraso_horas: config.gatilho_horas ?? 0,
    atraso_minutos: config.gatilho_minutos ?? 0,
  });
  const totalGatilho = atrasoTotalMinutos({
    atraso_dias: config.gatilho_dias ?? 0,
    atraso_horas: config.gatilho_horas ?? 0,
    atraso_minutos: config.gatilho_minutos ?? 0,
  });
  const hora = formatarHoraDiaInput(config.gatilho_hora_dia);

  if (config.gatilho_tipo === "horario" && hora) {
    const base =
      totalGatilho > 0 ? `após ${silencio} sem resposta` : "sem resposta do cliente";
    return `${base} · às ${hora}`;
  }
  if (totalGatilho > 0) return `após ${silencio} sem resposta`;
  return "silêncio do cliente";
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

export function configGatilhoPadrao(): Pick<
  HubAgenteFollowupConfig,
  "gatilho_tipo" | "gatilho_dias" | "gatilho_horas" | "gatilho_minutos" | "gatilho_hora_dia" | "arquivar_apos_dias"
> {
  return {
    gatilho_tipo: "silencio",
    gatilho_dias: 0,
    gatilho_horas: 2,
    gatilho_minutos: 0,
    gatilho_hora_dia: null,
    arquivar_apos_dias: 7,
  };
}

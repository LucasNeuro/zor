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
  /** Minutos de espera: passo 1 = silêncio do cliente; passo 2+ = após passo anterior. */
  espera_minutos?: number | null;
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
  if (total < 0) return "Atraso inválido.";
  if (total > 8760 * 60) return "Atraso máximo excedido.";
  return null;
}

export function passosAtivosOrdenados(passos: HubAgenteFollowupPasso[]): HubAgenteFollowupPasso[] {
  return passos.filter((p) => p.ativo).sort((a, b) => a.ordem - b.ordem);
}

export function ordemPassosSequencial(passos: HubAgenteFollowupPasso[]): boolean {
  const sorted = [...passos].sort((a, b) => a.ordem - b.ordem);
  return sorted.every((p, i) => p.ordem === i + 1);
}

/**
 * Quantos passos da cadência já foram enviados (0 = nenhum).
 * Compatível com legado (valor = ordem DB do último passo) e novo modelo (contagem 1..N).
 */
export function passosEnviadosCount(
  followup_passo: number | null | undefined,
  passosAtivos: HubAgenteFollowupPasso[]
): number {
  const v = followup_passo ?? 0;
  if (v <= 0 || passosAtivos.length === 0) return 0;

  const idxPorOrdem = passosAtivos.findIndex((p) => p.ordem === v);
  if (idxPorOrdem >= 0) return idxPorOrdem + 1;

  if (v <= passosAtivos.length && ordemPassosSequencial(passosAtivos)) {
    return v;
  }

  if (v <= passosAtivos.length) return v;

  return passosAtivos.length;
}

/** Índice 0-based do próximo passo a enviar na fila ordenada. */
export function indiceProximoPasso(
  followup_passo: number | null | undefined,
  passosAtivos: HubAgenteFollowupPasso[]
): number {
  return passosEnviadosCount(followup_passo, passosAtivos);
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
  if (parts.length === 0) return "imediato";
  return parts.join(" ");
}

export function minutosToLegacyAtraso(totalMinutos: number): {
  atraso_dias: number;
  atraso_horas: number;
  atraso_minutos: number;
} {
  const m = Math.max(1, Math.min(525_600, Math.floor(totalMinutos)));
  const atraso_dias = Math.floor(m / 1440);
  const rest = m % 1440;
  const atraso_horas = Math.floor(rest / 60);
  const atraso_minutos = rest % 60;
  return { atraso_dias, atraso_horas, atraso_minutos };
}

export function legacyAtrasoToMinutos(p: AtrasoCampos): number {
  return Math.max(0, atrasoTotalMinutos(p));
}

export function esperaMinutosDoPasso(
  passo: HubAgenteFollowupPasso,
  config: Pick<
    HubAgenteFollowupConfig,
    "gatilho_dias" | "gatilho_horas" | "gatilho_minutos"
  >,
  indicePasso: number
): number {
  if (passo.espera_minutos != null && passo.espera_minutos >= 1) {
    return passo.espera_minutos;
  }
  const atraso = legacyAtrasoToMinutos(passo);
  if (indicePasso === 0) {
    const gatilho =
      (config.gatilho_dias ?? 0) * 1440 +
      (config.gatilho_horas ?? 0) * 60 +
      (config.gatilho_minutos ?? 0);
    return Math.max(1, gatilho + atraso);
  }
  return Math.max(1, atraso);
}

export function formatarEsperaMinutos(minutos: number, indicePasso = 0): string {
  const m = Math.max(1, Math.floor(minutos));
  if (m < 60) return `${m} min`;
  if (m % 1440 === 0) {
    const d = m / 1440;
    return d === 1 ? "1 dia" : `${d} dias`;
  }
  if (m % 60 === 0) {
    const h = m / 60;
    return h === 1 ? "1 h" : `${h} h`;
  }
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r > 0 ? `${h} h ${r} min` : `${h} h`;
}

export function formatarEsperaPasso(
  passo: HubAgenteFollowupPasso,
  config: Pick<
    HubAgenteFollowupConfig,
    "gatilho_dias" | "gatilho_horas" | "gatilho_minutos"
  >,
  indicePasso: number
): string {
  return formatarEsperaMinutos(esperaMinutosDoPasso(passo, config, indicePasso), indicePasso);
}

export function validarEsperaMinutos(minutos: number): string | null {
  if (!Number.isFinite(minutos)) return "Minutos inválidos.";
  const m = Math.floor(minutos);
  if (m < 1) return "Mínimo 1 minuto.";
  if (m > 525_600) return "Máximo 525600 minutos (~1 ano).";
  return null;
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
  espera_minutos: number;
  atraso_horas: number;
  tipo_conteudo: FollowupTipoConteudo;
  texto_template: string;
}> = [
  {
    ordem: 1,
    espera_minutos: 5,
    atraso_horas: 0,
    tipo_conteudo: "texto",
    texto_template:
      "Olá {nome}, passando para saber se ainda posso ajudar com o seu pedido. Estou à disposição!",
  },
  {
    ordem: 2,
    espera_minutos: 720,
    atraso_horas: 12,
    tipo_conteudo: "texto",
    texto_template:
      "Oi {nome}, não tive retorno desde a nossa última conversa. Posso esclarecer alguma dúvida?",
  },
  {
    ordem: 3,
    espera_minutos: 2880,
    atraso_horas: 48,
    tipo_conteudo: "texto",
    texto_template:
      "{nome}, este é um último lembrete. Se preferir, responda quando for melhor para você.",
  },
];

/** Atalhos rápidos na UI (minutos). */
export const FOLLOWUP_ESPERA_PRESETS = [5, 30, 60, 720, 1440, 2880] as const;

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
    gatilho_horas: 0,
    gatilho_minutos: 0,
    gatilho_hora_dia: null,
    arquivar_apos_dias: 7,
  };
}

/** Resumo da cadência para a modal (passo 1 define o primeiro disparo). */
export function formatarResumoCadencia(
  passos: HubAgenteFollowupPasso[],
  config: Pick<
    HubAgenteFollowupConfig,
    "gatilho_dias" | "gatilho_horas" | "gatilho_minutos" | "arquivar_apos_dias"
  >
): string {
  const ativos = passosAtivosOrdenados(passos);
  if (ativos.length === 0) return "sem passos activos";
  const p1 = formatarEsperaPasso(ativos[0]!, config, 0);
  const parts = [`1.º passo: ${p1} sem resposta`];
  if (ativos.length > 1) {
    parts.push(`${ativos.length} passos`);
  }
  parts.push(`arquivar ${config.arquivar_apos_dias ?? 7}d`);
  return parts.join(" · ");
}

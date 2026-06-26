import type { HubAgenteFollowupConfig } from "@/lib/hub/followup-types";
import { validarHoraDia } from "@/lib/hub/followup-types";
import { horaLocalDeDate } from "@/lib/hub/followup-schedule";

export const TZ_FOLLOWUP_PADRAO = "America/Sao_Paulo";

export const HORARIOS_DISPARO_PADRAO = ["09:00", "14:00", "18:00"] as const;

export const HORARIO_INICIO_PADRAO = "08:00";
export const HORARIO_FIM_PADRAO = "22:00";

export type FollowupJanelaModo = "faixa" | "slots" | "continuo";

export type FollowupExecucaoModo = "continuo" | "janela_horaria";

/** Modo efectivo (janela_modo novo ou legado execucao_modo). */
export function janelaModoFollowup(
  config: Pick<HubAgenteFollowupConfig, "janela_modo" | "execucao_modo">
): FollowupJanelaModo {
  if (config.janela_modo === "faixa" || config.janela_modo === "slots" || config.janela_modo === "continuo") {
    return config.janela_modo;
  }
  if (config.execucao_modo === "continuo") return "continuo";
  return "faixa";
}

export function execucaoModoFollowup(
  config: Pick<HubAgenteFollowupConfig, "execucao_modo" | "janela_modo">
): FollowupExecucaoModo {
  return janelaModoFollowup(config) === "continuo" ? "continuo" : "janela_horaria";
}

export function timezoneFollowup(
  config: Pick<HubAgenteFollowupConfig, "timezone">
): string {
  const tz = config.timezone?.trim();
  return tz || TZ_FOLLOWUP_PADRAO;
}

export function horarioInicioFollowup(
  config: Pick<HubAgenteFollowupConfig, "horario_inicio">
): string {
  const h = config.horario_inicio?.trim();
  if (h && !validarHoraDia(h)) return h;
  return HORARIO_INICIO_PADRAO;
}

export function horarioFimFollowup(
  config: Pick<HubAgenteFollowupConfig, "horario_fim">
): string {
  const h = config.horario_fim?.trim();
  if (h && !validarHoraDia(h)) return h;
  return HORARIO_FIM_PADRAO;
}

/** Normaliza horários HH:MM vindos do CRM ou legado gatilho_hora_dia. */
export function horariosDisparoFollowup(
  config: Pick<HubAgenteFollowupConfig, "horarios_disparo" | "gatilho_tipo" | "gatilho_hora_dia">
): string[] {
  const raw = config.horarios_disparo;
  if (Array.isArray(raw)) {
    const list = raw
      .map((h) => (typeof h === "string" ? h.trim() : ""))
      .filter((h) => h && !validarHoraDia(h));
    if (list.length > 0) return list;
  }
  if (config.gatilho_tipo === "horario" && config.gatilho_hora_dia?.trim()) {
    const h = config.gatilho_hora_dia.trim();
    if (!validarHoraDia(h)) return [h];
  }
  return [...HORARIOS_DISPARO_PADRAO];
}

function minutosDesdeMeiaNoite(horas: number, minutos: number): number {
  return horas * 60 + minutos;
}

function parseHorarioMinutos(horaDia: string): number | null {
  if (validarHoraDia(horaDia)) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(horaDia.trim());
  if (!m) return null;
  return minutosDesdeMeiaNoite(
    Number.parseInt(m[1]!, 10),
    Number.parseInt(m[2]!, 10)
  );
}

export type JanelaDisparoFollowup = {
  ativa: boolean;
  slot?: string;
  proximo?: string;
  modo?: FollowupJanelaModo;
  faixa?: { inicio: string; fim: string };
};

/**
 * Faixa contínua [inicio, fim) no fuso local — ex. 08:00–22:00.
 */
export function avaliarFaixaHorariaFollowup(
  inicio: string,
  fim: string,
  options?: {
    timeZone?: string;
    agora?: Date;
  }
): JanelaDisparoFollowup {
  const tz = options?.timeZone ?? TZ_FOLLOWUP_PADRAO;
  const agora = options?.agora ?? new Date();
  const inicioMin = parseHorarioMinutos(inicio);
  const fimMin = parseHorarioMinutos(fim);

  if (inicioMin == null || fimMin == null) {
    return { ativa: true, modo: "faixa", faixa: { inicio, fim } };
  }

  const agoraLocal = horaLocalDeDate(agora, tz);
  const agoraMin = minutosDesdeMeiaNoite(agoraLocal.horas, agoraLocal.minutos);

  const dentro =
    inicioMin <= fimMin
      ? agoraMin >= inicioMin && agoraMin < fimMin
      : agoraMin >= inicioMin || agoraMin < fimMin;

  if (dentro) {
    return { ativa: true, modo: "faixa", faixa: { inicio, fim } };
  }

  const proximo = agoraMin < inicioMin ? inicio : inicio;
  return { ativa: false, proximo, modo: "faixa", faixa: { inicio, fim } };
}

/**
 * Verdadeiro só dentro de [HH:MM, HH:MM + tolerância) em cada slot do dia (fuso local).
 */
export function avaliarJanelaDisparoFollowup(
  horarios: string[],
  options?: {
    toleranciaMinutos?: number;
    timeZone?: string;
    agora?: Date;
  }
): JanelaDisparoFollowup {
  const tolerancia = Math.max(5, Math.min(60, options?.toleranciaMinutos ?? 20));
  const tz = options?.timeZone ?? TZ_FOLLOWUP_PADRAO;
  const agora = options?.agora ?? new Date();
  const agoraLocal = horaLocalDeDate(agora, tz);
  const agoraMin = minutosDesdeMeiaNoite(agoraLocal.horas, agoraLocal.minutos);

  const slots = horarios
    .map((h) => ({ hora: h, min: parseHorarioMinutos(h) }))
    .filter((s): s is { hora: string; min: number } => s.min != null)
    .sort((a, b) => a.min - b.min);

  if (slots.length === 0) {
    return { ativa: false, modo: "slots" };
  }

  for (const slot of slots) {
    if (agoraMin >= slot.min && agoraMin < slot.min + tolerancia) {
      return { ativa: true, slot: slot.hora, modo: "slots" };
    }
  }

  const proximo = slots.find((s) => s.min > agoraMin)?.hora ?? slots[0]?.hora;
  return { ativa: false, proximo, modo: "slots" };
}

export function followupPermitidoNaJanela(
  config: Pick<
    HubAgenteFollowupConfig,
    | "janela_modo"
    | "execucao_modo"
    | "timezone"
    | "horario_inicio"
    | "horario_fim"
    | "horarios_disparo"
    | "gatilho_tipo"
    | "gatilho_hora_dia"
  >
): JanelaDisparoFollowup {
  const modo = janelaModoFollowup(config);
  const tz = timezoneFollowup(config);

  if (modo === "continuo") {
    return { ativa: true, modo: "continuo" };
  }

  if (modo === "faixa") {
    return avaliarFaixaHorariaFollowup(
      horarioInicioFollowup(config),
      horarioFimFollowup(config),
      { timeZone: tz }
    );
  }

  return avaliarJanelaDisparoFollowup(horariosDisparoFollowup(config), { timeZone: tz });
}

export function normalizarHorariosDisparoInput(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    const h = typeof item === "string" ? item.trim() : "";
    if (!h) continue;
    const err = validarHoraDia(h);
    if (err) return null;
    out.push(h);
  }
  return out.length > 0 ? out : null;
}

export function normalizarHoraInput(raw: unknown): string | null {
  const h = typeof raw === "string" ? raw.trim() : "";
  if (!h) return null;
  if (validarHoraDia(h)) return null;
  return h;
}

export function normalizarJanelaModoInput(raw: unknown): FollowupJanelaModo | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "faixa" || v === "slots" || v === "continuo") return v;
  return null;
}

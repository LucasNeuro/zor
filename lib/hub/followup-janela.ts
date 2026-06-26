import type { HubAgenteFollowupConfig } from "@/lib/hub/followup-types";
import { validarHoraDia } from "@/lib/hub/followup-types";
import { horaLocalDeDate } from "@/lib/hub/followup-schedule";

export const TZ_FOLLOWUP_PADRAO = "America/Sao_Paulo";

export const HORARIOS_DISPARO_PADRAO = ["09:00", "14:00", "18:00"] as const;

export type FollowupExecucaoModo = "continuo" | "janela_horaria";

export function execucaoModoFollowup(
  config: Pick<HubAgenteFollowupConfig, "execucao_modo">
): FollowupExecucaoModo {
  return config.execucao_modo === "continuo" ? "continuo" : "janela_horaria";
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
};

/**
 * Verdadeiro só dentro de [HH:MM, HH:MM + tolerância) em cada slot do dia (fuso local).
 * Evita disparo o dia inteiro após a hora (bug do gatilho legado).
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
    return { ativa: false };
  }

  for (const slot of slots) {
    if (agoraMin >= slot.min && agoraMin < slot.min + tolerancia) {
      return { ativa: true, slot: slot.hora };
    }
  }

  const proximo = slots.find((s) => s.min > agoraMin)?.hora ?? slots[0]?.hora;
  return { ativa: false, proximo };
}

export function followupPermitidoNaJanela(
  config: Pick<
    HubAgenteFollowupConfig,
    "execucao_modo" | "horarios_disparo" | "gatilho_tipo" | "gatilho_hora_dia"
  >
): JanelaDisparoFollowup {
  if (execucaoModoFollowup(config) === "continuo") {
    return { ativa: true };
  }
  return avaliarJanelaDisparoFollowup(horariosDisparoFollowup(config));
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

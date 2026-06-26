import type { HubAgenteFollowupConfig } from "@/lib/hub/followup-types";
import {
  avaliarFaixaHorariaFollowup,
  faixaHorariaEfetiva,
  janelaModoFollowup,
  timezoneFollowup,
  horariosDisparoFollowup,
} from "@/lib/hub/followup-janela";
import { horaLocalDeDate } from "@/lib/hub/followup-schedule";
import { validarHoraDia } from "@/lib/hub/followup-types";

function minutosDesdeMeiaNoite(horas: number, minutos: number): number {
  return horas * 60 + minutos;
}

function parseHorarioMinutos(horaDia: string): number | null {
  if (validarHoraDia(horaDia)) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(horaDia.trim());
  if (!m) return null;
  return minutosDesdeMeiaNoite(Number.parseInt(m[1]!, 10), Number.parseInt(m[2]!, 10));
}

/** Verdadeiro quando proximo_followup já passou ou é nulo. */
export function followupAgendadoParaAgora(
  proximoFollowup: string | null | undefined,
  agora: Date = new Date()
): boolean {
  if (!proximoFollowup?.trim()) return true;
  const d = new Date(proximoFollowup);
  if (Number.isNaN(d.getTime())) return true;
  return agora.getTime() >= d.getTime();
}

/**
 * Calcula quando o próximo passo pode ser enviado:
 * agora + esperaMinutos, ajustado só se cair fora da faixa permitida (anti-madrugada).
 */
export function calcularProximoFollowupEm(
  agora: Date,
  esperaMinutos: number,
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
): string {
  const espera = Math.max(1, Math.floor(esperaMinutos));
  let alvo = new Date(agora.getTime() + espera * 60_000);
  const modo = janelaModoFollowup(config);

  if (modo === "continuo") {
    return alvo.toISOString();
  }

  const tz = timezoneFollowup(config);
  const faixa = faixaHorariaEfetiva(config);
  return ajustarParaFaixa(alvo, faixa.inicio, faixa.fim, tz).toISOString();
}

function ajustarParaFaixa(
  date: Date,
  inicio: string,
  fim: string,
  tz: string
): Date {
  const inicioMin = parseHorarioMinutos(inicio);
  const fimMin = parseHorarioMinutos(fim);
  if (inicioMin == null || fimMin == null) return date;

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const local = horaLocalDeDate(date, tz);
    const agoraMin = minutosDesdeMeiaNoite(local.horas, local.minutos);
    const faixa = avaliarFaixaHorariaFollowup(inicio, fim, { timeZone: tz, agora: date });

    if (faixa.ativa) return date;

    if (agoraMin < inicioMin) {
      return new Date(date.getTime() + (inicioMin - agoraMin) * 60_000);
    }

    const minutosAteMeiaNoite = 24 * 60 - agoraMin;
    const minutosAteInicio = minutosAteMeiaNoite + inicioMin;
    date = new Date(date.getTime() + minutosAteInicio * 60_000);
  }

  return date;
}

export function formatarProximoFollowup(iso: string | null | undefined, locale = "pt-BR"): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function resumoJanelaFollowup(
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
): string {
  const modo = janelaModoFollowup(config);
  if (modo === "continuo") return "Contínuo (24/7)";
  const faixa = faixaHorariaEfetiva(config);
  if (modo === "faixa" || modo === "slots") {
    const legado =
      modo === "slots" ? ` (legado slots ${horariosDisparoFollowup(config).join(", ")})` : "";
    return `Faixa ${faixa.inicio}–${faixa.fim} (${timezoneFollowup(config)})${legado}`;
  }
  return `Faixa ${faixa.inicio}–${faixa.fim} (${timezoneFollowup(config)})`;
}

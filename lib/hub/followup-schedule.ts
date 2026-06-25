import type { FollowupGatilhoTipo, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { atrasoTotalMinutos, validarHoraDia } from "@/lib/hub/followup-types";

export type MotivoFollowupSkip =
  | "cadencia_concluida"
  | "aguardando_gatilho"
  | "aguardando_atraso_passo"
  | "aguardando_hora_disparo"
  | "sem_ultimo_followup";

const TZ_PADRAO = "America/Sao_Paulo";

export function horaLocalAtual(timeZone = TZ_PADRAO): { horas: number; minutos: number } {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(new Date());
  const horas = Number.parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minutos = Number.parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return { horas, minutos };
}

export function parseHoraDia(horaDia: string | null | undefined): { horas: number; minutos: number } | null {
  if (!horaDia?.trim()) return null;
  if (validarHoraDia(horaDia)) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(horaDia.trim());
  if (!m) return null;
  return {
    horas: Number.parseInt(m[1]!, 10),
    minutos: Number.parseInt(m[2]!, 10),
  };
}

/** Verdadeiro quando a hora local já atingiu ou passou de `horaDia` (HH:MM). */
export function horaDiaAtingida(horaDia: string | null | undefined, timeZone = TZ_PADRAO): boolean {
  const alvo = parseHoraDia(horaDia);
  if (!alvo) return true;
  const agora = horaLocalAtual(timeZone);
  if (agora.horas > alvo.horas) return true;
  if (agora.horas < alvo.horas) return false;
  return agora.minutos >= alvo.minutos;
}

export function gatilhoSilencioMinutos(config: {
  gatilho_dias?: number | null;
  gatilho_horas?: number | null;
  gatilho_minutos?: number | null;
}): number {
  return atrasoTotalMinutos({
    atraso_dias: config.gatilho_dias ?? 0,
    atraso_horas: config.gatilho_horas ?? 0,
    atraso_minutos: config.gatilho_minutos ?? 0,
  });
}

export function gatilhoDisparoPermitido(params: {
  gatilho_tipo?: FollowupGatilhoTipo | null;
  gatilho_dias?: number | null;
  gatilho_horas?: number | null;
  gatilho_minutos?: number | null;
  gatilho_hora_dia?: string | null;
  minutosSilencio: number;
  disparo_hora_dia?: string | null;
}): boolean {
  const minGatilho = gatilhoSilencioMinutos(params);
  if (minGatilho > 0 && params.minutosSilencio < minGatilho) return false;

  if (params.gatilho_tipo === "horario" && params.gatilho_hora_dia?.trim()) {
    if (!horaDiaAtingida(params.gatilho_hora_dia)) return false;
  }

  if (params.disparo_hora_dia?.trim() && !horaDiaAtingida(params.disparo_hora_dia)) {
    return false;
  }

  return true;
}

export type AvaliacaoDisparoPasso = {
  permitido: boolean;
  motivo?: MotivoFollowupSkip;
  detalhe?: string;
};

/** Primeiro passo: silêncio ≥ gatilho (+ atraso opcional). Demais: tempo desde o passo anterior enviado. */
export function avaliarDisparoPasso(params: {
  indicePasso: number;
  passo: HubAgenteFollowupPasso;
  gatilho_tipo?: FollowupGatilhoTipo | null;
  gatilho_dias?: number | null;
  gatilho_horas?: number | null;
  gatilho_minutos?: number | null;
  gatilho_hora_dia?: string | null;
  minutosSilencio: number;
  minutosDesdeUltimoFollowup: number | null;
}): AvaliacaoDisparoPasso {
  const { indicePasso, passo, minutosSilencio, minutosDesdeUltimoFollowup } = params;
  const atrasoPasso = atrasoTotalMinutos(passo);
  const gatilhoMin = gatilhoSilencioMinutos(params);

  if (indicePasso === 0) {
    if (gatilhoMin > 0 && minutosSilencio < gatilhoMin) {
      const falta = Math.ceil(gatilhoMin - minutosSilencio);
      return {
        permitido: false,
        motivo: "aguardando_gatilho",
        detalhe: `faltam ${falta} min de silêncio do cliente`,
      };
    }

    if (params.gatilho_tipo === "horario" && params.gatilho_hora_dia?.trim()) {
      if (!horaDiaAtingida(params.gatilho_hora_dia)) {
        return {
          permitido: false,
          motivo: "aguardando_hora_disparo",
          detalhe: `gatilho às ${params.gatilho_hora_dia.trim()}`,
        };
      }
    }

    if (atrasoPasso > 0) {
      const totalSilencio = gatilhoMin + atrasoPasso;
      if (minutosSilencio < totalSilencio) {
        const falta = Math.ceil(totalSilencio - minutosSilencio);
        return {
          permitido: false,
          motivo: "aguardando_atraso_passo",
          detalhe: `passo 1: faltam ${falta} min após o gatilho`,
        };
      }
    }

    if (passo.disparo_hora_dia?.trim() && !horaDiaAtingida(passo.disparo_hora_dia)) {
      return {
        permitido: false,
        motivo: "aguardando_hora_disparo",
        detalhe: `passo às ${passo.disparo_hora_dia.trim()}`,
      };
    }

    return { permitido: true };
  }

  if (minutosDesdeUltimoFollowup == null) {
    return { permitido: false, motivo: "sem_ultimo_followup" };
  }

  if (atrasoPasso > 0 && minutosDesdeUltimoFollowup < atrasoPasso) {
    const falta = Math.ceil(atrasoPasso - minutosDesdeUltimoFollowup);
    return {
      permitido: false,
      motivo: "aguardando_atraso_passo",
      detalhe: `faltam ${falta} min após o passo anterior`,
    };
  }

  if (passo.disparo_hora_dia?.trim() && !horaDiaAtingida(passo.disparo_hora_dia)) {
    return {
      permitido: false,
      motivo: "aguardando_hora_disparo",
      detalhe: `passo às ${passo.disparo_hora_dia.trim()}`,
    };
  }

  return { permitido: true };
}

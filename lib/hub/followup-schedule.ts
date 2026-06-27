import type { FollowupGatilhoTipo, HubAgenteFollowupConfig, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { esperaMinutosDoPasso, formatarEsperaMinutos } from "@/lib/hub/followup-types";
import { atrasoTotalMinutos, validarHoraDia } from "@/lib/hub/followup-types";

export type MotivoFollowupSkip =
  | "cadencia_concluida"
  | "aguardando_gatilho"
  | "aguardando_atraso_passo"
  | "aguardando_espera"
  | "aguardando_hora_disparo"
  | "sem_ultimo_followup"
  | "sem_ultima_msg_cliente"
  | "passo_ja_enviado"
  | "cliente_respondeu"
  | "atendimento_encerrado";

const TZ_PADRAO = "America/Sao_Paulo";

export function horaLocalDeDate(
  date: Date,
  timeZone = TZ_PADRAO
): { horas: number; minutos: number } {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);
  const horas = Number.parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minutos = Number.parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return { horas, minutos };
}

export function horaLocalAtual(timeZone = TZ_PADRAO): { horas: number; minutos: number } {
  return horaLocalDeDate(new Date(), timeZone);
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

export type AvaliacaoDisparoPasso = {
  permitido: boolean;
  motivo?: MotivoFollowupSkip;
  detalhe?: string;
};

/**
 * Passo 1: espera_minutos = silêncio do cliente (desde ultima_msg_cliente_em).
 * Passo 2+: espera_minutos = tempo desde ultimo_followup enviado.
 */
export function avaliarDisparoPasso(params: {
  indicePasso: number;
  passo: HubAgenteFollowupPasso;
  config?: Pick<
    HubAgenteFollowupConfig,
    "gatilho_tipo" | "gatilho_dias" | "gatilho_horas" | "gatilho_minutos" | "gatilho_hora_dia"
  >;
  minutosSilencio: number;
  minutosDesdeUltimoFollowup: number | null;
  /** Quantos passos já foram enviados nesta cadência (0 = nenhum). */
  enviadosCount?: number;
  /** Cliente respondeu depois do último follow-up automático? */
  clienteRespondeuAposUltimoFollowup?: boolean;
}): AvaliacaoDisparoPasso {
  const { indicePasso, passo, minutosSilencio, minutosDesdeUltimoFollowup } = params;
  const enviadosCount = params.enviadosCount ?? 0;
  const config = params.config ?? {};
  const espera = esperaMinutosDoPasso(passo, config, indicePasso);
  const esperaLabel = formatarEsperaMinutos(espera, indicePasso);

  if (params.clienteRespondeuAposUltimoFollowup) {
    if (indicePasso > 0 || enviadosCount > 0) {
      return {
        permitido: false,
        motivo: "cliente_respondeu",
        detalhe: "cliente respondeu após o último follow-up — cadência reinicia no passo 1",
      };
    }
  }

  if (indicePasso === 0) {
    if (enviadosCount === 0 && minutosDesdeUltimoFollowup != null) {
      return {
        permitido: false,
        motivo: "passo_ja_enviado",
        detalhe: "passo 1 já enviado nesta cadência — aguardando próximo passo ou resposta do cliente",
      };
    }

    if (minutosSilencio < espera) {
      const falta = Math.ceil(espera - minutosSilencio);
      return {
        permitido: false,
        motivo: "aguardando_espera",
        detalhe: `passo 1: faltam ${falta} min (${esperaLabel} sem resposta do cliente)`,
      };
    }

    if (config.gatilho_tipo === "horario" && config.gatilho_hora_dia?.trim()) {
      if (!horaDiaAtingida(config.gatilho_hora_dia)) {
        return {
          permitido: false,
          motivo: "aguardando_hora_disparo",
          detalhe: `gatilho às ${config.gatilho_hora_dia.trim()}`,
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

  if (minutosDesdeUltimoFollowup < espera) {
    const falta = Math.ceil(espera - minutosDesdeUltimoFollowup);
    return {
      permitido: false,
      motivo: "aguardando_espera",
      detalhe: `passo ${indicePasso + 1}: faltam ${falta} min (${esperaLabel} após o passo anterior)`,
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

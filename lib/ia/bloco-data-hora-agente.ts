import { googleCalendarTimeZone } from "@/lib/hub/google-calendar-api";

/** Data/hora de referência para o modelo (evita «amanhã» com data errada). */
export function blocoDataHoraAtualParaAgente(): string {
  const tz = googleCalendarTimeZone();
  const agora = new Date();
  const legivel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(agora);

  const isoLocal = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(agora)
    .replace(" ", "T");

  const amanha = new Date(agora.getTime() + 86400000);
  const amanhaLegivel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(amanha);

  return `═══ DATA E HORA ATUAIS (${tz}) ═══
- Agora: ${legivel}
- Amanhã: ${amanhaLegivel}
- Referência ISO local (use em hub_int_gcal_*): ${isoLocal}

Regras de calendário:
- Nunca invente horários nem datas — consulte a agenda real com **hub_int_gcal_listar_eventos** antes de sugerir vagas.
- Quando o cliente confirmar horário, crie o evento com **hub_int_gcal_criar_evento** (título, inicio, fim, participantes).
- «Amanhã» = data de amanhã acima, não datas antigas do playbook.`;
}

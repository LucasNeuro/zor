/**
 * Dispatcher único para hub_ciclos_ia: decide ciclos programados "devidos"
 * e mapeia para /api/ciclos/{diretor|gerente|atendente}?ciclo=...
 *
 * Ciclos de agentes novos: defina em configuracoes.dispatch = { api, ciclo }
 * (api ∈ diretor|gerente|atendente; ciclo = chave já implementada na rota).
 */

export const DISPATCH_API_SLUGS = ["diretor", "gerente", "atendente", "agente"] as const;
export type DispatchApiSlug = (typeof DISPATCH_API_SLUGS)[number];

export type HubCicloIaDispatchRow = {
  id: string;
  agente_slug: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  cron_expressao: string | null;
  intervalo_minutos: number | null;
  ultimo_ciclo: string | null;
  configuracoes?: Record<string, unknown> | null;
};

function matchCronField(spec: string, value: number): boolean {
  const s = spec.trim();
  if (s === "*" || s === "?") return true;
  if (s.startsWith("*/")) {
    const step = Number.parseInt(s.slice(2), 10);
    if (!Number.isFinite(step) || step <= 0) return false;
    return value % step === 0;
  }
  if (s.includes(",")) {
    return s.split(",").some((x) => matchCronField(x.trim(), value));
  }
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n === value;
}

/** Cron 5 campos (min hor dom mon dow), hora em UTC — cobre os padrões usados em vercel.json. */
export function cronMatchesUtc(date: Date, expr: string): boolean {
  const fields = expr.trim().split(/\s+/).filter(Boolean);
  if (fields.length !== 5) return false;

  const [strMin, strHr, strDom, strMon, strDow] = fields;
  const min = date.getUTCMinutes();
  const hr = date.getUTCHours();
  const dom = date.getUTCDate();
  const mon = date.getUTCMonth() + 1;
  const dow = date.getUTCDay();

  return (
    matchCronField(strMin, min) &&
    matchCronField(strHr, hr) &&
    matchCronField(strDom, dom) &&
    matchCronField(strMon, mon) &&
    matchCronField(strDow, dow)
  );
}

function startOfUtcMinute(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0, 0);
}

/**
 * Ciclos tipo `programado` com cron e/ou intervalo_minutos.
 * Com cron: dispara no minuto em que o cron casa em UTC e se não houve execução neste minuto.
 * Só intervalo: dispara se ultimo_ciclo + intervalo <= agora.
 */
export function isProgramadoCicloDue(row: HubCicloIaDispatchRow, now: Date): boolean {
  if (!row.ativo || row.tipo !== "programado") return false;

  const cron = (row.cron_expressao || "").trim();
  const intervalRaw = row.intervalo_minutos;
  const intervalMin =
    intervalRaw != null ? Number.parseInt(String(intervalRaw), 10) : NaN;
  const hasCron = cron.length > 0;
  const hasInterval = Number.isFinite(intervalMin) && intervalMin > 0;

  if (!hasCron && !hasInterval) return false;

  const ultimoMs = row.ultimo_ciclo ? new Date(row.ultimo_ciclo).getTime() : NaN;
  const ultimoValid = Number.isFinite(ultimoMs);

  if (hasCron) {
    if (!cronMatchesUtc(now, cron)) return false;
    const minuteStart = startOfUtcMinute(now);
    if (ultimoValid && ultimoMs >= minuteStart) return false;
    return true;
  }

  if (!ultimoValid) return true;
  return now.getTime() - ultimoMs >= intervalMin * 60_000 - 5000;
}

/**
 * Resolve rota + parâmetro `ciclo` para o runner existente.
 * Sem `configuracoes.dispatch`, só agentes "conhecidos" (slugs alinhados ao documento mestre).
 */
export function inferDispatchFromCicloRow(
  row: Pick<HubCicloIaDispatchRow, "agente_slug" | "nome" | "configuracoes">
): { api: DispatchApiSlug; ciclo: string } | null {
  const cfg = row.configuracoes;
  if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
    const d = (cfg as Record<string, unknown>).dispatch;
    if (d && typeof d === "object" && !Array.isArray(d)) {
      const dr = d as Record<string, unknown>;
      const api = String(dr.api || "").trim();
      const ciclo = String(dr.ciclo || "").trim();
      if (
        api &&
        ciclo &&
        (DISPATCH_API_SLUGS as readonly string[]).includes(api)
      ) {
        return { api: api as DispatchApiSlug, ciclo };
      }
    }
  }

  const nome = row.nome.toLowerCase();
  const slug = row.agente_slug;

  if (nome.includes("cadência") || nome.includes("cadencia")) {
    return { api: "agente", ciclo: "briefing_programado" };
  }

  let ciclo: string;
  if (nome.includes("follow")) ciclo = "followup";
  else if (nome.includes("sla")) ciclo = "sla";
  else if ((nome.includes("manha") || nome.includes("matinal")) && slug === "gerente_atendimento")
    ciclo = "relatorio_manha";
  else if (nome.includes("manha") || nome.includes("matinal")) ciclo = "analise_manha";
  else if (nome.includes("noite")) ciclo = "analise_noite";
  else if (nome.includes("tráfego") || nome.includes("trafego")) ciclo = "trafego";
  else if (nome.includes("supervis")) ciclo = "supervisao";
  else return null;

  let api: DispatchApiSlug | null = null;
  if (slug === "diretor" || slug === "diretor_geral_ia" || slug === "diretor_operacoes")
    api = "diretor";
  else if (slug === "gerente_atendimento") api = "gerente";
  else if (slug === "atendente") api = "atendente";

  if (!api) {
    const origem =
      cfg && typeof cfg === "object" ? (cfg as Record<string, unknown>).ciclo_origem_provisionamento : null;
    if (origem === "wizard_agente_v1") {
      return { api: "agente", ciclo: "briefing_programado" };
    }
    return null;
  }
  return { api, ciclo };
}

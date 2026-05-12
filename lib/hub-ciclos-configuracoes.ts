/** Limites para hub_ciclos_ia.configuracoes (follow-up do atendente). */
const MAX_HORAS_UMA_ESPERA = 8760;
const MAX_PASSOS_HORAS_LISTA = 24;
const MIN_DIAS_ARQUIVAR = 1;
const MAX_DIAS_ARQUIVAR = 365;

export type FollowupRuntimeFromCiclo = {
  /** Quando definido, sobrescreve hub_followup_config.horas_espera por passo (1 = índice 0). */
  horasPorPasso: number[] | null;
  /** Total de horas sem avanço antes de arquivar após passo > 3 (equivale a dias * 24). */
  arquivarAposHoras: number;
};

/**
 * Valida/normaliza `configuracoes` em writes (API). Campos desconhecidos são preservados.
 */
export function validateAndNormalizeCicloConfiguracoes(
  raw: unknown
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (raw == null) {
    return { ok: true, value: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "configuracoes deve ser um objeto." };
  }
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };

  if ("horas_followup" in out) {
    const h = out.horas_followup;
    if (!Array.isArray(h)) {
      return { ok: false, error: "horas_followup deve ser uma lista de números (horas entre 1 e 8760)." };
    }
    if (h.length === 0) {
      return { ok: false, error: "horas_followup não pode ser vazio." };
    }
    if (h.length > MAX_PASSOS_HORAS_LISTA) {
      return { ok: false, error: `horas_followup pode ter no máximo ${MAX_PASSOS_HORAS_LISTA} valores.` };
    }
    const cleaned: number[] = [];
    for (const x of h) {
      const n = typeof x === "number" ? x : Number.parseInt(String(x), 10);
      if (!Number.isFinite(n) || n < 1 || n > MAX_HORAS_UMA_ESPERA) {
        return {
          ok: false,
          error: `Cada valor em horas_followup deve ser entre 1 e ${MAX_HORAS_UMA_ESPERA}.`,
        };
      }
      cleaned.push(Math.trunc(n));
    }
    out.horas_followup = cleaned;
  }

  if ("arquivar_apos_dias" in out) {
    const d =
      typeof out.arquivar_apos_dias === "number"
        ? out.arquivar_apos_dias
        : Number.parseInt(String(out.arquivar_apos_dias ?? ""), 10);
    if (!Number.isFinite(d) || d < MIN_DIAS_ARQUIVAR || d > MAX_DIAS_ARQUIVAR) {
      return {
        ok: false,
        error: `arquivar_apos_dias deve ser entre ${MIN_DIAS_ARQUIVAR} e ${MAX_DIAS_ARQUIVAR}.`,
      };
    }
    out.arquivar_apos_dias = Math.trunc(d);
  }

  return { ok: true, value: out };
}

/**
 * Lê configuracoes do ciclo no job: nunca falha; se inválido ou vazio, replica o comportamento antigo (168 h = 7 dias).
 */
export function parseFollowupFromCicloConfiguracoes(raw: unknown): FollowupRuntimeFromCiclo {
  const legacyArquivarHoras = 168;
  const defaults: FollowupRuntimeFromCiclo = {
    horasPorPasso: null,
    arquivarAposHoras: legacyArquivarHoras,
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaults;
  }
  const o = raw as Record<string, unknown>;

  let arquivarAposHoras = legacyArquivarHoras;
  if (o.arquivar_apos_dias != null) {
    const d =
      typeof o.arquivar_apos_dias === "number"
        ? o.arquivar_apos_dias
        : Number.parseInt(String(o.arquivar_apos_dias), 10);
    if (Number.isFinite(d) && d >= MIN_DIAS_ARQUIVAR && d <= MAX_DIAS_ARQUIVAR) {
      arquivarAposHoras = d * 24;
    }
  }

  let horasPorPasso: number[] | null = null;
  if (Array.isArray(o.horas_followup) && o.horas_followup.length > 0) {
    const cleaned = o.horas_followup
      .map((x) => (typeof x === "number" ? x : Number.parseInt(String(x), 10)))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= MAX_HORAS_UMA_ESPERA)
      .slice(0, MAX_PASSOS_HORAS_LISTA);
    if (cleaned.length > 0) {
      horasPorPasso = cleaned.map((n) => Math.trunc(n));
    }
  }

  return { horasPorPasso, arquivarAposHoras };
}

/** Linha mínima de hub_followup_config para pré-visualização no CRM (sem template). */
export type HubFollowupConfigLite = {
  passo: number;
  mercado: string;
  horas_espera: number;
};

/**
 * Replica a resolução do job: entre linhas do mesmo passo, `mercado` desempata
 * por ordem lexicográfica decrescente (como `.order("mercado", { ascending: false })` no Supabase).
 */
export function pickHubFollowupRow(
  rows: HubFollowupConfigLite[],
  mercado: string,
  passo: number
): HubFollowupConfigLite | null {
  const cands = rows.filter(
    (r) => r.passo === passo && (r.mercado === mercado || r.mercado === "geral")
  );
  if (cands.length === 0) return null;
  cands.sort((a, b) => b.mercado.localeCompare(a.mercado));
  return cands[0];
}

export type FollowupMergeLinha = {
  passo: number;
  hubHoras: number;
  mergeHoras: number;
  usaLista: boolean;
};

/**
 * Uma linha por passo ativo no hub para o mercado escolhido, com horas após o mesmo merge do cron
 * (`Math.min(passo - 1, lista.length - 1)` quando a lista é válida).
 */
export function buildFollowupMergePreview(
  rows: HubFollowupConfigLite[],
  mercado: string,
  horasLista: number[] | null
): FollowupMergeLinha[] {
  const passos = [
    ...new Set(
      rows
        .filter((r) => r.mercado === mercado || r.mercado === "geral")
        .map((r) => r.passo)
    ),
  ].sort((a, b) => a - b);
  const out: FollowupMergeLinha[] = [];
  for (const passo of passos) {
    const win = pickHubFollowupRow(rows, mercado, passo);
    if (!win) continue;
    const idx = passo - 1;
    let mergeHoras = win.horas_espera;
    let usaLista = false;
    if (horasLista && horasLista.length > 0) {
      const i = Math.min(idx, horasLista.length - 1);
      const ov = horasLista[i];
      if (typeof ov === "number" && ov > 0) {
        mergeHoras = ov;
        usaLista = true;
      }
    }
    out.push({ passo, hubHoras: win.horas_espera, mergeHoras, usaLista });
  }
  return out;
}

export type FollowupCompatAvisos = {
  avisos: string[];
  /** true quando existem passos no hub cuja lista tem menos entradas (último valor replicado). */
  listaReplicadaAlemDoTamanho: boolean;
  /** Intervalo entre execuções maior que a menor espera após merge (risco de atraso do cron). */
  intervaloMaiorQueMenorMerge: boolean;
};

/** Estima minutos entre execuções: campo intervalo_minutos ou cron com passo "cada N minutos" no primeiro campo (ex.: barra asterisco + N). */
export function estimarIntervaloMinutosCron(intervaloMinutos: unknown, cronExpressao: string): number | null {
  if (intervaloMinutos != null && intervaloMinutos !== "") {
    const i = typeof intervaloMinutos === "number" ? intervaloMinutos : Number.parseInt(String(intervaloMinutos), 10);
    if (Number.isFinite(i) && i > 0) return Math.trunc(i);
  }
  const cron = (cronExpressao || "").trim();
  const m = /^\*\/(\d+)\s+/.exec(cron);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function followupCompatibilidadeAvisos(
  preview: FollowupMergeLinha[],
  horasLista: number[] | null,
  opts?: { intervaloMinutos?: number | null }
): FollowupCompatAvisos {
  const avisos: string[] = [];
  let intervaloMaiorQueMenorMerge = false;

  if (preview.length === 0) {
    avisos.push("Não há passos ativos em hub_followup_config para este mercado (e fallback geral).");
    return { avisos, listaReplicadaAlemDoTamanho: false, intervaloMaiorQueMenorMerge: false };
  }

  const minMergeH = Math.min(...preview.map((p) => p.mergeHoras));
  const im = opts?.intervaloMinutos;
  if (im != null && im > 0 && minMergeH > 0) {
    const minMergeMin = minMergeH * 60;
    if (im > minMergeMin) {
      intervaloMaiorQueMenorMerge = true;
      avisos.push(
        `Intervalo do ciclo (${im} min) é maior que a menor espera após merge (${minMergeH} h = ${minMergeMin} min). ` +
          "O job só roda a cada disparo do agendamento; mensagens podem atrasar até esse intervalo após o prazo."
      );
    }
  }

  const maxPasso = Math.max(...preview.map((p) => p.passo));
  if (!horasLista || horasLista.length === 0) {
    avisos.push(
      "Sem lista válida de horas no ciclo: o job usará somente horas_espera de hub_followup_config em todos os passos."
    );
    return { avisos, listaReplicadaAlemDoTamanho: false, intervaloMaiorQueMenorMerge };
  }
  const n = horasLista.length;
  let listaReplicadaAlemDoTamanho = false;
  if (maxPasso > n) {
    listaReplicadaAlemDoTamanho = true;
    avisos.push(
      `A lista tem ${n} valor(es), mas o hub define até o passo ${maxPasso}. ` +
        `Os passos ${n + 1} em diante usam a mesma espera que o passo ${n} (como no job).`
    );
  }
  const diverge = preview.filter((p) => p.usaLista && p.mergeHoras !== p.hubHoras);
  if (diverge.length > 0) {
    avisos.push(
      `Sua lista altera a espera em relação ao hub nestes passos: ${diverge.map((p) => p.passo).join(", ")}.`
    );
  }
  return { avisos, listaReplicadaAlemDoTamanho, intervaloMaiorQueMenorMerge };
}

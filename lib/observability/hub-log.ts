import { randomUUID } from "crypto";

export type HubLogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<HubLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): HubLogLevel {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

function shouldLog(level: HubLogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel()];
}

/** Últimos 4 dígitos — suficiente para correlacionar sem expor telefone inteiro. */
export function maskTelefone(telefone: string | undefined | null): string | undefined {
  if (!telefone) return undefined;
  const d = telefone.replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `***${d.slice(-4)}`;
}

export type HubLogger = {
  traceId: string;
  info: (event: string, fields?: Record<string, unknown>) => void;
  warn: (event: string, fields?: Record<string, unknown>) => void;
  error: (event: string, fields?: Record<string, unknown>) => void;
  child: (fields: Record<string, unknown>) => HubLogger;
};

export function createHubLogger(
  scope: string,
  baseFields: Record<string, unknown> = {},
  traceId?: string
): HubLogger {
  const id = traceId || randomUUID();
  const startedAt = Date.now();

  const emit = (level: HubLogLevel, event: string, fields?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;
    const payload = {
      ts: new Date().toISOString(),
      level,
      scope,
      event,
      traceId: id,
      duration_ms: Date.now() - startedAt,
      service: "escritorio-virtual",
      ...baseFields,
      ...fields,
    };
    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  const logger: HubLogger = {
    traceId: id,
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
    child: (fields) => createHubLogger(scope, { ...baseFields, ...fields }, id),
  };

  return logger;
}

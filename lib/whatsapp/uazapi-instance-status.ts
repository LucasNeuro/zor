/** Normaliza respostas UAZAPI (/instance/connect, /instance/status, etc.) para hub_agente_identidade.uazapi_connection_status */

export type UazapiConnectionStatus = "disconnected" | "connecting" | "connected";

const VALID: ReadonlySet<string> = new Set(["disconnected", "connecting", "connected"]);

export function pickInstanceFromResponse(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const inst = p.instance;
  if (inst && typeof inst === "object" && !Array.isArray(inst)) return inst as Record<string, unknown>;
  return null;
}

export function extrairDiagnosticoInstanciaUazapi(payload: unknown): {
  lastDisconnectReason?: string;
  lastDisconnect?: string;
  profileName?: string;
  owner?: string;
} {
  const inst = pickInstanceFromResponse(payload);
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const src = inst || root;
  if (!src) return {};

  const out: {
    lastDisconnectReason?: string;
    lastDisconnect?: string;
    profileName?: string;
    owner?: string;
  } = {};

  if (typeof src.lastDisconnectReason === "string" && src.lastDisconnectReason.trim()) {
    out.lastDisconnectReason = src.lastDisconnectReason.trim();
  }
  if (typeof src.lastDisconnect === "string" && src.lastDisconnect.trim()) {
    out.lastDisconnect = src.lastDisconnect.trim();
  }
  if (typeof src.profileName === "string" && src.profileName.trim()) {
    out.profileName = src.profileName.trim();
  }
  if (typeof src.owner === "string" && src.owner.trim()) {
    out.owner = src.owner.trim();
  }
  return out;
}

function normStatusString(raw: string): UazapiConnectionStatus | null {
  const s = raw.trim().toLowerCase();
  if (VALID.has(s)) return s as UazapiConnectionStatus;
  if (s === "open" || s === "online" || s === "ready") return "connected";
  return null;
}

/**
 * Prioridade (OpenAPI /instance/status):
 * 1. `status.connected === true` (ou loggedIn + connected implícito)
 * 2. `instance.status`
 * 3. `connected` boolean na raiz
 */
export function statusFromPayloadUazapi(payload: unknown): UazapiConnectionStatus {
  if (!payload || typeof payload !== "object") return "disconnected";
  const p = payload as Record<string, unknown>;

  const statusBlock = p.status;
  if (statusBlock && typeof statusBlock === "object" && !Array.isArray(statusBlock)) {
    const so = statusBlock as Record<string, unknown>;
    if (so.connected === true) return "connected";
    if (so.loggedIn === true && so.connected !== false) return "connected";
  }

  if (p.connected === true) return "connected";

  const inst = pickInstanceFromResponse(payload);
  if (inst) {
    const fromInst =
      typeof inst.status === "string" ? normStatusString(inst.status) : null;
    if (fromInst === "connected") return "connected";
    if (fromInst) {
      const blockConnected =
        statusBlock &&
        typeof statusBlock === "object" &&
        !Array.isArray(statusBlock) &&
        (statusBlock as Record<string, unknown>).connected === true;
      if (blockConnected) return "connected";
      return fromInst;
    }
  }

  const rootStatus = typeof p.status === "string" ? normStatusString(p.status) : null;
  if (rootStatus) return rootStatus;

  return "disconnected";
}

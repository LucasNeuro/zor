import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";
import { uazapiSendText, type UazapiSendTextResult } from "@/lib/whatsapp/uazapi-send";
import { normalizeGroupJid } from "@/lib/whatsapp/lead-group-routing";

export type UazapiGroupResult =
  | { ok: true; status: number; groupJid: string; groupName: string; body?: unknown }
  | { ok: false; status?: number; body?: unknown; error: string };

export type UazapiGroupAnnounceResult =
  | { ok: true; status: number; body?: unknown }
  | { ok: false; status?: number; body?: unknown; error: string };

function resolveInstanceToken(instanceToken?: string | null): string {
  return (instanceToken?.trim() || process.env.UAZAPI_INSTANCE_TOKEN?.trim()) ?? "";
}

function extrairGroupJid(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  for (const key of ["JID", "jid", "groupjid", "groupJid"]) {
    const v = o[key];
    if (typeof v === "string") {
      const norm = normalizeGroupJid(v);
      if (norm) return norm;
    }
  }
  const group = o.group;
  if (group && typeof group === "object") {
    const nested = extrairGroupJid(group);
    if (nested) return nested;
  }
  return null;
}

function extrairGroupName(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const o = data as Record<string, unknown>;
  for (const key of ["Name", "name"]) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const group = o.group;
  if (group && typeof group === "object") {
    const nested = extrairGroupName(group, "");
    if (nested) return nested;
  }
  return fallback;
}

/**
 * POST /group/create — header `token` = token da instância.
 * @see docs/uazapi-openapi-spec
 */
export async function uazapiCreateGroup(
  name: string,
  participants: string[],
  instanceToken?: string | null
): Promise<UazapiGroupResult> {
  const token = resolveInstanceToken(instanceToken);
  if (!token) {
    return {
      ok: false,
      error: "Token da instância não configurado (agente ligado à UAZAPI ou UAZAPI_INSTANCE_TOKEN)",
    };
  }

  const groupName = name.trim().slice(0, 100);
  const nums = participants
    .map((p) => p.replace(/\D/g, ""))
    .filter((p) => p.length >= 10)
    .slice(0, 50);

  if (!groupName) {
    return { ok: false, error: "Nome do grupo é obrigatório" };
  }
  if (nums.length < 1) {
    return { ok: false, error: "Pelo menos um participante válido é obrigatório" };
  }

  const res = await uazapiFetchJson<unknown>("/group/create", {
    method: "POST",
    instanceToken: token,
    body: { name: groupName, participants: nums },
  });

  if (!res.ok) {
    return { ok: false, status: res.status, body: res.data, error: res.error };
  }

  const groupJid = extrairGroupJid(res.data);
  if (!groupJid) {
    return {
      ok: false,
      status: res.status,
      body: res.data,
      error: "Grupo criado mas JID não retornado pela UAZAPI",
    };
  }

  return {
    ok: true,
    status: res.status,
    groupJid,
    groupName: extrairGroupName(res.data, groupName),
    body: res.data,
  };
}

/** POST /send/text com destino `@g.us` (reutiliza `uazapiSendText`). */
export async function uazapiSendTextToGroup(
  groupJid: string,
  text: string,
  instanceToken?: string | null
): Promise<UazapiSendTextResult> {
  const jid = normalizeGroupJid(groupJid);
  if (!jid) {
    return { ok: false, error: "groupJid inválido (esperado formato xxxx@g.us)" };
  }
  return uazapiSendText(jid, text, instanceToken);
}

/**
 * POST /group/updateAnnounce — restringe envio de mensagens a administradores.
 * @see docs/uazapi-openapi-spec
 */
export async function uazapiUpdateGroupAnnounce(
  groupJid: string,
  announceOnlyAdmins: boolean,
  instanceToken?: string | null
): Promise<UazapiGroupAnnounceResult> {
  const token = resolveInstanceToken(instanceToken);
  if (!token) {
    return {
      ok: false,
      error: "Token da instância não configurado (agente ligado à UAZAPI ou UAZAPI_INSTANCE_TOKEN)",
    };
  }

  const jid = normalizeGroupJid(groupJid);
  if (!jid) {
    return { ok: false, error: "groupJid inválido (esperado formato xxxx@g.us)" };
  }

  const res = await uazapiFetchJson<unknown>("/group/updateAnnounce", {
    method: "POST",
    instanceToken: token,
    body: { groupjid: jid, announce: announceOnlyAdmins },
  });

  if (!res.ok) {
    return { ok: false, status: res.status, body: res.data, error: res.error };
  }

  return { ok: true, status: res.status, body: res.data };
}

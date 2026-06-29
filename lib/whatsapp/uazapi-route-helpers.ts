import {
  extrairQrcodeDePayloadUazapi,
  resolverQrcodeImagemParaApi,
} from "@/lib/whatsapp/qr-uazapi";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

export async function resolverQrRespostaUazapi(
  payload: unknown,
  instanceToken: string
): Promise<{ qrcode?: string; qr_invalid?: boolean }> {
  let qrRaw = extrairQrcodeDePayloadUazapi(payload);
  if (!qrRaw) {
    const st = await uazapiFetchJson<Record<string, unknown>>("/instance/status", {
      method: "GET",
      instanceToken,
    });
    if (st.ok) qrRaw = extrairQrcodeDePayloadUazapi(st.data);
  }
  if (!qrRaw) return {};
  const resolved = await resolverQrcodeImagemParaApi(qrRaw, instanceToken);
  if ("src" in resolved && resolved.src) return { qrcode: resolved.src };
  if ("invalid" in resolved) return { qr_invalid: true };
  return {};
}

export type UazapiErrOut = {
  ok: false;
  status: number;
  data: unknown;
  error: string;
  request?: { origin: string; pathname: string };
};

export function jsonErroUazapi(out: {
  error: string;
  data: unknown;
  request?: { origin: string; pathname: string };
  uazapi_connection_status?: string;
  uazapi_auth_failed?: boolean;
}) {
  return {
    error: out.error,
    uazapi: out.data,
    ...(out.request ? { uazapi_request: out.request } : {}),
    ...(out.uazapi_connection_status ? { uazapi_connection_status: out.uazapi_connection_status } : {}),
    ...(out.uazapi_auth_failed ? { uazapi_auth_failed: true } : {}),
  };
}

export function uazapiAuthFalhou(out: UazapiErrOut): boolean {
  if (out.status === 401 || out.status === 403) return true;
  const payloadTxt =
    typeof out.data === "string"
      ? out.data
      : out.data && typeof out.data === "object"
        ? JSON.stringify(out.data)
        : "";
  const msg = `${out.error} ${payloadTxt}`.toLowerCase();
  return (
    msg.includes("invalid token") ||
    msg.includes("token invalid") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("not authorized")
  );
}

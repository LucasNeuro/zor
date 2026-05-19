/** Extração e normalização de QR devolvido pela UAZAPI (sem HTTP — seguro para cliente e servidor). */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** PNG ou JPEG válido (evita mostrar string de pareamento como se fosse imagem). */
export function bufferTemAssinaturaImagem(buf: Buffer): boolean {
  if (buf.length < 8) return false;
  const png =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return png || jpeg;
}

function extrairBase64DeDataUrl(src: string): string | null {
  const m = src.match(/^data:image\/[a-z+.-]+;base64,(.+)$/i);
  return m ? m[1].replace(/\s/g, "") : null;
}

/** Confirma que o `src` de `<img>` é uma imagem PNG/JPEG decodificável. */
export function validarSrcImagemQrUazapi(src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;

  let b64: string | null = null;
  if (/^data:image\//i.test(s)) {
    b64 = extrairBase64DeDataUrl(s);
  } else if (/^[A-Za-z0-9+/=]+$/.test(s.replace(/\s/g, ""))) {
    b64 = s.replace(/\s/g, "");
  }
  if (!b64 || b64.length < 64) return false;

  try {
    const buf = Buffer.from(b64, "base64");
    return bufferTemAssinaturaImagem(buf);
  } catch {
    return false;
  }
}

function stringifyQrCandidate(c: unknown): string | undefined {
  if (typeof c === "string") {
    const t = c.trim();
    if (t.length < 32) return undefined;
    return t;
  }
  const o = asRecord(c);
  if (!o) return undefined;
  for (const k of ["base64", "image", "data", "qrcode", "qr", "value", "png"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length >= 32) return v.trim();
  }
  return undefined;
}

function candidatoEhImagemValida(raw: string): boolean {
  const norm = normalizarSrcImagemQrUazapi(raw);
  return norm != null && validarSrcImagemQrUazapi(norm);
}

/** Percorre caminhos usuais na resposta JSON de connect / status (só imagens válidas). */
export function extrairQrcodeDePayloadUazapi(payload: unknown): string | undefined {
  const r = asRecord(payload);
  if (!r) return undefined;

  /** `instance.qrcode` primeiro — formato documentado na OpenAPI UAZAPI. */
  const nested: unknown[] = [
    asRecord(r.instance)?.qrcode,
    r.qrcode,
    asRecord(r.instance)?.qr,
    r.qr,
    r.qrCode,
    r.Qrcode,
    asRecord(r.data)?.qrcode,
    asRecord(r.data)?.qr,
    asRecord(r.result)?.qrcode,
    asRecord(r.response)?.qrcode,
  ];

  for (const c of nested) {
    const s = stringifyQrCandidate(c);
    if (s && candidatoEhImagemValida(s)) return s;
  }

  return undefined;
}

export function extrairPaircodeDePayloadUazapi(payload: unknown): string | undefined {
  const r = asRecord(payload);
  if (!r) return undefined;
  const nested: unknown[] = [
    r.paircode,
    r.pairingCode,
    r.code,
    asRecord(r.instance)?.paircode,
    asRecord(r.instance)?.pairingCode,
  ];
  for (const c of nested) {
    if (typeof c === "string" && c.trim().length >= 4) return c.trim();
    if (typeof c === "number" && String(c).length >= 4) return String(c);
  }
  return undefined;
}

function mimeForRawBase64(b64: string): "png" | "jpeg" {
  if (b64.startsWith("iVBOR")) return "png";
  if (b64.startsWith("/9j/")) return "jpeg";
  return "png";
}

/**
 * Devolve string utilizável em `<img src>` ou `null` se não for imagem válida.
 * Não converte strings de pareamento WhatsApp em data-URL falsa.
 */
export function normalizarSrcImagemQrUazapi(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^data:image\/[a-z+.-]+;base64,/i.test(s)) {
    const cleaned = s.replace(/\s/g, "");
    return validarSrcImagemQrUazapi(cleaned) ? cleaned : null;
  }
  if (/^https?:\/\//i.test(s)) return s;

  const b64 = s.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(b64) && b64.length >= 64) {
    const mime = mimeForRawBase64(b64);
    const dataUrl = `data:image/${mime};base64,${b64}`;
    return validarSrcImagemQrUazapi(dataUrl) ? dataUrl : null;
  }

  return null;
}

export type QrcodeResolvido = { src: string } | { invalid: true } | Record<string, never>;

/** Normaliza e, se for URL da UAZAPI, obtém bytes com o token da instância. */
export async function resolverQrcodeImagemParaApi(
  raw: string | undefined,
  instanceToken?: string
): Promise<QrcodeResolvido> {
  if (!raw?.trim()) return {};

  const norm = normalizarSrcImagemQrUazapi(raw);
  if (norm && validarSrcImagemQrUazapi(norm)) return { src: norm };

  const url = raw.trim();
  if (/^https?:\/\//i.test(url) && instanceToken?.trim()) {
    try {
      const res = await fetch(url, {
        headers: { token: instanceToken.trim(), Accept: "image/*,application/json" },
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (bufferTemAssinaturaImagem(buf)) {
          const ct = res.headers.get("content-type") || "";
          const mime = ct.includes("jpeg") || ct.includes("jpg") ? "jpeg" : "png";
          return {
            src: `data:image/${mime};base64,${buf.toString("base64")}`,
          };
        }
      }
    } catch {
      /* rede */
    }
  }

  return { invalid: true };
}

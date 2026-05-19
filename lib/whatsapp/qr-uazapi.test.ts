import { describe, expect, it } from "vitest";
import {
  extrairQrcodeDePayloadUazapi,
  normalizarSrcImagemQrUazapi,
  validarSrcImagemQrUazapi,
} from "./qr-uazapi";

/** PNG 1×1 válido */
const PNG_1X1_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("qr-uazapi", () => {
  it("aceita data URL PNG da UAZAPI", () => {
    const raw = `data:image/png;base64,${PNG_1X1_B64}`;
    const norm = normalizarSrcImagemQrUazapi(raw);
    expect(norm).toBeTruthy();
    expect(validarSrcImagemQrUazapi(norm!)).toBe(true);
  });

  it("rejeita string de pareamento disfarçada de base64", () => {
    const pairingLike = "2@abcDEFghijklmnopqrstuvwxyz0123456789+/==,,extraPayloadForWhatsApp";
    expect(normalizarSrcImagemQrUazapi(pairingLike)).toBeNull();
    expect(
      extrairQrcodeDePayloadUazapi({
        qr: pairingLike,
        instance: { qrcode: `data:image/png;base64,${PNG_1X1_B64}` },
      })
    ).toBe(`data:image/png;base64,${PNG_1X1_B64}`);
  });

  it("prefere instance.qrcode", () => {
    const good = `data:image/png;base64,${PNG_1X1_B64}`;
    const bad = "a".repeat(80);
    expect(
      extrairQrcodeDePayloadUazapi({
        qr: bad,
        instance: { qrcode: good },
      })
    ).toBe(good);
  });
});

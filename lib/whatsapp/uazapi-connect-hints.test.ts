import { describe, expect, it } from "vitest";
import {
  formatUazapiDisconnectReasonForUi,
  isBenignUazapiDisconnectReason,
} from "./uazapi-connect-hints";

describe("isBenignUazapiDisconnectReason", () => {
  it("trata cancelamento de tentativa como benigno", () => {
    expect(isBenignUazapiDisconnectReason("connection attempt canceled by API")).toBe(true);
    expect(isBenignUazapiDisconnectReason("Connection Attempt Canceled by API")).toBe(true);
  });

  it("mantém erros reais", () => {
    expect(isBenignUazapiDisconnectReason("logged out")).toBe(false);
    expect(isBenignUazapiDisconnectReason("")).toBe(false);
  });
});

describe("formatUazapiDisconnectReasonForUi", () => {
  it("traduz motivo benigno para instrução", () => {
    const msg = formatUazapiDisconnectReasonForUi("connection attempt canceled by API");
    expect(msg).toContain("QR novo");
  });
});

import { describe, expect, it } from "vitest";
import {
  avisoTelefoneBrPareamento,
  buildUazapiInstanceConnectBody,
  mergeUazapiProxyFields,
  proxyFromStoredRow,
  uazapiProxyConfigured,
} from "./uazapi-proxy-connect";

describe("uazapi-proxy-connect", () => {
  it("reads stored row", () => {
    expect(
      proxyFromStoredRow({
        uazapi_proxy_country: "br",
        uazapi_proxy_state: "sp",
        uazapi_proxy_city: "campinas",
      })
    ).toEqual({
      proxy_managed_country: "br",
      proxy_managed_state: "sp",
      proxy_managed_city: "campinas",
    });
  });

  it("merges body over stored", () => {
    const merged = mergeUazapiProxyFields({
      stored: {
        proxy_managed_country: "br",
        proxy_managed_state: "sp",
        proxy_managed_city: "campinas",
      },
      body: { proxy_managed_city: "sao_paulo", proxy_managed_state: "sp" },
    });
    expect(merged?.proxy_managed_city).toBe("sao_paulo");
  });

  it("builds connect payload with proxy", () => {
    const body = buildUazapiInstanceConnectBody({
      proxy: { proxy_managed_country: "br", proxy_managed_city: "rio", proxy_managed_state: "rj" },
    });
    expect(body.proxy_managed_city).toBe("rio");
    expect(uazapiProxyConfigured({ proxy_managed_city: "rio" })).toBe(true);
  });

  it("warns when BR mobile may be missing digit 9", () => {
    expect(avisoTelefoneBrPareamento("551114589862")).toMatch(/13 dígitos/);
    expect(avisoTelefoneBrPareamento("5511914589862")).toBeNull();
  });
});

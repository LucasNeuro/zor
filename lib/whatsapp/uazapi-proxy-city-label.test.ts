import { describe, expect, it } from "vitest";
import {
  buildProxyCityApiSearch,
  filterProxyCitiesByQuery,
  formatProxyCityDisplay,
  formatProxyCityLabel,
} from "@/lib/whatsapp/uazapi-proxy-city-label";

describe("uazapi-proxy-city-label", () => {
  it("formata slug para título", () => {
    expect(formatProxyCityLabel("sao_lourenco_da_mata")).toBe("Sao Lourenco Da Mata");
    expect(formatProxyCityLabel("saopaulo")).toBe("Saopaulo");
  });

  it("monta rótulo com UF", () => {
    expect(formatProxyCityDisplay("São Paulo", "pe")).toBe("São Paulo (PE)");
  });

  it("normaliza busca para API", () => {
    expect(buildProxyCityApiSearch("São Paulo")).toBe("saopaulo");
    expect(buildProxyCityApiSearch("Camp")).toBe("camp");
  });

  it("filtra cidades pelo texto digitado", () => {
    const cities = [
      { value: "saopaulo", label: "São Paulo", state: "sp" },
      { value: "mogi_mirim", label: "Mogi Mirim", state: "sp" },
      { value: "campinas", label: "Campinas", state: "sp" },
    ];
    expect(filterProxyCitiesByQuery(cities, "São Paulo")).toEqual([cities[0]]);
    expect(filterProxyCitiesByQuery(cities, "mogi")).toEqual([cities[1]]);
    expect(filterProxyCitiesByQuery(cities, "camp")).toEqual([cities[2]]);
  });
});

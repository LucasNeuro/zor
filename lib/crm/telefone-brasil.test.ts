import { describe, expect, it } from "vitest";
import {
  formatarTelefoneBrasil,
  parseTelefoneBrasil,
  telefoneDigitsCopia,
} from "./telefone-brasil";

describe("telefone-brasil", () => {
  it("interpreta 55 como código do país", () => {
    const p = parseTelefoneBrasil("5511932066145");
    expect(p?.ddd).toBe("11");
    expect(p?.e164).toBe("5511932066145");
    expect(formatarTelefoneBrasil("5511932066145")).toBe("+55 (11) 93206-6145");
  });

  it("formata DDD 48 (Sul)", () => {
    const p = parseTelefoneBrasil("554891447974");
    expect(p?.ddd).toBe("48");
    expect(p?.regiao).toBe("sul");
    expect(p?.uf).toBe("SC");
  });

  it("copia dígitos E.164", () => {
    expect(telefoneDigitsCopia("(11) 98598-0273")).toBe("5511985980273");
  });
});

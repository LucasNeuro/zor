import { describe, expect, it } from "vitest";
import { encodeMimeHeaderValue, repararMojibakeUtf8 } from "./gmail-send";

function simularMojibakeUtf8(texto: string, vezes = 2): string {
  let cur = texto;
  for (let i = 0; i < vezes; i++) {
    cur = Buffer.from(cur, "utf8").toString("latin1");
  }
  return cur;
}

describe("gmail-send subject encoding", () => {
  it("repara mojibake duplo típico de Relatório", () => {
    const corrupto = simularMojibakeUtf8("Relatório de Saúde dos Dados de Contatos", 2);
    const fixed = repararMojibakeUtf8(corrupto);
    expect(fixed).toBe("Relatório de Saúde dos Dados de Contatos");
  });

  it("codifica assunto com acentos em RFC 2047 UTF-8 B", () => {
    const encoded = encodeMimeHeaderValue("Relatório de Saúde — Waje CRM");
    expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    const b64 = encoded.replace(/^=\?UTF-8\?B\?/, "").replace(/\?=$/, "");
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    expect(decoded).toBe("Relatório de Saúde — Waje CRM");
  });

  it("mantém assunto ASCII sem encoding", () => {
    expect(encodeMimeHeaderValue("Weekly report Q1")).toBe("Weekly report Q1");
  });
});

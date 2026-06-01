import { describe, expect, it } from "vitest";
import { _parsePlaybookAnalysisForTests } from "./mistral-analysis";
import {
  MAX_PLAYBOOK_UPLOAD_BYTES,
  customPlaybookObjectPath,
  normalizePlaybookText,
  validatePlaybookUploadFile,
} from "./custom-playbook";

describe("custom-playbook validation", () => {
  it("aceita markdown válido", () => {
    const file = new File(["# Playbook\nConteúdo"], "agente.md", { type: "text/markdown" });
    const res = validatePlaybookUploadFile(file);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.extension).toBe(".md");
      expect(res.mimeType).toBe("text/markdown");
    }
  });

  it("rejeita extensão inválida", () => {
    const file = new File(["{}"], "playbook.pdf", { type: "application/pdf" });
    const res = validatePlaybookUploadFile(file);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(415);
  });

  it("rejeita acima do limite", () => {
    const oversized = "a".repeat(MAX_PLAYBOOK_UPLOAD_BYTES + 1);
    const file = new File([oversized], "playbook.txt", { type: "text/plain" });
    const res = validatePlaybookUploadFile(file);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(413);
  });

  it("normaliza path com tenant e slug", () => {
    const path = customPlaybookObjectPath("tenant-1", "agente legal", ".txt");
    expect(path).toBe("tenant-1/agente_legal/playbook.txt");
  });

  it("normaliza quebra de linha e trim", () => {
    expect(normalizePlaybookText("a\r\nb\r\n")).toBe("a\nb");
  });
});

describe("mistral analysis parser", () => {
  it("interpreta payload JSON válido", () => {
    const parsed = _parsePlaybookAnalysisForTests(`{
      "resumo_executivo":"Boa estrutura geral.",
      "nota": 8.2,
      "nota_comentario":"Clareza boa; faltam SLAs.",
      "pontos_fortes":["Objetivo claro","Checklist operacional"],
      "gaps":["Sem SLA de resposta"],
      "riscos":["Ambiguidade em exceções"],
      "sugestoes":["Adicionar SLA explícito"]
    }`);
    expect(parsed).not.toBeNull();
    expect(parsed?.nota).toBe(8.2);
    expect(parsed?.pontos_fortes.length).toBeGreaterThan(0);
  });

  it("retorna null para JSON inválido ao contrato", () => {
    const parsed = _parsePlaybookAnalysisForTests('{"foo":"bar"}');
    expect(parsed).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adaptarMarkdownParaMotorWhatsapp,
  renderPlaybookFlowBlockToMarkdown,
  upsertPlaybookFlowBlockInMarkdown,
} from "./playbook-flow-markdown";
import { assessPlaybookFlowInMarkdown } from "./playbook-flow-ui";

const NARRATIVO_SO_SCHEMA = `---
obra10_playbook_schema: 1
---

# Playbook — Mari

## Prompt unificado
Texto de exemplo.
`;
const TEXTO_CRU = `Atenda com objetividade e empatia.
Peça nome antes de qualquer classificação.
No final, encaminhe para humano com resumo.`;

describe("adaptarMarkdownParaMotorWhatsapp", () => {
  const template = readFileSync(
    join(process.cwd(), "public/playbook-exemplos/playbook-template-v1.md"),
    "utf8"
  );

  it("acrescenta fluxo ao playbook só narrativo (obra10_playbook_schema)", () => {
    const out = adaptarMarkdownParaMotorWhatsapp(NARRATIVO_SO_SCHEMA, template);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.action).toBe("appended_flow");
    expect(out.markdown).toContain("```json obra10_playbook_flow");
    expect(out.markdown).toContain("obra10_playbook_flow_schema");
    expect(assessPlaybookFlowInMarkdown(out.markdown).kind).toBe("ready");
  });

  it("substitui o fluxo quando já existe um válido", () => {
    const ready = adaptarMarkdownParaMotorWhatsapp(NARRATIVO_SO_SCHEMA, template);
    if (!ready.ok || ready.action !== "appended_flow") {
      throw new Error("setup failed");
    }
    const again = adaptarMarkdownParaMotorWhatsapp(ready.markdown, template);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.action).toBe("replaced_flow");
    expect(again.markdown).toContain("```json obra10_playbook_flow");
    expect(again.markdown).toContain("obra10_playbook_flow_schema");
  });

  it("estrutura texto cru em markdown e acrescenta fluxo", () => {
    const out = adaptarMarkdownParaMotorWhatsapp(TEXTO_CRU, template);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.action).toBe("appended_flow");
    expect(out.markdown).toContain("obra10_playbook_schema: 1");
    expect(out.markdown).toContain("# Playbook — Rascunho calibracao");
    expect(out.markdown).toContain("## Prompt unificado");
    expect(out.markdown).toContain("```json obra10_playbook_flow");
    expect(assessPlaybookFlowInMarkdown(out.markdown).kind).toBe("ready");
  });
});

describe("upsertPlaybookFlowBlockInMarkdown", () => {
  const flowA = {
    obra10_playbook_flow_schema: 1 as const,
    entry_step_id: "inicio",
    steps: [
      { id: "inicio", kind: "message" as const, message: "A", next: "fim" },
      { id: "fim", kind: "complete" as const, complete: { type: "complete" as const, summary: "done" } },
    ],
  };

  const flowB = {
    ...flowA,
    entry_step_id: "fim",
  };

  it("substitui apenas o fence do fluxo e preserva resto do markdown", () => {
    const markdown = `# Documento

Texto inicial.

## Bloco de fluxo dinamico (obrigatorio para WhatsApp)

\`\`\`json obra10_playbook_flow
${JSON.stringify(flowA, null, 2)}
\`\`\`

## Secao apos fluxo
Nao pode ser removida.
`;
    const out = upsertPlaybookFlowBlockInMarkdown(markdown, flowB);
    expect(out).toContain('entry_step_id": "fim"');
    expect(out).toContain("## Secao apos fluxo");
    expect(out).toContain("Nao pode ser removida.");
    expect(out).not.toContain('entry_step_id": "inicio"');
  });

  it("anexa bloco completo quando fence ainda não existe", () => {
    const markdown = `# Documento\n\nSem fluxo ainda.\n`;
    const out = upsertPlaybookFlowBlockInMarkdown(markdown, flowA);
    expect(out).toContain("## Bloco de fluxo dinamico (obrigatorio para WhatsApp)");
    expect(out).toContain("```json obra10_playbook_flow");
  });

  it("mantem um único fence após múltiplos upserts", () => {
    const markdown = `# Documento\n\nSem fluxo ainda.\n`;
    const first = upsertPlaybookFlowBlockInMarkdown(markdown, flowA);
    const second = upsertPlaybookFlowBlockInMarkdown(first, flowB);
    const count = (second.match(/```json obra10_playbook_flow/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("aceita fence com info string adicional", () => {
    const markdown = `# Documento

\`\`\`jsonc obra10_playbook_flow extra
${JSON.stringify(flowA, null, 2)}
\`\`\`
`;
    const out = upsertPlaybookFlowBlockInMarkdown(markdown, flowB);
    expect(out).toContain("```json obra10_playbook_flow");
    expect(out).toContain('"entry_step_id": "fim"');
  });

  it("gera bloco renderizado válido para roundtrip parse/ui", () => {
    const markdown = `# Base${renderPlaybookFlowBlockToMarkdown(flowA)}`;
    expect(assessPlaybookFlowInMarkdown(markdown).kind).toBe("ready");
  });
});

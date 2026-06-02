import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adaptarMarkdownParaMotorWhatsapp } from "./playbook-flow-markdown";
import { assessPlaybookFlowInMarkdown } from "./playbook-flow-ui";

const NARRATIVO_SO_SCHEMA = `---
obra10_playbook_schema: 1
---

# Playbook — Mari

## Prompt unificado
Texto de exemplo.
`;

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
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePlaybookFlowFromMarkdown } from "./flow-parse";
import { validatePlaybookFlowDefinition } from "./flow-validate";

describe("playbook-mari-unificado-obra10-plus.md flow", () => {
  it("parse + validate v1 schema", () => {
    const markdown = readFileSync(
      join(process.cwd(), "docs/playbook-mari-unificado-obra10-plus.md"),
      "utf8"
    );
    const parsed = parsePlaybookFlowFromMarkdown(markdown);
    if (!parsed.ok) {
      console.log(parsed);
    }
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validated = validatePlaybookFlowDefinition(parsed.definition);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    expect(
      validated.definition.waje_playbook_flow_schema ??
        validated.definition.obra10_playbook_flow_schema
    ).toBe(1);
    expect(validated.definition.entry_step_id).toBe("inicio_saudacao");
    expect(validated.definition.steps.length).toBeGreaterThan(0);
  });
});

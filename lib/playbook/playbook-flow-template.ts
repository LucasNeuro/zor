import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { adaptarMarkdownParaMotorWhatsapp } from "@/lib/playbook/playbook-flow-markdown";
import { parsePlaybookFlowFromMarkdown } from "@/lib/playbook/flow-parse";
import { validatePlaybookFlowDefinition } from "@/lib/playbook/flow-validate";

let flowTemplateMarkdownCache: string | null = null;

export async function loadPlaybookFlowTemplateMarkdown(): Promise<string> {
  if (flowTemplateMarkdownCache) return flowTemplateMarkdownCache;
  flowTemplateMarkdownCache = await readFile(
    join(process.cwd(), "public/playbook-exemplos/playbook-template-v1.md"),
    "utf8"
  );
  return flowTemplateMarkdownCache;
}

export async function ensureMarkdownWithWhatsappFlow(markdownRaw: string): Promise<
  | { ok: true; markdown: string; auto_appended_flow: boolean }
  | { ok: false; errors: string[] }
> {
  const trimmed = String(markdownRaw ?? "").trim();
  if (!trimmed) {
    return { ok: false, errors: ["Playbook vazio."] };
  }

  const validateMd = (md: string) => {
    const parsed = parsePlaybookFlowFromMarkdown(md);
    if (!parsed.ok) return { ok: false as const, errors: parsed.errors };
    const validated = validatePlaybookFlowDefinition(parsed.definition);
    if (!validated.ok) return { ok: false as const, errors: validated.errors };
    return { ok: true as const, markdown: md };
  };

  const first = validateMd(trimmed);
  if (first.ok) {
    return { ok: true, markdown: first.markdown, auto_appended_flow: false };
  }

  const template = await loadPlaybookFlowTemplateMarkdown();
  const adapted = adaptarMarkdownParaMotorWhatsapp(trimmed, template);
  if (!adapted.ok) {
    return { ok: false, errors: [adapted.error] };
  }

  const second = validateMd(adapted.markdown);
  if (!second.ok) {
    return { ok: false, errors: second.errors };
  }

  return {
    ok: true,
    markdown: second.markdown,
    auto_appended_flow: adapted.action === "appended_flow",
  };
}

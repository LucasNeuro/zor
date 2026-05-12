# Cursor Agent Skills (Obra10+)

Estas pastas seguem o formato oficial do Cursor: cada skill é um diretório com **`SKILL.md`** (frontmatter YAML + corpo em Markdown).

## Como o Cursor usa

1. **Projeto aberto na pasta `escritorio-virtual/`** (raiz do repo), para o Cursor carregar skills de **`.cursor/skills/`**.
2. O agente usa o campo **`description`** do frontmatter para **decidir quando aplicar** a skill (cenários em inglês ajudam ao modelo).
3. Podes **forçar contexto**: no chat, anexar `@.cursor/skills/frontend-design/SKILL.md` (ou outro ficheiro) quando quiseres garantir que é lido.

## Sincronização com `.ai-skills/installed/`

Existe uma cópia histórica em **`.ai-skills/installed/`** (fluxo tipo Claude Code com `/comandos`). Para evitar divergência:

- Trata **`.cursor/skills/`** como fonte para desenvolvimento no **Cursor**; se alterares regras, copia de volta para `.ai-skills/installed/` se ainda usares esse fluxo.

## Conteúdo

| Pasta | Uso típico no repo |
|-------|-------------------|
| `ai-agent-system` | `lib/ia/*`, webhooks, Anthropic |
| `dashboard-premium` | `/crm`, painéis, KPIs |
| `frontend-design` | `components/*`, UI geral |
| `marketing-agent` | copy, landing, textos de campanha |

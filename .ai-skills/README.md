# AI Skills — Escritório Virtual Obra10+

## Skills Instaladas

| Skill | Categoria | O que faz |
|-------|-----------|-----------|
| frontend-design | UI/UX | Design premium, evita estética genérica |
| dashboard-premium | Dashboard | Padrões de dashboard profissional |
| marketing-agent | Marketing | Copy, landing pages, funis |
| ai-agent-system | IA | Arquitetura de agentes com Claude API |

## Como Usar

No Claude Code:
- `/frontend-design` → antes de criar qualquer UI
- `/dashboard-premium` → ao criar dashboards
- `/marketing-agent` → ao criar copy ou landing pages
- `/ai-agent-system` → ao criar agentes ou integrar API

## Recomendações

1. Sempre ler a skill antes de criar componentes
2. Combinar `frontend-design` + `dashboard-premium` para o escritório
3. Usar `marketing-agent` para copy dos agentes
4. Usar `ai-agent-system` para integração com Claude API

## Estrutura

```
.ai-skills/
├── installed/          ← skills ativas
│   ├── frontend-design/SKILL.md
│   ├── dashboard-premium/SKILL.md
│   ├── marketing-agent/SKILL.md
│   └── ai-agent-system/SKILL.md
├── candidates/         ← em avaliação
├── rejected/           ← descartadas
├── docs/               ← documentação extra
└── tests/              ← testes de skill
```

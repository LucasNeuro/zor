# Backlog — Fases 6 a 9+ (pós 27/05/2026)

Roadmap separado da meta de maio, conforme seção 13.3 do documento mestre. Cada épico deve ter **owner**, **dependências** e critérios de aceite antes de entrar no sprint.

| Épico | Dependências principais | Owner sugerido |
|-------|-------------------------|----------------|
| **Fase 6 — WhatsApp operário** (check-in, pedido de material) | UAZAPI estável, modelo de dados de obra/equipe | Frente B (produto/fluxo) |
| **Fase 6 — Cotação automática** | Fornecedores Fase 3 estável, fila/jobs | Frente A (plataforma) + B |
| **Julho — Painel visual por obra** | Dados de obra normalizados, permissões | Frente B |
| **Julho — Workflow imóvel → obra** | CRM imóveis/obras, regras de negócio | Frente B |
| **Agosto — Setores financeiro / compras / projetos “completos”** | Multi-tenant + RLS maduros, aprovações | Frente A + B |
| **Agosto — Múltiplos escritórios** | `tenant_id`, hierarquia, faturamento | Frente A |
| **9+ — Pós-venda, app nativo** | APIs estáveis, auth unificada | Frente B |
| **9+ — Integrações bancárias / NFe / marketplace** | Compliance, filas, auditoria | Frente A |

## Regras de governança

- Não puxar épico desta lista para dentro do prazo 27/05 sem replanejamento explícito com o PO.
- Toda execução financeira ou contratual continua exigindo aprovação humana (documento mestre).

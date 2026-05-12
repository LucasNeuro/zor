# Diagnóstico — Fase 0 (saneamento)

Checklist alinhado ao documento mestre e ao plano de execução. Atualizar datas e responsáveis conforme o time.

## Git e deploy

- [ ] Repositório remoto privado, `main` protegida, sem secrets no histórico recente.
- [ ] Vercel ligado ao GitHub: deploy em `main`, ambiente de preview em PRs.
- [ ] Staging (projeto ou variáveis dedicadas) validado antes de promover produção.

## Segredos e integrações

- [ ] `ANTHROPIC_API_KEY` na Vercel (produção) e teste com lead real no WhatsApp.
- [ ] `CRON_SECRET` definido; crons da Vercel executam (header `x-vercel-cron` ou Bearer).
- [ ] Webhook Evolution: HMAC / segredo alinhado a `app/api/whatsapp/webhook/route.ts` e [`EVOLUTION_SETUP.md`](EVOLUTION_SETUP.md) (teste positivo e rejeição sem assinatura).
- [ ] `PORTAL_HMAC_SECRET` ou reutilização de `CRON_SECRET` para links do portal parceiro documentada no `README.md`.

## Automação e resiliência

- [ ] Workflow `.github/workflows/supabase-backup.yml` ativo com secret `DATABASE_URL`.
- [ ] Plano de notificação em falha de backup (e-mail/Slack) — opcional nesta fase.

## Dados e legado

- [ ] Migração `supabase/migrations/20260509120000_hub_ciclos_slugs_e_tenants.sql` aplicada ou agendada (slugs `diretor_geral_ia` / `diretor_operacoes`, tenant padrão `obra10`).
- [ ] Inventário das tabelas não `hub_*` em curso: uso no código, marcar `_legacy` ou migrar (sem `DROP` destrutivo).

## Decisões do PO (registrar quando fechadas)

1. Slug dos três ciclos do “Diretor” — padrão técnico atual: `diretor_operacoes` (tráfego), `diretor_geral_ia` (análises).
2. **Ariane vs diretora_marketing**: duplicidade de agente/persona — aguardando Wendel; não apagar registros até decisão (arquivar/`ativo=false` se necessário).
3. Planos Starter / Pro / Enterprise.
4. Logo / paleta / nome final do produto.
5. Permissões granulares (quem aprova o quê).
6. Política de comissão (%).
7. SLA máximo de resposta da IA.

## Saída da Fase 0

Checklist acima fechado ou com itens explicitamente postergados com owner e data; equipe alinhada para Fase 1 (IA operacional, ciclos, KPIs, mobile/APIs).

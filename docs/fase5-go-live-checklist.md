# Fase 5 — Polimento e go/no-go

Use antes de liberar parceiros e fornecedores reais.

## Validação funcional

- [ ] Jornada parceiro: cadastro/convite → homologação de módulos → painel restrito (`/parceiro/dashboard` com link assinado).
- [ ] Jornada fornecedor: protótipo de cotação (`/fornecedor/cotacao`) com roadmap de persistência acordado.
- [ ] WhatsApp: mensagem → lead → resposta IA em tempo aceitável (saída do motor `processarMensagem` em `@/lib/ia/engine`); validação HMAC / `WEBHOOK_SECRET` ativa em produção ([`UAZAPI_SETUP.md`](UAZAPI_SETUP.md)).
- [ ] Ciclos IA: `hub_ciclos_ia` com `total_execucoes` subindo nos jobs agendados (Vercel crons).
- [ ] KPIs: `hub_kpis_resultados` populados (cron horário `?acao=kpis` + metas em `hub_kpis_metas`).
- [ ] Aprovações: fluxo na Central (`/crm/aprovacoes`) sem mocks bloqueantes.

## Multi-tenant (piloto)

- [ ] Migração `hub_tenants` aplicada; segundo tenant de teste sem vazamento cruzado.
- [ ] Roteiro interno: `/crm/onboarding-tenant`.

## Operação

- [ ] Performance: revisão de rotas lentas e índices Supabase onde necessário.
- [ ] Logs: Vercel + Supabase; alertas mínimos acordados.
- [ ] Documentação de usuário final (parceiro/fornecedor/gestor).
- [ ] Termos de uso e privacidade (conteúdo jurídico com o PO).

## Rollback

- [ ] Procedimento documentado: reverter deploy Vercel para deployment estável anterior.
- [ ] Backup recente verificado (`supabase-backup` artifact ou equivalente).

## Decisão

Registrar **go** ou **no-go** com data, participantes e itens pendentes.

# Contexto de schema — Supabase (Obra10+ / Escritório Virtual)

**Gerado:** 2026-05-11  
**Projeto Supabase (ref):** `cdjlqsznerdhwqyunodl` (MCP Cursor: pode viver em `.cursor/mcp.json` na raiz do workspace, ex. pasta pai `vitual/`, ou na configuração global do Cursor)

Este ficheiro serve de **contexto para agentes e para ti**. Combina o que está **definido no repositório** com o inventário de tabelas que o **código** usa. **Não substitui** um `pg_dump` nem o estado live até ser atualizado via MCP ou SQL no dashboard.

---

## 1. Como testar a conexão MCP (Cursor)

1. Abre **Cursor Settings → Tools & MCP**.
2. Confirma o servidor **`supabase-obra10`** (URL com `project_ref=cdjlqsznerdhwqyunodl` e `read_only=true`).
3. Se estiver desligado, **autoriza OAuth** da Supabase no browser.
4. **Reinicia o Cursor** se os tools não aparecerem.
5. No chat (modo Agent), pede: *“Usa o MCP Supabase `list_tables` com `verbose: true` no schema `public`.”*
6. Se falhar, abre **Output → MCP Logs** e verifica erros de rede ou auth.

**Nota:** Em algumas sessões da ferramenta o servidor Supabase **não aparece** listado — nesse caso o passo 2–4 resolve no teu IDE, não no servidor remoto deste chat.

---

## 2. Atualizar este documento com o Postgres **real**

Quando o MCP estiver ligado, podes correr (read-only) no projeto ou colar no SQL Editor:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Para colunas (resumo):

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

Guarda o resultado ou pede ao agente para **regenerar esta secção** a partir de `list_tables` verbose.

---

## 3. Migrações versionadas em `supabase/migrations/`

Ficheiros aplicados pelo fluxo normal Supabase CLI / dashboard:

| Ficheiro | Conteúdo principal |
|---------|---------------------|
| `20260509120000_hub_ciclos_slugs_e_tenants.sql` | `hub_tenants`; `tenant_id` em `hub_leads_crm`, `hub_agente_identidade`, `hub_fila_mensagens`, `hub_parceiros`; updates `hub_ciclos_ia` / `hub_alertas` |
| `20260510130000_rls_tenant_pilot.sql` | RLS + `app_tenant_id()`, `default_obra10_tenant_id()` |
| `20260510140000_hub_cotacoes.sql` | `hub_cotacoes_pedidos`, `hub_cotacoes_respostas` |

---

## 4. Scripts de referência (`lib/supabase/*.sql`)

Definições **`CREATE TABLE`** explícitas no repo (além das migrações acima):

| Ficheiro | Tabelas |
|----------|---------|
| `hub_migration.sql` / `hub_migration_v2.sql` (base hub) | `hub_pessoas`, `hub_leads`, `hub_conversas`, `hub_mensagens`, `hub_agente_identidade`, `hub_agente_configuracao`, `hub_scripts`, `hub_regras_negocio`, `hub_memorias_lead`, `hub_prompt_logs`, `hub_fila_mensagens`, `hub_whatsapp_config`, `hub_ml_padroes` |
| `hub_migration_crm.sql` | `hub_leads_crm`, `hub_atividades`, `hub_notas`, `hub_servicos`, `hub_propostas`, `hub_agente_conhecimento`, `hub_memorias_lead` |
| `hub_migration_v3.sql` | `hub_aprovacoes`, `hub_arquivos`, `hub_conversas_log`, `hub_metricas_trafego`, `hub_personalidade`, `hub_briefings`, `hub_qualidade_agente` |
| `hub_migration_v4.sql` | `hub_kpis_definicao`, `hub_kpis_metas`, `hub_kpis_resultados`, `hub_responsabilidades`, `hub_ml_observacoes`, `hub_ml_sugestoes`, `hub_ml_historico`, `hub_acoes_ia` |
| `hub_migration_seguranca.sql` | Políticas + `hub_auditoria_seguranca` |
| `migrations.sql` | **Legado canvas:** `pessoas`, `campanhas`, `leads`, `negocios`, `oportunidades`, `parceiros`, `conversas`, `mensagens`, `agentes`, `decisoes`, `decision_logs` (nomes **sem** prefixo `hub_`) |

**Conflitos / duplicidade:** existem dois modelos (`hub_leads` vs `hub_leads_crm`, `hub_mensagens` vs `hub_fila_mensagens`, etc.). O código atual usa sobretudo **`hub_*`** nas rotas CRM/WhatsApp/IA; valida no teu projeto qual conjunto está populado.

---

## 5. Tabelas `hub_*` referenciadas no código (App + API + lib)

Lista única (2026-05-11), extraída de `.from("hub_…")` e joins Supabase no repositório:

`hub_acoes_ia`, `hub_agente_conhecimento`, `hub_agente_configuracao`, `hub_agente_identidade`, `hub_alertas`, `hub_aprovacoes`, `hub_arquivos`, `hub_atividades`, `hub_auditoria_seguranca`, `hub_cargos_catalogo`, `hub_ciclos_ia`, `hub_ciclos_log`, `hub_contatos_notificacao`, `hub_conversas`, `hub_conversas_log`, `hub_cotacoes_pedidos`, `hub_cotacoes_respostas`, `hub_decision_logs`, `hub_empresas`, `hub_encaminhamentos`, `hub_fila_mensagens`, `hub_fluxos`, `hub_followup_config`, `hub_hierarquia`, `hub_imoveis`, `hub_kpis_metas`, `hub_kpis_resultados`, `hub_leads`, `hub_leads_crm`, `hub_links_cadastro`, `hub_memorias_lead`, `hub_mensagens`, `hub_mercados`, `hub_metricas_trafego`, `hub_ml_historico`, `hub_ml_observacoes`, `hub_ml_padroes`, `hub_ml_sugestoes`, `hub_modulos_template`, `hub_negocios`, `hub_notas`, `hub_parceiros`, `hub_parceiros_captacao`, `hub_parceiros_documentos`, `hub_parceiros_homologacao`, `hub_parceiros_log`, `hub_parceiros_modulos`, `hub_parceiros_referencias`, `hub_perfis_personalidade`, `hub_pessoas`, `hub_personalidade`, `hub_profissionais`, `hub_prompt_logs`, `hub_regras_ia`, `hub_responsabilidades`, `hub_scripts`, `hub_servicos`, `hub_tenants` (só migração; não grep em TS necessariamente)

**Tabelas usadas no código mas sem `CREATE TABLE` encontrado neste repo** (provavelmente criadas noutro script ou só no projeto remoto):  
`hub_alertas`, `hub_ciclos_ia`, `hub_ciclos_log`, `hub_decision_logs`, `hub_empresas`, `hub_encaminhamentos`, `hub_fluxos`, `hub_followup_config`, `hub_hierarquia`, `hub_imoveis`, `hub_links_cadastro`, `hub_mercados`, `hub_modulos_template`, `hub_negocios`, `hub_parceiros` (+ satélites `hub_parceiros_*`), `hub_perfis_personalidade`, `hub_profissionais`, `hub_regras_ia`, `hub_contatos_notificacao`, … — confirma no **live DB** com `information_schema` ou MCP `list_tables`.

---

## 6. Funções / RLS úteis (piloto multi-tenant)

- `public.app_tenant_id()` — lê claim JWT `tenant_id`  
- `public.default_obra10_tenant_id()` — UUID fixo tenant legado `obra10`  
- Políticas em `hub_leads_crm`, `hub_parceiros`, `hub_agente_identidade`, `hub_fila_mensagens`, `hub_tenants` — ver `20260510130000_rls_tenant_pilot.sql`

---

## 7. Manutenção

- **Depois de cada migração aplicada no Supabase:** atualiza este ficheiro ou regenere a secção 5 com MCP/SQL.  
- **Segurança:** não commits de tokens; `project_ref` é identificador público do projeto, não é segredo.

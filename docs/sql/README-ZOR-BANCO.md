# Banco Zor — bootstrap manual (Supabase)

Sem Supabase CLI: executar no **SQL Editor** do projeto novo (`vrlwfikzeyuywjgunyhy` ou o teu ref).

## Ordem de execução

| # | Ficheiro | Notas |
|---|----------|--------|
| 0 | [`zor-00-prelude.sql`](./zor-00-prelude.sql) | Só se correres migrações à mão; **já está no início** de `zor-schema-completo.sql` |
| 1 | [`zor-schema-completo.sql`](./zor-schema-completo.sql) | ~200 KB — pode demorar; se der timeout, dividir por blocos `##########` no ficheiro |
| 2 | [`zor-01-gaps-ia-ciclos.sql`](./zor-01-gaps-ia-ciclos.sql) | Só se o passo 1 falhou antes dos gaps (ou correr de novo, é idempotente) |
| 3 | [`zor-02-seed-tenant-zor.sql`](./zor-02-seed-tenant-zor.sql) | Tenant **Zor** (se seed não correu no completo) |

**Erro `hub_atualizar_timestamp() does not exist`:** o `hub_migration_crm` criava triggers antes da função. O prelude no início do `zor-schema-completo.sql` corrige isso.

## Depois do SQL

1. **Dashboard → API → Reload schema** (ou aguardar ~1 min).
2. **Storage**: buckets criados pelas migrações (playbooks, RAG) — confirmar em Storage.
3. **`.env` / `.env.local`**:
   ```env
   DEFAULT_TENANT_ID=a1b2c3d4-e5f6-4789-a012-3456789abcde
   NEXT_PUBLIC_TENANT_ID=a1b2c3d4-e5f6-4789-a012-3456789abcde
   ```
4. **Utilizador**: Supabase Auth (email/senha) + linha em `public.users` com `auth_id`, `status = Ativo`, `role = owner` ou `admin`.
   - Ou: `npm run provision:user` (com env carregado).

## Verificar tabelas

```sql
SELECT count(*) AS hub_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'hub_%';
```

Esperado: dezenas de tabelas `hub_*` + `public.users`.

## Erros comuns

| Erro | Causa |
|------|--------|
| `relation hub_leads_crm does not exist` | Correr `zor-schema-completo` do início ou bloco `lib/supabase` primeiro |
| `type app_role does not exist` | Falta migração `20260522210000_public_users_app_access.sql` (está no completo) |
| `extension vector` | Ativar extensão **vector** no Supabase → Database → Extensions |
| Timeout no Editor | Executar por secções entre linhas `-- ##########` |

## O que **não** está neste pacote

- Dados legado Obra10 (`public.leads`, `deals`, `crm_*`)
- Seeds de demo (`supabase/scripts/dev_seed_*.sql`) — opcional em dev

## Regenerar o SQL completo (PowerShell)

```powershell
cd escritorio-virtual
# (ver script no histórico do repo ou pedir ao agente para regenerar)
```

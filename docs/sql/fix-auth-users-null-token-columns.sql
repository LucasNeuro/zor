-- Corrige login "Database error querying schema" / "converting NULL to string ... confirmation_token"
-- quando o utilizador foi criado por INSERT em auth.users sem estes campos (ficam NULL).
-- GoTrue espera string vazia, não NULL.
--
-- Opção A — só o teu email:
-- UPDATE auth.users SET ... WHERE lower(email) = lower('developadm@teste.com');
--
-- Opção B — todos os auth.users com algum token NULL (corre uma vez no projeto):

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, '')
WHERE confirmation_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR recovery_token IS NULL;

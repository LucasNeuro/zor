

UPDATE public.users
SET
  owner = true,
  role = 'platform_admin'::public.app_role,
  tenant_id = NULL,
  access_role_id = NULL
WHERE lower(trim(email)) = 'lucasoffgod@hotmail.com';

NOTIFY pgrst, 'reload schema';

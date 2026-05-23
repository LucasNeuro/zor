/**
 * Cria ou actualiza utilizador Supabase Auth + public.users (mesmo modelo que Lucas / owner).
 *
 * Uso (não commites a senha):
 *   $env:PROVISION_EMAIL="seu@email.com"
 *   $env:PROVISION_PASSWORD="sua-senha"
 *   $env:PROVISION_NAME="Ramon"
 *   $env:PROVISION_ROLE="owner"
 *   node scripts/provision-app-user.mjs
 *
 * Requer .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.PROVISION_EMAIL?.trim().toLowerCase();
const password = process.env.PROVISION_PASSWORD ?? "";
const name = process.env.PROVISION_NAME?.trim() || "Administrador";
const role = (process.env.PROVISION_ROLE?.trim() || "owner").toLowerCase();

if (!url || !serviceKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}
if (!email || password.length < 8) {
  console.error("Defina PROVISION_EMAIL e PROVISION_PASSWORD (mín. 8 caracteres) no ambiente.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === targetEmail);
    if (hit) return hit;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function main() {
  let authUser = await findAuthUserByEmail(email);

  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) {
      console.error("createUser:", error.message);
      process.exit(1);
    }
    authUser = data.user;
    console.log("Auth criado:", authUser.id, email);
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(authUser.user_metadata ?? {}), name },
    });
    if (error) {
      console.error("updateUser:", error.message);
      process.exit(1);
    }
    authUser = data.user;
    console.log("Auth actualizado (senha + perfil):", authUser.id, email);
  }

  const { data: row, error: upsertError } = await supabase
    .from("users")
    .upsert(
      {
        auth_id: authUser.id,
        email,
        name,
        role,
        status: "Ativo",
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "auth_id" }
    )
    .select("id, email, name, role, status")
    .single();

  if (upsertError) {
    console.error("public.users:", upsertError.message);
    process.exit(1);
  }

  console.log("public.users OK:", row);
  console.log("\nLogin em /login com:", email);
  console.log("Papel:", row.role, "(owner = acesso total CRM, como Lucas)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

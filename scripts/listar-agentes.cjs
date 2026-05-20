if (!process.env.STRICT_TLS) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const root = path.join(__dirname, "..");
function parseEnvFile(fp) {
  const o = {};
  if (!fs.existsSync(fp)) return o;
  for (const line of fs.readFileSync(fp, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    o[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return o;
}
const env = { ...parseEnvFile(path.join(root, ".env")), ...parseEnvFile(path.join(root, ".env.local")) };
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await sb
    .from("hub_agente_identidade")
    .select("agente_slug,nome,cargo,ativo,modo_operacao,motor_ferramentas_habilitado,uazapi_instance_token")
    .order("agente_slug");
  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
})();

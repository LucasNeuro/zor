/**
 * Status recente da fila hub_msg_jobs e agentes WhatsApp.
 * Uso: npm run check:jobs
 */
if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

const env = {
  ...parseEnvFile(path.join(__dirname, "..", ".env")),
  ...parseEnvFile(path.join(__dirname, "..", ".env.local")),
};

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: jobs, error: jobsErr } = await sb
    .from("hub_msg_jobs")
    .select("id,status,attempts,last_error,agente_slug,telefone,message_id,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (jobsErr) {
    console.error("hub_msg_jobs ERR:", jobsErr.message);
    process.exit(1);
  }

  const counts = {};
  for (const j of jobs || []) {
    counts[j.status] = (counts[j.status] || 0) + 1;
  }

  console.log("=== hub_msg_jobs (recent) ===");
  console.log("counts:", counts);
  for (const j of jobs || []) {
    console.log(
      `${j.status.padEnd(10)} | ${j.agente_slug || "—"} | ${j.telefone} | attempts=${j.attempts} | ${j.message_id?.slice(0, 24) || "—"} | ${j.last_error || ""}`
    );
  }

  const { data: agentes } = await sb
    .from("hub_agente_identidade")
    .select("agente_slug,uazapi_connection_status,modo_operacao,uazapi_instance_id,uazapi_instance_name,ativo")
    .in("agente_slug", ["maria", "mario"]);

  console.log("\n=== agentes WA ===");
  for (const a of agentes || []) {
    console.log(
      `${a.agente_slug}: ${a.uazapi_connection_status} | ${a.uazapi_instance_name} | id=${a.uazapi_instance_id}`
    );
  }

  const pending = (jobs || []).filter((j) => j.status === "pending").length;
  if (pending > 0) {
    console.log(`\n[!!] ${pending} job(s) pending — confira se whatsapp-job-worker está rodando no Render.`);
  }
})();

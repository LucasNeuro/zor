const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseEnvFile(filePath) {
  const o = {};
  if (!fs.existsSync(filePath)) return o;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    o[k] = v;
  }
  return o;
}

const root = path.join(__dirname, "..");
const env = { ...parseEnvFile(path.join(root, ".env")), ...parseEnvFile(path.join(root, ".env.local")) };
const app = (env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
const wh = (env.WEBHOOK_SECRET || "").trim();

async function main() {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await sb
    .from("hub_agente_identidade")
    .select("uazapi_instance_id,uazapi_instance_token")
    .eq("agente_slug", "maria")
    .single();
  const id = data.uazapi_instance_id;
  const tok = data.uazapi_instance_token;
  const url = `${app}/api/whatsapp/webhook?wh=${encodeURIComponent(wh)}`;
  const base = {
    EventType: "messages",
    chatid: "5511999990000@s.whatsapp.net",
    sender: "5511999990000@s.whatsapp.net",
    messageid: `t${Date.now()}`,
    messageTimestamp: Date.now(),
    messageType: "conversation",
    text: "teste resolver render",
  };

  async function post(label, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    console.log(label, "→", r.status, JSON.stringify(j));
  }

  await post("sem id sem token", base);
  await post("só token", { ...base, token: tok });
  await post("só instance id", { ...base, instance: id });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

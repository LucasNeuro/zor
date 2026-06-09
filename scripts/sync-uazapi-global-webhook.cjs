/**
 * Sincroniza webhook GLOBAL UAZAPI → Render (POST /globalwebhook).
 * Uso: npm run sync:uazapi-webhook
 *
 * Requer no .env ou Render Environment:
 *   UAZAPI_BASE_URL, UAZAPI_ADMIN_TOKEN, NEXT_PUBLIC_APP_URL, WEBHOOK_SECRET
 */
if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const fs = require("fs");
const path = require("path");

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

function loadEnv(root) {
  return {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
    ...process.env,
  };
}

function uazapiBase(env) {
  let b = (env.UAZAPI_BASE_URL || "").trim().replace(/\/+$/, "");
  b = b.replace(/\/api\/?$/, "");
  return b || null;
}

function buildWebhookUrl(origin, secret) {
  const base = `${origin.replace(/\/+$/, "")}/api/whatsapp/webhook`;
  const s = secret?.trim();
  if (!s) return base;
  return `${base}?wh=${encodeURIComponent(s)}`;
}

async function main() {
  const root = path.join(__dirname, "..");
  const env = loadEnv(root);
  const base = uazapiBase(env);
  const admin = env.UAZAPI_ADMIN_TOKEN?.trim();
  const origin = (env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  const wh = env.WEBHOOK_SECRET?.trim();

  if (!base || !admin) {
    console.error("[sync] Defina UAZAPI_BASE_URL e UAZAPI_ADMIN_TOKEN");
    process.exit(1);
  }
  if (!origin) {
    console.error("[sync] Defina NEXT_PUBLIC_APP_URL (ex. https://seu-app.onrender.com)");
    process.exit(1);
  }

  const url = buildWebhookUrl(origin, wh);
  const body = {
    enabled: true,
    url,
    events: ["messages", "connection"],
    excludeMessages: ["wasSentByApi"],
    addUrlEvents: false,
    addUrlTypesMessages: false,
  };

  console.log("[sync] UAZAPI base:", base);
  console.log("[sync] Webhook URL:", url.replace(wh || "", wh ? wh.slice(0, 4) + "…" : ""));

  const res = await fetch(`${base}/globalwebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      admintoken: admin,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 500);
  }

  if (!res.ok) {
    console.error("[sync] Falhou HTTP", res.status, data);
    process.exit(1);
  }

  console.log("[sync] OK — webhook global atualizado");
  console.log(JSON.stringify(data, null, 2).slice(0, 600));
}

main().catch((e) => {
  console.error("[sync] Erro:", e.message || e);
  process.exit(1);
});

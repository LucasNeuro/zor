/**
 * Normaliza modelos → mistral e chama POST /api/hub/agentes/mistral-sync-all
 * Uso: npm run sync:mistral-all
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
  };
}

async function main() {
  const root = path.join(__dirname, "..");
  const env = loadEnv(root);
  const base = (env.NEXT_PUBLIC_APP_URL || "http://localhost:3001").replace(/\/+$/, "");
  const token = env.CRON_SECRET?.trim() || env.INTERNAL_API_KEY?.trim();

  if (!token) {
    console.error("[sync:mistral-all] Defina CRON_SECRET ou INTERNAL_API_KEY no .env");
    process.exit(1);
  }

  const url = `${base}/api/hub/agentes/mistral-sync-all`;
  console.log(`\n→ POST ${url}\n`);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("[sync:mistral-all] falhou:", body.error || res.status);
    process.exit(1);
  }

  console.log("Modelos normalizados:", body.modelos_normalizados);
  console.log(`Sync: ${body.sucesso}/${body.total} ok, ${body.falhas} falhas\n`);

  for (const r of body.resultados || []) {
    const mark = r.ok ? "✓" : "✗";
    console.log(`${mark} ${r.agente_slug}${r.ok ? ` → ${r.mistral_agent_id}` : ` — ${r.error}`}`);
  }
  console.log("");
  if (body.falhas > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("[sync:mistral-all] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});

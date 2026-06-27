/**
 * Testa ligação ao Redis Database (TLS e plain).
 * Uso: node scripts/test-redis-connection.cjs
 * Lê .env na raiz do projeto (não imprime password).
 */
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    process.env[t.slice(0, eq)] = t.slice(eq + 1).replace(/\r/g, "").trim();
  }
}

const host = (process.env.REDIS_HOST || "").trim();
const port = Number.parseInt(process.env.REDIS_PORT || "6379", 10);
const user = (process.env.REDIS_USERNAME || "").trim();
const pass = (process.env.REDIS_PASSWORD || "").trim();

if (!host) {
  console.error("REDIS_HOST ausente no .env");
  process.exit(1);
}

if (/memory\.redis\.io/i.test(host)) {
  console.error(
    "ERRO: REDIS_HOST parece Agent Memory (HTTP). Use o host TCP do Redis Database no painel Redis Cloud."
  );
  process.exit(1);
}

let Redis;
try {
  Redis = require("ioredis");
} catch {
  console.error("ioredis não instalado — execute npm install");
  process.exit(1);
}

async function test(label, useTls) {
  const client = new Redis({
    host,
    port,
    username: user || undefined,
    password: pass || undefined,
    ...(useTls ? { tls: { servername: host } } : {}),
    lazyConnect: true,
    connectTimeout: 12_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    console.log(`${label}: OK (${pong})`);
    await client.quit();
    return true;
  } catch (e) {
    console.log(`${label}: FALHOU — ${(e.message || e).slice(0, 160)}`);
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
    return false;
  }
}

(async () => {
  console.log(`Host: ${host}:${port}  User: ${user || "(vazio)"}`);
  const tlsOk = await test("TLS (servername)", true);
  const plainOk = await test("Plain (sem TLS)", false);
  if (!tlsOk && !plainOk) {
    console.log("\nNenhum modo funcionou. Verifique host, porta e password no painel Redis Cloud.");
    process.exit(1);
  }
  if (tlsOk) console.log("\nRecomendado no Render: REDIS_TLS=true (ou omitir — auto para *.redislabs.com)");
  else if (plainOk) console.log("\nRecomendado no Render: REDIS_TLS=false");
})();

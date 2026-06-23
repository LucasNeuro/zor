#!/usr/bin/env node
/**
 * Testa variáveis Google OAuth para agentes (Gmail + Calendar). Redis é opcional (--redis).
 *
 * Uso:
 *   node scripts/test-integracoes-env.cjs
 *   npm run test:integracoes
 *   npm run test:integracoes -- --redis   # opcional; não relacionado a Gmail/Calendar
 *
 * Lê .env na raiz. Não grava tokens nem altera o banco.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function applyEnv(vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (process.env[k] == null || process.env[k] === "") {
      process.env[k] = v;
    }
  }
}

const fromFile = parseEnvFile(envPath);
applyEnv(fromFile);

const args = process.argv.slice(2);
const withRedis = args.includes("--redis");

const results = [];

function ok(name, detail) {
  results.push({ name, status: "ok", detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function warn(name, detail) {
  results.push({ name, status: "warn", detail });
  console.log(`  ⚠ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, status: "fail", detail });
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function maskSecret(s, visible = 4) {
  if (!s || s.length < visible * 2) return "(ausente)";
  return `${s.slice(0, visible)}…${s.slice(-visible)} (${s.length} chars)`;
}

function encryptionKeyBuffer() {
  const raw = (process.env.HUB_CREDENTIALS_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const buf = Buffer.from(raw, "base64");
  if (buf.length === 32) return buf;
  return null;
}

function testEncryptionKey() {
  console.log("\n── Chave de encriptação (HUB_CREDENTIALS_ENCRYPTION_KEY) ──");
  const key = encryptionKeyBuffer();
  if (!key) {
    fail("HUB_CREDENTIALS_ENCRYPTION_KEY", "ausente ou inválida (precisa 32 bytes em hex 64 chars ou base64)");
    return;
  }
  ok("HUB_CREDENTIALS_ENCRYPTION_KEY", "formato válido (32 bytes)");

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plain = "teste-oauth-token-waje";
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    if (dec === plain) ok("AES-256-GCM roundtrip", "encrypt/decrypt OK");
    else fail("AES-256-GCM roundtrip", "texto diferente após decrypt");
  } catch (e) {
    fail("AES-256-GCM roundtrip", e.message);
  }
}

function testGoogleOAuthConfig() {
  console.log("\n── Google OAuth (Gmail + Calendar) ──");
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  const redirect =
    (process.env.GOOGLE_OAUTH_REDIRECT_URI || "").trim() ||
    `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/hub/email/oauth/google/callback`;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();

  if (!clientId) {
    fail("GOOGLE_OAUTH_CLIENT_ID", "ausente");
  } else if (!clientId.endsWith(".apps.googleusercontent.com")) {
    warn("GOOGLE_OAUTH_CLIENT_ID", `formato incomum: ${maskSecret(clientId, 8)}`);
  } else {
    ok("GOOGLE_OAUTH_CLIENT_ID", maskSecret(clientId, 10));
  }

  if (!clientSecret) {
    fail("GOOGLE_OAUTH_CLIENT_SECRET", "ausente");
  } else if (!clientSecret.startsWith("GOCSPX-")) {
    warn("GOOGLE_OAUTH_CLIENT_SECRET", maskSecret(clientSecret));
  } else {
    ok("GOOGLE_OAUTH_CLIENT_SECRET", maskSecret(clientSecret));
  }

  ok("GOOGLE_OAUTH_REDIRECT_URI (efetivo)", redirect);
  if (appUrl) ok("NEXT_PUBLIC_APP_URL", appUrl);
  else warn("NEXT_PUBLIC_APP_URL", "ausente — redirect local usa localhost:3000");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state: "test",
  });
  const authorizePreview = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString().slice(0, 80)}…`;
  ok("URL de autorização", "montável");
  console.log(`    ${authorizePreview}`);
}

async function testGoogleClientCredentials() {
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    warn("Google token endpoint", "pulado — faltam CLIENT_ID ou CLIENT_SECRET");
    return;
  }

  console.log("\n── Validação CLIENT_ID + SECRET (Google token endpoint) ──");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: "invalid_refresh_token_for_smoke_test",
  });

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = await res.json().catch(() => ({}));
    const err = typeof json.error === "string" ? json.error : "";

    if (err === "invalid_client") {
      fail("Credenciais Google", "invalid_client — ID ou SECRET errados no .env");
    } else if (err === "invalid_grant" || err === "unauthorized_client") {
      ok(
        "Credenciais Google",
        `Google aceitou o par CLIENT_ID/SECRET (${err} esperado com refresh fake)`
      );
    } else {
      warn("Credenciais Google", `resposta inesperada HTTP ${res.status}: ${JSON.stringify(json).slice(0, 120)}`);
    }
  } catch (e) {
    fail("Google token endpoint", e.message);
  }
}

async function testRedis() {
  console.log("\n── Redis (cache / dedupe) ──");
  const host = (process.env.REDIS_HOST || "").trim();
  if (!host) {
    warn("REDIS_HOST", "ausente — app usa cache em memória (OK em dev)");
    return;
  }

  const port = Number.parseInt(process.env.REDIS_PORT || "6379", 10);
  const username = (process.env.REDIS_USERNAME || "").trim() || undefined;
  const password = (process.env.REDIS_PASSWORD || "").trim() || undefined;
  const useTls =
    process.env.REDIS_TLS === "1" ||
    process.env.REDIS_TLS === "true" ||
    host.includes("redislabs.com") ||
    host.includes("redis-cloud.com");

  ok("REDIS_HOST", `${host}:${port}${useTls ? " (TLS)" : ""}`);

  let Redis;
  try {
    Redis = require("ioredis");
  } catch {
    fail("ioredis", "pacote não instalado — npm install");
    return;
  }

  const client = new Redis({
    host,
    port: Number.isFinite(port) ? port : 6379,
    username,
    password,
    ...(useTls ? { tls: {} } : {}),
    maxRetriesPerRequest: 1,
    connectTimeout: 10000,
    lazyConnect: true,
  });

  try {
    await client.connect();
    const pong = await client.ping();
    if (pong === "PONG") ok("Redis PING", "PONG");
    else warn("Redis PING", String(pong));

    const testKey = `${(process.env.REDIS_KEY_PREFIX || "waje:").trim()}test:smoke:${Date.now()}`;
    await client.set(testKey, "1", "EX", 30);
    const val = await client.get(testKey);
    if (val === "1") ok("Redis SET/GET", testKey);
    else fail("Redis SET/GET", "valor não persistiu");
    await client.del(testKey);
  } catch (e) {
    fail("Redis conexão", e.message);
    if (/WRONGPASS/i.test(e.message)) {
      console.log("    → Corrija REDIS_USERNAME (default) e REDIS_PASSWORD no .env / Render");
    }
    if (useTls === false && host.includes("redislabs")) {
      console.log("    → Redis Cloud costuma exigir TLS — defina REDIS_TLS=true");
    }
  } finally {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  console.log("Teste Google OAuth para agentes (.env)");
  console.log(`Ficheiro: ${fs.existsSync(envPath) ? envPath : "(não encontrado — só process.env)"}`);

  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    const lineCount = raw.split(/\r?\n/).length;
    const hasGoogle = /^GOOGLE_OAUTH_CLIENT_ID=/m.test(raw);
    const hasRedis = /^REDIS_HOST=/m.test(raw);
    const hasEnc = /^HUB_CREDENTIALS_ENCRYPTION_KEY=/m.test(raw);
    if (!hasGoogle || !hasEnc) {
      console.log(
        "\n  ℹ Se acabou de colar variáveis no editor, salve o .env (Ctrl+S) antes de rodar este script."
      );
      console.log(
        `     No disco: ${lineCount} linhas | GOOGLE_OAUTH=${hasGoogle ? "sim" : "não"} | ENCRYPTION_KEY=${hasEnc ? "sim" : "não"} | REDIS=${hasRedis ? "sim" : "não"}`
      );
    }
  }

  testEncryptionKey();
  testGoogleOAuthConfig();
  await testGoogleClientCredentials();
  if (withRedis) {
    await testRedis();
  } else {
    console.log("\n── Redis ──");
    console.log("  (ignorado — não é necessário para Gmail/Calendar; use --redis se quiser testar cache)");
  }

  const fails = results.filter((r) => r.status === "fail").length;
  const warns = results.filter((r) => r.status === "warn").length;

  console.log("\n── Resumo ──");
  console.log(`  OK: ${results.filter((r) => r.status === "ok").length}  |  Avisos: ${warns}  |  Falhas: ${fails}`);

  if (fails === 0) {
    console.log("\nPróximo passo: ligue a conta Google e ative ferramentas no agente (Gmail + Calendar).");
    console.log("  npm run test:gmail -- --api   (depois do OAuth no painel)\n");
    process.exit(warns > 0 ? 0 : 0);
  } else {
    console.log("\nCorrija as falhas acima antes de testar OAuth no painel.\n");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

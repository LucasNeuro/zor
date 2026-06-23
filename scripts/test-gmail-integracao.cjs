#!/usr/bin/env node
/**
 * Testa Google Workspace para agentes: Gmail (enviar e-mail) + Calendar (agendar reuniões).
 *
 * Uso:
 *   npm run test:gmail              # .env + credenciais Google
 *   npm run test:gmail:api         # recomendado no Windows (token + APIs)
 *   npm run test:gmail -- --api     # Linux/macOS
 *   npm run test:gmail -- --api --send-to=voce@email.com
 *
 * Redis não é necessário para esta integração.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

const args = process.argv.slice(2);
const withApi = args.includes("--api");
const sendToArg = args.find((a) => a.startsWith("--send-to="));
const sendTo = sendToArg ? sendToArg.split("=")[1]?.trim() : "";
const tenantArg = args.find((a) => a.startsWith("--tenant-id="));
const tenantIdOverride = tenantArg ? tenantArg.split("=")[1]?.trim() : "";

const results = [];

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
    if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
  }
}

applyEnv(parseEnvFile(envPath));
applyEnv(parseEnvFile(path.join(root, ".env.local")));

function envDiagnostics() {
  if (!fs.existsSync(envPath)) return null;
  const raw = fs.readFileSync(envPath, "utf8");
  const lineCount = raw.split(/\r?\n/).length;
  const keys = [
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "HUB_CREDENTIALS_ENCRYPTION_KEY",
  ];
  const found = Object.fromEntries(keys.map((k) => [k, new RegExp(`^${k}=`, "m").test(raw)]));
  return { lineCount, found };
}

function printEnvHint() {
  const diag = envDiagnostics();
  if (!diag) return;
  const missing = Object.entries(diag.found).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length === 0) return;
  console.log("\n  ✗ Variáveis ausentes no .env gravado em disco:");
  for (const k of missing) console.log(`      - ${k}`);
  console.log(`     Ficheiro tem ${diag.lineCount} linhas no disco.`);
  console.log("     → Salve o .env no editor (Ctrl+S) ou cole o bloco Google OAuth no final do arquivo.");
}

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
  return `${s.slice(0, visible)}…${s.slice(-visible)}`;
}

function encryptionKeyBuffer() {
  const raw = (process.env.HUB_CREDENTIALS_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const buf = Buffer.from(raw, "base64");
  if (buf.length === 32) return buf;
  return null;
}

function decryptCredentialCiphertext(payload) {
  const key = encryptionKeyBuffer();
  if (!key) throw new Error("HUB_CREDENTIALS_ENCRYPTION_KEY inválida");
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("credencial encriptada inválida");
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function readStoredGoogleOAuth(credenciais) {
  if (!credenciais || typeof credenciais !== "object") return null;
  const o = credenciais;
  if (o._enc === true) {
    const accessEnc = typeof o.access_token === "string" ? o.access_token : "";
    if (!accessEnc) return null;
    const refreshEnc = typeof o.refresh_token === "string" ? o.refresh_token : undefined;
    return {
      accessToken: decryptCredentialCiphertext(accessEnc),
      refreshToken: refreshEnc ? decryptCredentialCiphertext(refreshEnc) : undefined,
      expiresAt: typeof o.expires_at === "number" ? o.expires_at : 0,
      email: typeof o.email === "string" ? o.email : undefined,
    };
  }
  const legacy = typeof o.bearer_token === "string" ? o.bearer_token.trim() : "";
  if (legacy) return { accessToken: legacy, expiresAt: Date.now() + 3600_000 };
  return null;
}

function effectiveRedirectUri() {
  const explicit = (process.env.GOOGLE_OAUTH_REDIRECT_URI || "").trim();
  if (explicit) return explicit;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001").replace(/\/$/, "");
  return `${base}/api/hub/email/oauth/google/callback`;
}

function testEncryptionKey() {
  console.log("\n── Chave de encriptação ──");
  const key = encryptionKeyBuffer();
  if (!key) {
    fail("HUB_CREDENTIALS_ENCRYPTION_KEY", "ausente ou inválida (32 bytes hex 64 chars)");
    return false;
  }
  ok("HUB_CREDENTIALS_ENCRYPTION_KEY", "OK");
  return true;
}

function testGmailOAuthConfig() {
  console.log("\n── Google OAuth (Gmail + Calendar para agentes) ──");
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  const redirect = effectiveRedirectUri();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();

  let okAll = true;
  if (!clientId) {
    fail("GOOGLE_OAUTH_CLIENT_ID", "ausente");
    okAll = false;
  } else {
    ok("GOOGLE_OAUTH_CLIENT_ID", maskSecret(clientId, 10));
  }

  if (!clientSecret) {
    fail("GOOGLE_OAUTH_CLIENT_SECRET", "ausente");
    okAll = false;
  } else {
    ok("GOOGLE_OAUTH_CLIENT_SECRET", maskSecret(clientSecret));
  }

  ok("GOOGLE_OAUTH_REDIRECT_URI", redirect);
  if (appUrl) ok("NEXT_PUBLIC_APP_URL", appUrl);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: "smoke",
  });
  ok("Scopes OAuth", "gmail.send, gmail.readonly, calendar, calendar.events");
  console.log(`    Auth preview: https://accounts.google.com/o/oauth2/v2/auth?${params.toString().slice(0, 72)}…`);

  return okAll;
}

async function testGoogleClientCredentials() {
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return;

  console.log("\n── Validação CLIENT_ID + SECRET ──");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: "invalid_refresh_token_smoke",
  });

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = await res.json().catch(() => ({}));
    const err = typeof json.error === "string" ? json.error : "";
    if (err === "invalid_client") fail("Par OAuth Google", "invalid_client — revise ID/SECRET no .env");
    else if (err === "invalid_grant" || err === "unauthorized_client")
      ok("Par OAuth Google", "aceito pelo Google");
    else warn("Par OAuth Google", `HTTP ${res.status}: ${JSON.stringify(json).slice(0, 100)}`);
  } catch (e) {
    fail("Google token endpoint", e.message);
  }
}

async function refreshAccessToken(refreshToken) {
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `refresh HTTP ${res.status}`);
  }
  return String(json.access_token);
}

async function gmailApiGet(accessToken, url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function loadIntegracaoOAuth(supabase, tenantId, integracaoCatalogId) {
  const { data: integracao, error: intErr } = await supabase
    .from("hub_integracoes")
    .select("id, nome, status, ativo, config")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", integracaoCatalogId)
    .maybeSingle();

  if (intErr) return { error: intErr.message };
  if (!integracao?.id) return { integracao: null };

  const { data: credRow, error: credErr } = await supabase
    .from("hub_integracao_credenciais")
    .select("id, tipo_auth, credenciais")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", integracao.id)
    .maybeSingle();

  if (credErr) return { error: credErr.message };
  return { integracao, credRow };
}

async function resolveAccessToken(credRow) {
  let stored;
  try {
    stored = readStoredGoogleOAuth(credRow?.credenciais);
  } catch (e) {
    return { error: e.message };
  }
  if (!stored?.accessToken) return { error: "access_token ausente" };

  let accessToken = stored.accessToken;
  const expired = stored.expiresAt > 0 && stored.expiresAt <= Date.now();
  if (expired && stored.refreshToken) {
    try {
      accessToken = await refreshAccessToken(stored.refreshToken);
      return { accessToken, stored, refreshed: true };
    } catch (e) {
      return { error: e.message };
    }
  }
  if (expired) return { error: "token expirado sem refresh_token" };
  return { accessToken, stored, refreshed: false };
}

async function testStoredGoogleAgentIntegrations() {
  console.log("\n── Integrações no Supabase (Gmail + Calendar) ──");

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const tenantId =
    tenantIdOverride ||
    (process.env.DEFAULT_TENANT_ID || "").trim() ||
    (process.env.NEXT_PUBLIC_TENANT_ID || "").trim();

  if (!supabaseUrl || !serviceKey) {
    warn("Supabase", "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente — pulando --api");
    return;
  }
  if (!tenantId) {
    warn("Tenant", "DEFAULT_TENANT_ID ausente — use --tenant-id=uuid com --api");
    return;
  }

  ok("Tenant ID", tenantId);

  let createClient;
  try {
    createClient = require("@supabase/supabase-js").createClient;
  } catch {
    fail("Supabase SDK", "@supabase/supabase-js não instalado");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const gmailLoad = await loadIntegracaoOAuth(supabase, tenantId, "gmail");
  const calLoad = await loadIntegracaoOAuth(supabase, tenantId, "google_calendar");

  if (gmailLoad.error) fail("hub_integracoes (gmail)", gmailLoad.error);
  if (calLoad.error) fail("hub_integracoes (calendar)", calLoad.error);

  if (!gmailLoad.integracao?.id) {
    warn(
      "Gmail",
      "não ligado — Ferramentas → Integrações → «Ligar conta Google» (uma autorização liga Gmail + Calendar)"
    );
  } else {
    ok("hub_integracoes (gmail)", `id=${gmailLoad.integracao.id}`);
    const cfgEmail =
      gmailLoad.integracao.config && typeof gmailLoad.integracao.config === "object"
        ? gmailLoad.integracao.config.oauth_email
        : null;
    if (typeof cfgEmail === "string" && cfgEmail) ok("Conta Google", cfgEmail);
  }

  if (!calLoad.integracao?.id) {
    warn("Google Calendar", "não ligado — mesmo fluxo OAuth do Gmail");
  } else {
    ok("hub_integracoes (google_calendar)", `id=${calLoad.integracao.id}`);
  }

  const credRow = gmailLoad.credRow || calLoad.credRow;
  if (!credRow?.credenciais) {
    if (gmailLoad.integracao?.id || calLoad.integracao?.id) {
      fail("Credenciais OAuth", "integração existe mas sem token — refaça «Ligar conta Google»");
    }
    return;
  }

  ok("Credenciais", `tipo_auth=${credRow.tipo_auth || "oauth2"}`);

  const tokenResult = await resolveAccessToken(credRow);
  if (tokenResult.error) {
    fail("Token OAuth", tokenResult.error);
    return;
  }
  if (tokenResult.refreshed) ok("Refresh token", "access_token renovado");
  else ok("Access token", tokenResult.stored.email ? `válido (${tokenResult.stored.email})` : "válido");

  const accessToken = tokenResult.accessToken;
  const stored = tokenResult.stored;

  console.log("\n── Gmail API (agentes: hub_int_gmail_enviar) ──");

  const profile = await gmailApiGet(
    accessToken,
    "https://gmail.googleapis.com/gmail/v1/users/me/profile"
  );
  if (profile.ok) {
    const email = profile.body.emailAddress || stored.email || "?";
    const total = profile.body.messagesTotal ?? "?";
    ok("Gmail profile", `${email} — ${total} mensagens na caixa`);
  } else {
    fail("Gmail profile", `HTTP ${profile.status}: ${JSON.stringify(profile.body).slice(0, 160)}`);
    return;
  }

  const userinfo = await gmailApiGet(accessToken, "https://www.googleapis.com/oauth2/v2/userinfo");
  if (userinfo.ok && userinfo.body.email) {
    ok("Google userinfo", userinfo.body.email);
  } else {
    warn("Google userinfo", `HTTP ${userinfo.status}`);
  }

  console.log("\n── Google Calendar API (agentes: hub_int_gcal_criar_evento / listar_eventos) ──");
  const min = new Date().toISOString();
  const max = new Date(Date.now() + 7 * 86400000).toISOString();
  const calUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}&singleEvents=true&orderBy=startTime&maxResults=5`;
  const calList = await gmailApiGet(accessToken, calUrl);
  if (calList.ok) {
    const items = Array.isArray(calList.body.items) ? calList.body.items : [];
    ok("Calendar listar eventos", `${items.length} evento(s) nos próximos 7 dias`);
    for (const ev of items.slice(0, 3)) {
      const title = ev.summary || "(sem título)";
      const start = ev.start?.dateTime || ev.start?.date || "?";
      console.log(`      · ${title} — ${start}`);
    }
  } else {
    fail(
      "Calendar API",
      `HTTP ${calList.status} — verifique scope calendar no OAuth. ${JSON.stringify(calList.body).slice(0, 120)}`
    );
  }

  if (sendTo) {
    console.log("\n── Envio de teste ──");
    const fromEmail = stored.email || profile.body.emailAddress;
    if (!fromEmail) {
      fail("Envio teste", "sem e-mail remetente");
      return;
    }
    const subject = `[Waje] Teste Gmail ${new Date().toISOString()}`;
    const text = "E-mail de teste automático do script test-gmail-integracao.cjs";
    const raw = Buffer.from(
      [
        `From: ${fromEmail}`,
        `To: ${sendTo}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=utf-8",
        `Subject: ${subject}`,
        "",
        text,
      ].join("\r\n"),
      "utf8"
    ).toString("base64url");

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const sendBody = await sendRes.json().catch(() => ({}));
    if (sendRes.ok) {
      ok("Gmail send", `enviado para ${sendTo} (id=${sendBody.id || "?"})`);
    } else {
      fail("Gmail send", `HTTP ${sendRes.status}: ${JSON.stringify(sendBody).slice(0, 200)}`);
    }
  }
}

function printNextSteps() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001").replace(/\/$/, "");
  console.log("\n── Próximos passos (agentes + Gmail + reuniões) ──");
  console.log("  1. Ligue a conta Google (uma vez — ativa Gmail + Calendar):");
  console.log(`     ${appUrl}/api/hub/integradores/oauth/google/start`);
  console.log("     ou Ferramentas → Integrações → «Ligar conta Google»");
  console.log("  2. No agente (ex.: Ana), ative as ferramentas:");
  console.log("     · Enviar e-mail (hub_int_gmail_enviar)");
  console.log("     · Criar evento no Calendar (hub_int_gcal_criar_evento)");
  console.log("     · Listar eventos (hub_int_gcal_listar_eventos)");
  console.log("  3. Valide token + APIs:");
  console.log("     npm run test:gmail:api");
  if (!sendTo) {
    console.log("  4. E-mail de teste (opcional):");
    console.log("     npm run test:gmail:api -- --send-to=seu@email.com");
  }
  console.log("\n  GCP em modo Teste: e-mail em Usuários de teste.\n");
}

async function main() {
  console.log("Teste Google para agentes (Gmail + Calendar / reuniões)");
  console.log(`Modo: ${withApi ? "config + Supabase + Gmail + Calendar API" : "somente config (.env)"}`);
  console.log(`Ficheiro: ${fs.existsSync(envPath) ? envPath : "(process.env)"}`);

  if (fs.existsSync(envPath)) {
    printEnvHint();
  }

  testEncryptionKey();
  testGmailOAuthConfig();
  await testGoogleClientCredentials();

  if (withApi) {
    await testStoredGoogleAgentIntegrations();
  } else {
    console.log("\n  ℹ Use --api para testar token salvo + Gmail API + Calendar API.");
  }

  const fails = results.filter((r) => r.status === "fail").length;
  const warns = results.filter((r) => r.status === "warn").length;

  console.log("\n── Resumo ──");
  console.log(`  OK: ${results.filter((r) => r.status === "ok").length}  |  Avisos: ${warns}  |  Falhas: ${fails}`);

  if (fails === 0) printNextSteps();
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

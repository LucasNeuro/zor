#!/usr/bin/env node
/**
 * Teste local: token Cora + emissão de boleto (Integração Direta).
 *
 * Uso:
 *   node scripts/test-cora-boleto.cjs
 *   node scripts/test-cora-boleto.cjs --token-only
 *   node scripts/test-cora-boleto.cjs --pagador-cnpj=65912793000160
 *
 * Lê .env na raiz do projeto (mesmas vars do Render).
 * Windows: usa NODE_TLS_REJECT_UNAUTHORIZED=0 como npm run dev.
 */
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");
const { randomUUID } = crypto;

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("[test-cora-boleto] NODE_TLS_REJECT_UNAUTHORIZED=0 (Windows/proxy)\n");
}

const BASE = {
  production: {
    token: "https://matls-clients.api.cora.com.br/token",
    api: "https://matls-clients.api.cora.com.br",
  },
  stage: {
    token: "https://matls-clients.api.stage.cora.com.br/token",
    api: "https://matls-clients.api.stage.cora.com.br",
  },
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
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
    val = val.replace(/\\n/g, "\n");
    out[key] = val;
  }
  return out;
}

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function formatCnpj(d) {
  const x = onlyDigits(d);
  if (x.length !== 14) return x;
  return x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function parseArgs(argv) {
  const args = { tokenOnly: false, pagadorCnpj: "65912793000160", valorReais: 5 };
  for (const a of argv) {
    if (a === "--token-only") args.tokenOnly = true;
    else if (a.startsWith("--pagador-cnpj=")) args.pagadorCnpj = onlyDigits(a.split("=")[1]);
    else if (a.startsWith("--valor=")) args.valorReais = Number(a.split("=")[1]);
  }
  return args;
}

function loadConfig() {
  const root = path.join(__dirname, "..");
  const fromFile = parseEnvFile(path.join(root, ".env"));
  const get = (k) => process.env[k]?.trim() || fromFile[k]?.trim() || "";

  const clientId = get("CORA_CLIENT_ID");
  const cert = get("CORA_CERT_PEM");
  const key = get("CORA_PRIVATE_KEY_PEM");
  const envRaw = get("CORA_ENV") || "production";
  const env = envRaw.toLowerCase() === "stage" ? "stage" : "production";
  const emissorCnpj = onlyDigits(get("CORA_EMISSOR_CNPJ"));
  const emissorNome = get("CORA_EMISSOR_NOME") || "ONNZE TECNOLOGIA LTDA";

  if (!clientId || !cert || !key) {
    throw new Error(
      "Faltam CORA_CLIENT_ID, CORA_CERT_PEM ou CORA_PRIVATE_KEY_PEM no .env",
    );
  }

  return { clientId, cert, key, env, urls: BASE[env], emissorCnpj, emissorNome };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableNetworkError(err) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|ENOTFOUND|socket hang up/i.test(
    code || (err instanceof Error ? err.message : String(err)),
  );
}

async function httpsRequest(url, opts, attempt = 1) {
  const maxAttempts = 3;
  try {
    return await httpsRequestOnce(url, opts);
  } catch (err) {
    if (attempt < maxAttempts && isRetryableNetworkError(err)) {
      const wait = attempt * 1500;
      console.warn(
        `   rede instável (${err instanceof Error ? err.message : err}) — tentativa ${attempt + 1}/${maxAttempts} em ${wait}ms…`,
      );
      await sleep(wait);
      return httpsRequest(url, opts, attempt + 1);
    }
    throw err;
  }
}

function httpsRequestOnce(url, { method = "GET", headers = {}, body, cert, key }) {
  const u = new URL(url);
  const payload = body ? Buffer.from(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method,
        headers: payload
          ? { ...headers, "Content-Length": payload.length }
          : headers,
        cert,
        key,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function obterToken(cfg) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
  }).toString();

  const res = await httpsRequest(cfg.urls.token, {
    method: "POST",
    cert: cfg.cert,
    key: cfg.key,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  let json;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new Error(`Token: resposta inválida (${res.status}): ${res.body.slice(0, 300)}`);
  }

  if (!res.status || res.status >= 400 || !json.access_token) {
    throw new Error(
      `Token falhou (${res.status}): ${json.error || json.message || res.body.slice(0, 400)}`,
    );
  }

  return json.access_token;
}

function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function emitirBoleto(cfg, token, { pagadorCnpj, valorCentavos }) {
  const due = new Date();
  due.setDate(due.getDate() + 30);

  const payload = {
    code: `waje-teste-local-${randomUUID().slice(0, 8)}`,
    customer: {
      name: "SHEFA COMERCIO TECH LTDA",
      email: "financeiro.teste@waje.com.br",
      document: { identity: pagadorCnpj, type: "CNPJ" },
      address: {
        street: "CARLOS LACERDA",
        number: "100",
        district: "Centro",
        city: "Sao Paulo",
        state: "SP",
        complement: "N/A",
        zip_code: "05789001",
      },
    },
    services: [
      {
        name: "Teste Waje local",
        description: "Script test-cora-boleto.cjs",
        amount: valorCentavos,
      },
    ],
    payment_terms: { due_date: due.toISOString().slice(0, 10) },
    payment_forms: ["BANK_SLIP", "PIX"],
  };

  const res = await httpsRequest(`${cfg.urls.api}/v2/invoices`, {
    method: "POST",
    cert: cfg.cert,
    key: cfg.key,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  let json;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new Error(`Invoice: resposta inválida (${res.status}): ${res.body.slice(0, 500)}`);
  }

  if (!res.status || res.status >= 400) {
    const msg =
      json.message ||
      json.error ||
      (Array.isArray(json.errors) ? json.errors.map((e) => e.message).join(" · ") : null) ||
      res.body.slice(0, 500);
    throw new Error(`Invoice falhou (${res.status}): ${msg}`);
  }

  return json;
}

const ONNZE_CNPJ = "62449971000170";
const SHEFA_CNPJ = "65912793000160";
const PAINEL_ONNZE_CLIENT_ID = "int-1ZVwf7iYC106q3iRWEmyJP";

function explicarOwnIdentity({ pagadorCnpj, clientId, emissorCnpj }) {
  const pagador = onlyDigits(pagadorCnpj);
  const emissor = onlyDigits(emissorCnpj);
  const linhas = [
    "",
    "═══ Diagnóstico: own identity ═══",
    "",
    `Pagador enviado à Cora: ${formatCnpj(pagador) || pagador}`,
    `CORA_CLIENT_ID no .env:  ${clientId}`,
    `CORA_EMISSOR_CNPJ (env): ${emissor ? formatCnpj(emissor) : "(não definido — adicione 62.449.971/0001-70)"}`,
    "",
    "A Cora só devolve 'own identity' quando o CNPJ do pagador é o MESMO da",
    "conta Cora dona do certificado/client_id — não importa o que está no banco Waje.",
    "",
  ];

  if (pagador === SHEFA_CNPJ) {
    linhas.push(
      "→ Conclusão: estas credenciais pertencem à conta Cora da SHEFA (65.912.793/0001-60),",
      "  NÃO à ONNZE (62.449.971/0001-70).",
      "",
      "  Token OK + boleto SHEFA = own identity é a combinação clássica de credencial errada.",
      "  Por isso o Waje em produção também falha ao emitir para clientes SHEFA.",
    );
  } else if (pagador === ONNZE_CNPJ) {
    linhas.push(
      "→ Conclusão: pagador = ONNZE. As credenciais provavelmente SÃO da ONNZE;",
      "  use CNPJ de cliente (ex. SHEFA) como pagador.",
    );
  } else if (emissor && pagador === emissor) {
    linhas.push("→ Pagador igual ao CORA_EMISSOR_CNPJ no .env.");
  } else {
    linhas.push(
      `→ A conta Cora deste client_id tem CNPJ = ${formatCnpj(pagador) || pagador}.`,
      "  Confirme no Cora Web qual empresa emitiu o certificado.",
    );
  }

  if (clientId !== PAINEL_ONNZE_CLIENT_ID) {
    linhas.push(
      "",
      "Correção:",
      `  1. Cora Web → ONNZE TECNOLOGIA LTDA → Integração Direta → produção`,
      `  2. Baixe cert_key_cora_production_*.zip (client_id ${PAINEL_ONNZE_CLIENT_ID})`,
      "  3. Atualize .env e Render:",
      `     CORA_CLIENT_ID=${PAINEL_ONNZE_CLIENT_ID}`,
      "     CORA_CERT_PEM + CORA_PRIVATE_KEY_PEM (do zip)",
      "     CORA_EMISSOR_CNPJ=62.449.971/0001-70",
      "     CORA_EMISSOR_NOME=ONNZE TECNOLOGIA LTDA",
      "  4. npm run test:cora-boleto",
    );
  }

  return linhas.join("\n");
}

function extractCertMeta(pem) {
  try {
    const cert = new crypto.X509Certificate(pem);
    const m = cert.subject.match(/CN\s*=\s*(int-[A-Za-z0-9]+)/);
    return {
      clientId: m ? m[1] : null,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
    };
  } catch {
    const m = pem.match(/CN=int-([A-Za-z0-9]+)/);
    return { clientId: m ? `int-${m[1]}` : null, validFrom: null, validTo: null };
  }
}

function extractClientIdFromCert(pem) {
  return extractCertMeta(pem).clientId;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig();
  const certMeta = extractCertMeta(cfg.cert);
  const certClientId = certMeta.clientId;

  console.log("=== Teste Cora (Integração Direta) ===\n");
  console.log("Ambiente:", cfg.env);
  console.log("CORA_CLIENT_ID (.env):", cfg.clientId);
  if (certClientId) {
    console.log("Client ID no certificado:", certClientId);
    if (certMeta.validFrom) console.log("Certificado válido de:", certMeta.validFrom, "até", certMeta.validTo);
  }
  console.log("Emissor (env):", formatCnpj(cfg.emissorCnpj) || "(defina CORA_EMISSOR_CNPJ no .env)");
  console.log("Emissor nome:", cfg.emissorNome);
  console.log("Pagador (teste):", formatCnpj(args.pagadorCnpj));

  if (certClientId && cfg.clientId !== certClientId) {
    console.error("\n✗ CORA_CLIENT_ID no .env ≠ client ID dentro do certificado.");
    console.error(`  .env:         ${cfg.clientId}`);
    console.error(`  certificado:  ${certClientId}`);
    console.error("");
    console.error("  Você trocou só o client_id mas manteve cert/key de outro zip.");
    console.error("  Baixe cert_key_cora_production_2025_12_26.zip no painel ONNZE e rode:");
    console.error("    node scripts/cora-pem-from-zip.cjs \"C:\\caminho\\para\\pasta\\extraida\"");
    console.error("  Cole CORA_CERT_PEM + CORA_PRIVATE_KEY_PEM gerados (mesmo par do client_id).");
    process.exit(1);
  }

  if (cfg.emissorCnpj && args.pagadorCnpj === cfg.emissorCnpj) {
    console.error("\n✗ Pagador = emissor no env. Use CNPJ do cliente (ex. SHEFA 65912793000160).");
    process.exit(1);
  }

  console.log("\n1) Obtendo token…");
  const token = await obterToken(cfg);
  const jwt = decodeJwtPayload(token);
  console.log("   Token OK");
  if (jwt?.clientId || jwt?.azp) {
    console.log("   clientId no JWT:", jwt.clientId || jwt.azp);
  }

  if (args.tokenOnly) {
    console.log("\n✓ --token-only: credenciais mTLS OK. Rode sem flag para emitir boleto teste.");
    return;
  }

  console.log("\n2) Emitindo boleto teste (R$", args.valorReais.toFixed(2), ")…");
  const invoice = await emitirBoleto(cfg, token, {
    pagadorCnpj: args.pagadorCnpj,
    valorCentavos: Math.round(args.valorReais * 100),
  });

  const boletoUrl =
    invoice.payment_options?.bank_slip?.url ||
    invoice.document_url ||
    invoice.bank_slip?.url ||
    null;

  console.log("\n✓ SUCESSO — boleto emitido na Cora");
  console.log("   invoice_id:", invoice.id);
  console.log("   status:", invoice.status);
  console.log("   total_amount (centavos):", invoice.total_amount);
  if (boletoUrl) console.log("   boleto_url:", boletoUrl);
  if (invoice.pix?.emv) console.log("   pix_emv:", invoice.pix.emv.slice(0, 60) + "…");
  console.log(
    "\n→ Credenciais ONNZE OK. Se produção falhar, copie o mesmo .env para o Render e redeploy.",
  );
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("\n✗ FALHA:", msg);
  if (/ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket hang up/i.test(msg)) {
    console.error(
      "\nRede/TLS caiu ao falar com matls-clients.api.cora.com.br.",
    );
    console.error("  → Rode de novo: npm run test:cora-token");
    console.error("  → Se persistir: VPN/proxy/antivírus ou instabilidade Cora.");
    console.error("  → Confirme CORA_ENV=production e cert/key do mesmo zip.");
  }
  if (/own identity/i.test(msg)) {
    try {
      const cfg = loadConfig();
      const args = parseArgs(process.argv.slice(2));
      console.error(
        explicarOwnIdentity({
          pagadorCnpj: args.pagadorCnpj,
          clientId: cfg.clientId,
          emissorCnpj: cfg.emissorCnpj,
        }),
      );
    } catch {
      console.error(
        "\nDica: own identity = CNPJ pagador = conta dona do certificado. Troque credenciais ONNZE no .env.",
      );
    }
  }
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Testa MISTRAL_API_KEY do .env contra api.mistral.ai
 * Uso: node scripts/verify-mistral-key.cjs
 *
 * No Windows, antivírus/proxy pode bloquear TLS do Node — o mesmo ajuste do npm run dev.
 */
const fs = require("fs");
const path = require("path");

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn(
    "[verify-mistral] NODE_TLS_REJECT_UNAUTHORIZED=0 (igual ao npm run dev no Windows)\n"
  );
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/\r/g, "").trim();
  }
  return out;
}

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const fromEnv = loadEnvFile(envPath);
const key = fromEnv.MISTRAL_API_KEY;

if (!key) {
  console.error("MISTRAL_API_KEY ausente em .env");
  process.exit(1);
}

const keySource = ".env";

const prefix = key.slice(0, 4);
const suffix = key.slice(-4);
console.log(`Ficheiro: ${keySource}`);
console.log(`Chave carregada: ${prefix}…${suffix} (${key.length} caracteres)`);

fetch("https://api.mistral.ai/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
})
  .then(async (res) => {
    if (res.ok) {
      console.log("OK — Mistral aceitou a chave (HTTP", res.status + ").");
      process.exit(0);
    }
    const body = await res.text().catch(() => "");
    console.error("FALHA — Mistral rejeitou a chave (HTTP", res.status + ").");
    if (body) console.error(body.slice(0, 240));
    if (res.status === 401) {
      console.error("\nA chave está no .env mas a Mistral não a reconhece.");
      console.error("Crie uma chave nova em console.mistral.ai → API Keys → «Copiar chave».");
      console.error("Cole no .env, aguarde ~5 min se acabou de criar, reinicie npm run dev.");
    }
    process.exit(1);
  })
  .catch((e) => {
    const cause = e.cause?.code || e.cause?.message || "";
    console.error("Erro de rede:", e.message, cause ? `(${cause})` : "");
    console.error(
      "Se persistir: antivírus/proxy no Windows. O npm run dev já usa TLS relaxado; este script também."
    );
    process.exit(1);
  });

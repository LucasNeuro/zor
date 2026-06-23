/**
 * Servidor Next em desenvolvimento com TLS relaxado no Node.
 * Motivo: o browser fala com o Supabase, mas rotas /api/* também fazem fetch no servidor;
 * em Windows (antivírus, proxy SSL) isso falha com "fetch failed" / certificado.
 *
 * `npm run dev` usa este script por defeito. Para verificação TLS normal: `npm run dev:strict-tls`.
 * Nunca uses NODE_TLS_REJECT_UNAUTHORIZED=0 em produção (`next start`).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

/** IPs LAN (ex.: 192.168.1.78) para allowedDevOrigins — evita bloqueio de JS ao abrir pelo IP. */
function listLanIpv4() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal && net.address) {
        ips.push(net.address);
      }
    }
  }
  return [...new Set(ips)];
}

/** Wildcards suportados pelo Next (isCsrfOriginAllowed) — cobre IP DHCP na LAN. */
const PRIVATE_LAN_ORIGIN_PATTERNS = ["192.168.*.*", "10.*.*.*"];
const LOCAL_WHITE_LABEL_DEV_ORIGINS = ["synkronia.lvh.me", "synkronia.local"];

function mergeDevAllowedOrigins() {
  const fromEnv = (process.env.NEXT_DEV_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const lan = listLanIpv4();
  const merged = [...new Set([...fromEnv, ...lan, ...PRIVATE_LAN_ORIGIN_PATTERNS, ...LOCAL_WHITE_LABEL_DEV_ORIGINS])];
  process.env.NEXT_DEV_ALLOWED_ORIGINS = merged.join(",");
  return merged;
}

/** Carrega variáveis do `.env` (fonte única; `.env.local` vazio não sobrescreve). */
function loadDotEnvOnly() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const k = trimmed.slice(0, eq);
    const v = trimmed.slice(eq + 1).replace(/\r/g, "").trim();
    process.env[k] = v;
  }
}

loadDotEnvOnly();
mergeDevAllowedOrigins();

const resendKey = (process.env.RESEND_API_KEY || "").replace(/\r/g, "").trim();
if (resendKey) {
  const fp = `${resendKey.slice(0, 4)}…${resendKey.slice(-4)}`;
  console.warn(`[dev] Resend OK — RESEND_API_KEY carregada (${fp}).\n`);
} else {
  console.warn(
    "[dev] AVISO: RESEND_API_KEY ausente no .env — canal e-mail / «Enviar teste» falhará até definir e reiniciar.\n"
  );
}

function coraEmissorDigits() {
  const raw = (process.env.CORA_EMISSOR_CNPJ || "").replace(/\r/g, "").trim();
  return raw.replace(/\D/g, "");
}

const coraEmissor = coraEmissorDigits();
if (coraEmissor.length >= 14) {
  console.warn(`[dev] Cora emissor OK — CORA_EMISSOR_CNPJ carregado (${coraEmissor.slice(0, 2)}…${coraEmissor.slice(-4)}).\n`);
} else if (process.env.CORA_EMISSOR_CNPJ?.trim()) {
  console.warn(
    "[dev] AVISO: CORA_EMISSOR_CNPJ no .env tem menos de 14 dígitos — emissão de boletos falhará.\n"
  );
} else {
  console.warn(
    "[dev] AVISO: CORA_EMISSOR_CNPJ ausente no .env — boletos Cora falham em localhost. " +
      "Defina (ex.: 62.449.971/0001-70) e reinicie. Render não aplica aqui.\n"
  );
}

const port = process.env.PORT || "3001";
const devHost = process.env.HOST || "0.0.0.0";
const lanIps = listLanIpv4();
console.warn(
  "\n[dev] NODE_TLS_REJECT_UNAUTHORIZED=0 (só este processo; use npm run dev:strict-tls se não precisares)\n"
);
console.warn(
  `[dev] URL local: http://localhost:${port}\n` +
    `     Synkron (white-label): http://synkronia.lvh.me:${port}\n` +
    (lanIps.length
      ? `     Rede LAN: ${lanIps.map((ip) => `http://${ip}:${port}`).join(" · ")}\n`
      : "") +
    `     allowedDevOrigins: ${process.env.NEXT_DEV_ALLOWED_ORIGINS || "(nenhum)"}\n` +
    `     Cache dev: .next-dev/ (exclua do OneDrive se chunks/CSS falharem)\n`
);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const mistralKey = (process.env.MISTRAL_API_KEY || "").replace(/\r/g, "").trim();
if (mistralKey) {
  const fp = `${mistralKey.slice(0, 4)}…${mistralKey.slice(-4)}`;
  fetch("https://api.mistral.ai/v1/models", {
    headers: { Authorization: `Bearer ${mistralKey}` },
  })
    .then((res) => {
      if (res.ok) {
        console.warn(`[dev] Mistral OK — chave ${fp} aceite pela API.\n`);
        return;
      }
      console.warn(
        `[dev] AVISO: Mistral rejeitou MISTRAL_API_KEY (${fp}) — HTTP ${res.status}. ` +
          `IA (cargos/agentes) falhará até corrigir. Corra: npm run verify:mistral\n`
      );
    })
    .catch(() => {
      console.warn("[dev] Não foi possível testar Mistral no arranque (rede/TLS).\n");
    });
}

const { spawn } = require("child_process");
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "dev",
    "--webpack",
    "-H",
    devHost,
    "-p",
    port,
  ],
  { stdio: "inherit", env: process.env, cwd: require("path").join(__dirname, "..") }
);
child.on("exit", (code) => process.exit(code ?? 0));

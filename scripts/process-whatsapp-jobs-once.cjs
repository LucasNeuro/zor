/**
 * Processa jobs pendentes localmente (carrega .env). Uso: npm run process:jobs
 */
if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const fs = require("fs");
const path = require("path");

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

const root = path.join(__dirname, "..");
const env = {
  ...parseEnvFile(path.join(root, ".env")),
  ...parseEnvFile(path.join(root, ".env.local")),
};
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

process.env.TS_NODE_PROJECT = path.join(root, "tsconfig.json");
process.env.TS_NODE_TRANSPILE_ONLY = "true";
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
});
require("ts-node/register");
require("tsconfig-paths/register");

async function main() {
  const workerPath = path.join(root, "lib", "workers", "whatsapp-job-worker.ts");
  const mod = require(workerPath);
  let total = 0;
  for (let round = 0; round < 20; round++) {
    const r = await mod.runWhatsappWorkerTick();
    console.log(`round ${round + 1}: claimed=${r.claimed}`, r.error || "");
    total += r.claimed;
    if (r.claimed === 0) break;
  }
  console.log(`done, total claimed=${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

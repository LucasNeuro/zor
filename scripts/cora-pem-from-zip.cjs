#!/usr/bin/env node
/**
 * Converte certificate.pem + private-key.key (zip Cora) para linhas .env / Render.
 *
 * Uso:
 *   node scripts/cora-pem-from-zip.cjs "C:\Downloads\cert_key_cora_production_2025_12_26"
 *
 * Procura certificate.pem (ou .crt) e private-key.key (ou private_key.pem) na pasta.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function findFile(dir, names) {
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function pemToEnvLine(pem) {
  return `"${pem.trim().replace(/\r?\n/g, "\\n")}"`;
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Uso: node scripts/cora-pem-from-zip.cjs <pasta-do-zip-extraido>");
    process.exit(1);
  }

  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) {
    console.error("Pasta não encontrada:", abs);
    process.exit(1);
  }

  const certPath = findFile(abs, ["certificate.pem", "certificate.crt", "cert.pem"]);
  const keyPath = findFile(abs, ["private-key.key", "private_key.key", "private-key.pem", "private_key.pem"]);

  if (!certPath || !keyPath) {
    console.error("Arquivos não encontrados em:", abs);
    console.error("  Esperado: certificate.pem + private-key.key");
    process.exit(1);
  }

  const certPem = fs.readFileSync(certPath, "utf8");
  const keyPem = fs.readFileSync(keyPath, "utf8");

  let clientId = null;
  let validFrom = null;
  let validTo = null;
  try {
    const cert = new crypto.X509Certificate(certPem);
    const m = cert.subject.match(/CN\s*=\s*(int-[A-Za-z0-9]+)/);
    clientId = m ? m[1] : null;
    validFrom = cert.validFrom;
    validTo = cert.validTo;
  } catch (e) {
    console.error("Certificado inválido:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  console.log("=== Cora → variáveis de ambiente ===\n");
  console.log("Pasta:", abs);
  console.log("Client ID (do certificado):", clientId ?? "(não detectado)");
  if (validFrom) console.log("Validade:", validFrom, "→", validTo);
  console.log("\n--- Cole no .env e no Render (substitua CORA_CERT_PEM e CORA_PRIVATE_KEY_PEM) ---\n");
  console.log(`CORA_CLIENT_ID=${clientId ?? "int-..."}`);
  console.log("CORA_ENV=production");
  console.log(`CORA_CERT_PEM=${pemToEnvLine(certPem)}`);
  console.log(`CORA_PRIVATE_KEY_PEM=${pemToEnvLine(keyPem)}`);
  console.log("CORA_EMISSOR_CNPJ=62.449.971/0001-70");
  console.log("CORA_EMISSOR_NOME=ONNZE TECNOLOGIA LTDA");
  console.log("\n--- Depois: npm run test:cora-boleto ---");
}

main();

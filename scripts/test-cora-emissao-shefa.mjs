/**
 * Teste pontual: emite cobrança Cora com pagador SHEFA (não grava no banco).
 * Uso: npx tsx scripts/test-cora-emissao-shefa.mjs
 */
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config({ path: ".env" });

const { emitirCoraCobranca } = await import("../lib/cora/cora-cobranca.ts");
const { getCoraEmissorCnpj } = await import("../lib/cora/cora-emissor.ts");
const { obterCoraAccessToken } = await import("../lib/cora/cora-client.ts");

const PAGADOR = "65912793000160"; // SHEFA
const EMISSOR_ENV = getCoraEmissorCnpj();

console.log("CORA_EMISSOR_CNPJ (env):", EMISSOR_ENV);
console.log("CORA_CLIENT_ID:", process.env.CORA_CLIENT_ID?.slice(0, 12) + "…");

try {
  const token = await obterCoraAccessToken();
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  console.log("Token OK — clientId no JWT:", payload.clientId ?? payload.azp ?? "?");
} catch (e) {
  console.error("Falha token Cora:", e instanceof Error ? e.message : e);
  process.exit(1);
}

const due = new Date();
due.setDate(due.getDate() + 30);

const input = {
  code: `waje-teste-${randomUUID().slice(0, 8)}`,
  customer: {
    name: "SHEFA COMERCIO TECH LTDA",
    email: "financeiro@shefa.test",
    document: { identity: PAGADOR, type: "CNPJ" as const },
    address: {
      street: "CARLOS LACERDA",
      number: "S/N",
      district: "Centro",
      city: "Sao Paulo",
      state: "SP",
      complement: "N/A",
      zip_code: "05789001",
    },
  },
  services: [{ name: "Teste Waje", description: "Teste emissao SHEFA", amount: 500 }],
  payment_terms: { due_date: due.toISOString().slice(0, 10) },
};

console.log("\nEnviando pagador CNPJ:", PAGADOR, "→ emissor env:", EMISSOR_ENV);
console.log("(Se falhar own identity, credenciais Cora NÃO são da conta Onze)\n");

try {
  const inv = await emitirCoraCobranca(input, "boleto_pix");
  console.log("SUCESSO — invoice id:", inv.id, "status:", inv.status);
  console.log("Credenciais Cora OK para emitir SHEFA como pagador.");
} catch (e) {
  console.error("FALHA:", e instanceof Error ? e.message : e);
  process.exit(1);
}

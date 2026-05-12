/**
 * Servidor Next em desenvolvimento com TLS relaxado no Node.
 * Motivo: o browser fala com o Supabase, mas rotas /api/* também fazem fetch no servidor;
 * em Windows (antivírus, proxy SSL) isso falha com "fetch failed" / certificado.
 *
 * `npm run dev` usa este script por defeito. Para verificação TLS normal: `npm run dev:strict-tls`.
 * Nunca uses NODE_TLS_REJECT_UNAUTHORIZED=0 em produção (`next start`).
 */
console.warn(
  "\n[dev] NODE_TLS_REJECT_UNAUTHORIZED=0 (só este processo; use npm run dev:strict-tls se não precisares)\n"
);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { spawn } = require("child_process");
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", "-p", process.env.PORT || "3001"],
  { stdio: "inherit", env: process.env, cwd: require("path").join(__dirname, "..") }
);
child.on("exit", (code) => process.exit(code ?? 0));

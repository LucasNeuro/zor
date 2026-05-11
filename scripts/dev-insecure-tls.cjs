/**
 * Use apenas em desenvolvimento local se o Node falhar com
 * "unable to verify the first certificate" ao contactar o Supabase
 * (antivírus / proxy corporativo que re-assina HTTPS).
 * Nunca uses em produção.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { spawn } = require("child_process");
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", "-p", process.env.PORT || "3001"],
  { stdio: "inherit", env: process.env, cwd: require("path").join(__dirname, "..") }
);
child.on("exit", (code) => process.exit(code ?? 0));

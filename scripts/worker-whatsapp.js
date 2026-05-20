const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || path.join(projectRoot, "tsconfig.json");
process.env.TS_NODE_TRANSPILE_ONLY = process.env.TS_NODE_TRANSPILE_ONLY || "true";
process.env.TS_NODE_COMPILER_OPTIONS =
  process.env.TS_NODE_COMPILER_OPTIONS ||
  JSON.stringify({ module: "commonjs", moduleResolution: "node" });

require("ts-node/register");
require("tsconfig-paths/register");

async function bootstrap() {
  const workerPath = path.join(projectRoot, "lib", "workers", "whatsapp-job-worker.ts");
  const mod = require(workerPath);
  await mod.runWhatsappWorker();
}

bootstrap().catch((err) => {
  const msg = err && err.stack ? err.stack : String(err);
  console.error("[worker:whatsapp] fatal", msg);
  process.exit(1);
});

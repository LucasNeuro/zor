const path = require("path");
const { pathToFileURL } = require("url");

const projectRoot = path.resolve(__dirname, "..");
process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || path.join(projectRoot, "tsconfig.json");

require("tsconfig-paths/register");

async function bootstrap() {
  const workerPath = path.join(projectRoot, "lib", "workers", "whatsapp-job-worker.ts");
  const mod = await import(pathToFileURL(workerPath).href);
  await mod.runWhatsappWorker();
}

bootstrap().catch((err) => {
  const msg = err && err.stack ? err.stack : String(err);
  console.error("[worker:whatsapp] fatal", msg);
  process.exit(1);
});

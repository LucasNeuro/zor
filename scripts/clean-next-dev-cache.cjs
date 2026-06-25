/**
 * Remove cache de desenvolvimento (.next-dev).
 * Use quando npm run dev falhar com EPERM/unlink no Windows (OneDrive bloqueia ficheiros).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dirs = [".next-dev", ".next"];

for (const name of dirs) {
  const target = path.join(root, name);
  if (!fs.existsSync(target)) continue;
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    console.warn(`[clean] Removido ${name}/`);
  } catch (err) {
    console.error(
      `[clean] Não foi possível remover ${name}/: ${err instanceof Error ? err.message : err}\n` +
        "       Feche npm run dev, pause a sincronização OneDrive nesta pasta e tente de novo."
    );
    process.exit(1);
  }
}

console.warn("[clean] Cache limpo. Pode correr npm run dev.\n");

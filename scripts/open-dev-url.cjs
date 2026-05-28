/**
 * Abre o URL de desenvolvimento no browser (usa PORT ou 3001).
 * Uso: npm run open:dev  (com o servidor já a correr)
 */
const { spawn } = require("child_process");
const { platform } = require("os");
const port = process.env.PORT || "3001";
const url = `http://localhost:${port}`;
if (platform() === "win32") {
  spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
} else if (platform() === "darwin") {
  spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
} else {
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}
console.log(`[open:dev] ${url}`);

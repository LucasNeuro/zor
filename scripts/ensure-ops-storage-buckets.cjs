/**
 * Cria/atualiza bucket Storage dos boletos ops (waje-ops-boletos).
 *
 * Requer .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Uso: node scripts/ensure-ops-storage-buckets.cjs
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const BUCKET = {
  id: "waje-ops-boletos",
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf", "application/octet-stream"],
};

async function ensureBucket(supabase, spec) {
  const { data: existing, error: listErr } = await supabase.storage.getBucket(spec.id);
  if (listErr && !/not found|404/i.test(listErr.message)) {
    throw listErr;
  }

  if (!existing) {
    const { error } = await supabase.storage.createBucket(spec.id, {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes,
    });
    if (error) throw error;
    console.log(`[ok] bucket criado: ${spec.id} (público)`);
    return;
  }

  const { error: updErr } = await supabase.storage.updateBucket(spec.id, {
    public: spec.public,
    fileSizeLimit: spec.fileSizeLimit,
    allowedMimeTypes: spec.allowedMimeTypes,
  });
  if (updErr) {
    console.warn(`[aviso] bucket ${spec.id} existe mas update falhou:`, updErr.message);
    console.log(`[ok] bucket já existe: ${spec.id}`);
    return;
  }
  console.log(`[ok] bucket actualizado: ${spec.id}`);
}

async function main() {
  loadDotEnv(path.join(__dirname, "..", ".env"));
  loadDotEnv(path.join(__dirname, "..", ".env.local"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  await ensureBucket(supabase, BUCKET);
  console.log("\nBucket pronto: waje-ops-boletos (PDFs de mensalidades Owner).");
  console.log("Se ainda não correu o SQL de políticas, execute também:");
  console.log("  docs/sql/waje-ops-cobranca-storage.sql (bloco do bucket) no Supabase SQL Editor.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

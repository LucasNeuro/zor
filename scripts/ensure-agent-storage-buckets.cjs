/**
 * Cria/atualiza buckets Storage dos agentes (playbook + RAG).
 * Equivalente à migração 20260621140000 — útil quando não há `supabase db push`.
 *
 * Requer .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Uso: node scripts/ensure-agent-storage-buckets.cjs
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

const BUCKETS = [
  {
    id: "hub-agent-playbooks",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: [
      "text/markdown",
      "text/markdown; charset=utf-8",
      "text/plain",
      "application/octet-stream",
    ],
  },
  {
    id: "hub-agent-rag-docs",
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: [
      "text/plain",
      "text/markdown",
      "text/csv",
      "text/html",
      "text/rtf",
      "text/xml",
      "application/json",
      "application/xml",
      "application/pdf",
      "application/rtf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.oasis.opendocument.text",
      "application/octet-stream",
    ],
  },
];

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
    console.log(`[ok] bucket criado: ${spec.id}`);
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
  for (const spec of BUCKETS) {
    await ensureBucket(supabase, spec);
  }
  console.log("\nBuckets prontos: hub-agent-playbooks (público), hub-agent-rag-docs (privado).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

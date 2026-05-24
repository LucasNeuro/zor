import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

const doc = "19671391303";
const tel = "5511999887766";

const { data: dupDoc } = await supabase
  .from("hub_pessoas")
  .select("id, nome, codigo, documento, tipo_pessoa")
  .eq("documento", doc)
  .maybeSingle();

const { data: dupTel } = await supabase
  .from("hub_pessoas")
  .select("id, nome, codigo, telefone")
  .eq("telefone", tel)
  .maybeSingle();

console.log("dupDoc", dupDoc);
console.log("dupTel", dupTel);

// Test lead insert shape
const pessoaId = dupTel?.id || dupDoc?.id;
if (pessoaId) {
  const leadRow = {
    nome: "Test Lead",
    telefone: tel,
    email: null,
    origem: "meta_ads",
    estagio: "novo",
    score: 10,
    valor_estimado: 0,
    agente_responsavel: "sdr",
    pessoa_id: pessoaId,
    tenant_id: "00000000-0000-4000-8000-000000000001",
    metadata: { mercados: ["IMB"] },
    codigo: "LED-TEST-9999",
  };
  const ins = await supabase.from("hub_leads_crm").insert(leadRow).select("id, codigo").single();
  console.log("lead insert", ins);
}

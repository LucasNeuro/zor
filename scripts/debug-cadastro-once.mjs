import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE env");
  process.exit(1);
}

const supabase = createClient(url, key);

const row = {
  codigo: `PES-TEST-${Date.now()}`,
  nome: "Debug Cadastro Script",
  telefone: "5511999887701",
  email: null,
  documento: null,
  tipo: "lead",
  tipo_pessoa: "PF",
  empresa: null,
  cidade: null,
  estado: null,
  origem: "meta_ads",
  criado_em: new Date().toISOString(),
  atualizado_em: new Date().toISOString(),
  dados_extras: { mercados: ["IMB"] },
  area_atuacao: null,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
};

const { data, error } = await supabase.from("hub_pessoas").insert(row).select("id, codigo").single();
console.log("insert result:", { data, error });

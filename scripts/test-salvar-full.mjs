import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function gerarCodigo(tabela, prefixo) {
  const year = new Date().getFullYear();
  const { count } = await supabase.from(tabela).select("*", { count: "exact", head: true });
  const seq = String((count || 0) + 1).padStart(4, "0");
  return `${prefixo}-${year}-${seq}`;
}

const tel = `5511999${String(Date.now()).slice(-6)}`;
const codigo = await gerarCodigo("hub_pessoas", "PES");
const now = new Date().toISOString();

const rowPessoa = {
  codigo,
  nome: "Novo Teste Sem CPF",
  telefone: tel,
  email: null,
  documento: null,
  tipo: "lead",
  tipo_pessoa: "PF",
  empresa: null,
  cidade: null,
  estado: null,
  origem: "meta_ads",
  criado_em: now,
  atualizado_em: now,
  dados_extras: { mercados: ["IMB"], area_atuacao: null, cep: null, logradouro: null, numero: null, complemento: null, bairro: null },
};

let payload = { ...rowPessoa, tenant_id: "00000000-0000-4000-8000-000000000001" };
const optional = ["tenant_id", "area_atuacao", "cep", "logradouro", "numero", "complemento", "bairro", "dados_extras"];

for (let i = 0; i < 12; i++) {
  const res = await supabase.from("hub_pessoas").insert(payload).select("id, codigo").single();
  if (!res.error && res.data?.id) {
    console.log("pessoa OK", res.data);
    const leadCodigo = await gerarCodigo("hub_leads_crm", "LED");
    const leadRes = await supabase
      .from("hub_leads_crm")
      .insert({
        nome: rowPessoa.nome,
        telefone: tel,
        origem: "meta_ads",
        estagio: "novo",
        score: 10,
        valor_estimado: 0,
        agente_responsavel: "sdr",
        pessoa_id: res.data.id,
        tenant_id: "00000000-0000-4000-8000-000000000001",
        codigo: leadCodigo,
        metadata: { mercados: ["IMB"] },
      })
      .select("id, codigo")
      .single();
    console.log("lead", leadRes);
    process.exit(0);
  }
  const msg = (res.error?.message || "").toLowerCase();
  const code = res.error?.code;
  console.log("attempt", i, code, res.error?.message);
  if (code === "23503" && msg.includes("tenant")) {
    delete payload.tenant_id;
    continue;
  }
  const miss = optional.find((c) => msg.includes(c));
  if (miss || code === "PGRST204" || code === "42703") {
    delete payload[miss];
    if (miss === "tenant_id") delete payload.tenant_id;
    continue;
  }
  console.error("FAILED", res.error);
  process.exit(1);
}

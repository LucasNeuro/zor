import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoParceiro } from "@/lib/crm/parceiro-cadastro";
import { defaultTenantId } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: NextRequest) {
  const supabase = db();
  const tenantId = defaultTenantId();

  try {
    const body = await request.json();
    const {
      tipo_pessoa,
      perfil,
      nome,
      razao_social,
      nome_contato,
      telefone,
      email,
      cpf,
      cnpj,
      mercado,
      cidade,
      estado,
    } = body as Record<string, string | undefined>;

    const tel = String(telefone || "").replace(/\D/g, "");
    const nomeFinal =
      tipo_pessoa === "PJ"
        ? String(razao_social || nome || "").trim()
        : String(nome || "").trim();

    if (!nomeFinal || tel.length < 10) {
      return NextResponse.json(
        { erro: "Nome e telefone são obrigatórios." },
        { status: 400 }
      );
    }

    const { data: dupTel } = await supabase
      .from("hub_parceiros")
      .select("id, nome, codigo")
      .eq("telefone", tel)
      .maybeSingle();

    if (dupTel) {
      return NextResponse.json(
        {
          erro: "Telefone já cadastrado na rede.",
          codigo: dupTel.codigo,
          parceiro_id: dupTel.id,
        },
        { status: 409 }
      );
    }

    const cpfDigits = cpf ? String(cpf).replace(/\D/g, "") : null;
    const cnpjDigits = cnpj ? String(cnpj).replace(/\D/g, "") : null;

    if (cpfDigits) {
      const { data: dup } = await supabase
        .from("hub_parceiros")
        .select("id, codigo")
        .eq("cpf", cpfDigits)
        .maybeSingle();
      if (dup) {
        return NextResponse.json(
          { erro: "CPF já cadastrado.", codigo: dup.codigo, parceiro_id: dup.id },
          { status: 409 }
        );
      }
    }
    if (cnpjDigits) {
      const { data: dup } = await supabase
        .from("hub_parceiros")
        .select("id, codigo")
        .eq("cnpj", cnpjDigits)
        .maybeSingle();
      if (dup) {
        return NextResponse.json(
          { erro: "CNPJ já cadastrado.", codigo: dup.codigo, parceiro_id: dup.id },
          { status: 409 }
        );
      }
    }

    const codigo = await gerarCodigoParceiro(supabase);
    const especialidade = String(body.especialidade || "").trim() || null;

    const { data: parceiro, error: errP } = await supabase
      .from("hub_parceiros")
      .insert({
        codigo,
        nome: nomeFinal,
        telefone: tel,
        email: email?.trim() || null,
        cpf: tipo_pessoa === "PF" ? cpfDigits : null,
        cnpj: tipo_pessoa === "PJ" ? cnpjDigits : null,
        especialidade,
        mercado: mercado?.trim() || null,
        cidade: cidade?.trim() || null,
        estado: estado?.trim()?.toUpperCase() || null,
        comissao_pct: 5,
        status: "captacao",
        tenant_id: tenantId,
      })
      .select("id, codigo")
      .single();

    if (errP || !parceiro) {
      return NextResponse.json(
        { erro: errP?.message || "Erro ao gravar cadastro." },
        { status: 500 }
      );
    }

    await supabase.from("hub_parceiros_captacao").insert({
      parceiro_id: parceiro.id,
      estagio: "interessado",
      origem: "link_publico_rede",
      canal: "formulario_web",
    });

    await supabase.from("hub_parceiros_log").insert({
      parceiro_id: parceiro.id,
      evento: "cadastro_link_publico",
      descricao: `Cadastro via link da rede — ${codigo} (${tipo_pessoa}, ${perfil}, ${mercado || "—"})`,
      feito_por: "parceiro",
    });

    return NextResponse.json({
      parceiro_id: parceiro.id,
      codigo: parceiro.codigo ?? codigo,
      status: "criado",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

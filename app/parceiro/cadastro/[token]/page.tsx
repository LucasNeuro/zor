"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Etapa = "verificando" | "formulario" | "enviado" | "expirado" | "erro";

export default function CadastroParceiro() {
  const params = useParams();
  const token = params.token as string;

  const [etapa, setEtapa] = useState<Etapa>("verificando");
  const [linkData, setLinkData] = useState<Record<string, unknown>>({});
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");

  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", cpf: "",
    especialidade: "", mercado: "", cidade: "", estado: "",
  });

  useEffect(() => {
    async function verificarToken() {
      const { data, error } = await supabase
        .from("hub_links_cadastro")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) { setEtapa("erro"); return; }
      if (data.usado_em) { setEtapa("expirado"); return; }
      if (new Date(data.expira_em as string) < new Date()) { setEtapa("expirado"); return; }

      const meta = (data.metadata as Record<string, unknown>) || {};
      setLinkData(data);
      setForm(f => ({
        ...f,
        nome: (meta.nome as string) || "",
        email: (meta.email as string) || "",
        especialidade: (meta.especialidade as string) || "",
      }));
      setEtapa("formulario");
    }
    verificarToken();
  }, [token]);

  function campo(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function enviar() {
    if (!form.nome.trim() || !form.telefone.trim() || !form.especialidade.trim()) {
      setErroForm("Preencha nome, telefone e especialidade.");
      return;
    }
    setSalvando(true);
    setErroForm("");

    const meta = (linkData.metadata as Record<string, unknown>) || {};
    const { error } = await supabase.from("hub_profissionais").insert({
      nome: form.nome,
      email: form.email || null,
      telefone: form.telefone,
      cpf: form.cpf || null,
      especialidade: form.especialidade,
      mercado: form.mercado || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      status: "pendente",
      comissao_pct: (meta.comissao_pct as number) || 5,
      token_cadastro: token,
      metadata: { origem_link: linkData.id, criado_por_link: true },
    });

    if (error) { setErroForm("Erro ao salvar. Tente novamente."); setSalvando(false); return; }

    await supabase.from("hub_links_cadastro").update({ usado_em: new Date().toISOString() }).eq("token", token);

    setEtapa("enviado");
    setSalvando(false);
  }

  if (etapa === "verificando") {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#8b949e", fontSize: 14 }}>Verificando link...</p>
      </div>
    );
  }

  if (etapa === "expirado") {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
        <h1 style={{ color: "#e6edf3", fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Link expirado</h1>
        <p style={{ color: "#8b949e", fontSize: 14 }}>Este link de convite já foi usado ou expirou. Solicite um novo link ao responsável.</p>
      </div>
    );
  }

  if (etapa === "erro") {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <h1 style={{ color: "#e6edf3", fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Link inválido</h1>
        <p style={{ color: "#8b949e", fontSize: 14 }}>Este link não existe. Verifique com quem enviou o convite.</p>
      </div>
    );
  }

  if (etapa === "enviado") {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#003b26", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>✓</div>
        <h1 style={{ color: "#e6edf3", fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>Cadastro enviado!</h1>
        <p style={{ color: "#8b949e", fontSize: 14, maxWidth: 320, lineHeight: 1.6 }}>
          Seu cadastro foi recebido com sucesso. Nossa equipe vai analisar e entrar em contato em breve.
        </p>
        <div style={{ marginTop: 24, padding: "12px 20px", borderRadius: 10, background: "#c9a24a20", border: "1px solid #c9a24a40" }}>
          <p style={{ color: "#c9a24a", fontSize: 12, margin: 0, fontWeight: 700 }}>OBRA10+</p>
        </div>
      </div>
    );
  }

  const INPUT = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1px solid #30363d", background: "#161b22",
    color: "#e6edf3", fontSize: 14, boxSizing: "border-box" as const,
  };

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", padding: "1.5rem", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p style={{ color: "#c9a24a", fontWeight: 800, fontSize: 14, letterSpacing: "0.06em", margin: "0 0 8px" }}>OBRA10+</p>
        <h1 style={{ color: "#e6edf3", fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Cadastro de Parceiro</h1>
        <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>Preencha seus dados para entrar na nossa rede.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Nome completo *</label>
          <input value={form.nome} onChange={e => campo("nome", e.target.value)} placeholder="Seu nome" style={INPUT} />
        </div>
        <div>
          <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Telefone / WhatsApp *</label>
          <input value={form.telefone} onChange={e => campo("telefone", e.target.value)} placeholder="(11) 99999-9999" type="tel" style={INPUT} />
        </div>
        <div>
          <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>E-mail</label>
          <input value={form.email} onChange={e => campo("email", e.target.value)} placeholder="email@exemplo.com" type="email" style={INPUT} />
        </div>
        <div>
          <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>CPF</label>
          <input value={form.cpf} onChange={e => campo("cpf", e.target.value)} placeholder="000.000.000-00" style={INPUT} />
        </div>
        <div>
          <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Especialidade *</label>
          <select value={form.especialidade} onChange={e => campo("especialidade", e.target.value)} style={INPUT}>
            <option value="">Selecione...</option>
            <option value="Imobiliário">Imobiliário</option>
            <option value="Arquitetura">Arquitetura</option>
            <option value="Engenharia Civil">Engenharia Civil</option>
            <option value="Construção">Construção</option>
            <option value="Advocacia">Advocacia</option>
            <option value="Medicina">Medicina</option>
            <option value="Consultoria">Consultoria</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Cidade</label>
            <input value={form.cidade} onChange={e => campo("cidade", e.target.value)} placeholder="São Paulo" style={INPUT} />
          </div>
          <div>
            <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Estado</label>
            <select value={form.estado} onChange={e => campo("estado", e.target.value)} style={INPUT}>
              <option value="">UF</option>
              {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>

        {erroForm && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{erroForm}</p>}

        <button onClick={enviar} disabled={salvando}
          style={{
            padding: "14px", borderRadius: 12, border: "none",
            cursor: salvando ? "not-allowed" : "pointer",
            background: salvando ? "#30363d" : "#c9a24a",
            color: salvando ? "#8b949e" : "#0d1117",
            fontWeight: 800, fontSize: 15, marginTop: 4,
          }}>
          {salvando ? "Enviando..." : "Enviar Cadastro"}
        </button>

        <p style={{ color: "#484f58", fontSize: 11, textAlign: "center", lineHeight: 1.5 }}>
          Seus dados serão analisados pela equipe OBRA10+. Após aprovação, você será contatado para iniciar a parceria.
        </p>
      </div>
    </div>
  );
}

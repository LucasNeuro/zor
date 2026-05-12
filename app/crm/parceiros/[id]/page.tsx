"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";
import { CrmStickyTabs } from "@/components/crm/CrmStickyTabs";
import { FileText, Layers, Link2, ScrollText, User } from "lucide-react";

interface Modulo { id: string; modulo_numero: number; titulo: string; status: string; nota: number | null; feedback: string | null; concluido_em: string | null; tentativas: number; }
interface Documento { id: string; tipo: string; nome_arquivo: string | null; status: string; observacoes: string | null; enviado_em: string | null; }
interface Referencia { id: string; nome: string; telefone: string | null; email: string | null; relacao: string | null; verificado: boolean; }
interface LogEntry { id: string; evento: string; descricao: string | null; feito_por: string | null; feito_por_tipo: string; dados: Record<string, unknown>; criado_em: string; }
interface ModuloTemplate { numero: number; titulo: string; descricao: string | null; duracao_horas: number | null; }

interface Parceiro {
  id: string; nome: string; telefone: string; email: string | null; cpf: string | null; cnpj: string | null;
  especialidade: string | null; mercado: string | null; cidade: string | null; estado: string | null;
  status: string; modulo_atual: number; recebe_leads: boolean; comissao_pct: number;
  total_leads_recebidos: number; total_leads_convertidos: number; bio: string | null;
  instagram: string | null; linkedin: string | null; site: string | null; criado_em: string;
  hub_parceiros_captacao: { estagio: string; origem: string | null; canal: string | null } | null;
  hub_parceiros_homologacao: { estagio: string; modulos_concluidos: number; data_conclusao: string | null } | null;
}

const STATUS_COR: Record<string, string> = {
  captacao: "#8b949e", em_homologacao: "#c9a24a", homologado: "#003b26", inativo: "#484f58", rejeitado: "#b3261e",
};

const MODULO_STATUS_COR: Record<string, string> = {
  concluido: "#003b26", em_andamento: "#c9a24a", reprovado: "#b3261e", pendente: "#21262d",
};

function tempoRelativo(d: string): string {
  const diff = (Date.now() - new Date(d).getTime()) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.round(diff)}min atrás`;
  if (diff < 1440) return `${Math.round(diff / 60)}h atrás`;
  return `${Math.round(diff / 1440)}d atrás`;
}

export default function ParceiroDetalhePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [parceiro, setParceiro] = useState<Parceiro | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [modulosTemplate, setModulosTemplate] = useState<ModuloTemplate[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [aba, setAba] = useState<"perfil" | "modulos" | "documentos" | "referencias" | "logs">("perfil");
  const [avancando, setAvancando] = useState<number | null>(null);
  const [msgLinkPortal, setMsgLinkPortal] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [p, m, mt, d, r, l] = await Promise.all([
      supabase.from("hub_parceiros").select(`*, hub_parceiros_captacao(estagio, origem, canal), hub_parceiros_homologacao(estagio, modulos_concluidos, data_conclusao)`).eq("id", id).single(),
      supabase.from("hub_parceiros_modulos").select("*").eq("parceiro_id", id).order("modulo_numero"),
      supabase.from("hub_modulos_template").select("numero, titulo, descricao, duracao_horas").order("numero"),
      supabase.from("hub_parceiros_documentos").select("*").eq("parceiro_id", id).order("criado_em", { ascending: false }),
      supabase.from("hub_parceiros_referencias").select("*").eq("parceiro_id", id),
      supabase.from("hub_parceiros_log").select("*").eq("parceiro_id", id).order("criado_em", { ascending: false }).limit(50),
    ]);
    if (p.data) setParceiro(p.data as Parceiro);
    if (m.data) setModulos(m.data);
    if (mt.data) setModulosTemplate(mt.data);
    if (d.data) setDocumentos(d.data);
    if (r.data) setReferencias(r.data);
    if (l.data) setLogs(l.data as LogEntry[]);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function copiarLinkPortal() {
    setMsgLinkPortal(null);
    const res = await fetch(`/api/parceiros/${id}/portal-link`, { headers: internalApiHeaders() });
    const j = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setMsgLinkPortal("Produção: use curl com Authorization Bearer CRON_SECRET (README).");
      return;
    }
    if (!j.url) {
      setMsgLinkPortal("Não foi possível gerar o link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(j.url);
      setMsgLinkPortal("Link do portal copiado.");
    } catch {
      setMsgLinkPortal(j.url);
    }
    setTimeout(() => setMsgLinkPortal(null), 5000);
  }

  async function avancarModulo(numero: number) {
    setAvancando(numero);
    await fetch(`/api/parceiros/${id}/modulo`, {
      method: "POST",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ modulo_numero: numero, feito_por: "gestor" }),
    });
    await carregar();
    setAvancando(null);
  }

  if (!parceiro) {
    return <div style={{ background: "#0d1117", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#484f58" }}>Carregando...</p>
    </div>;
  }

  const statusCor = STATUS_COR[parceiro.status] || "#8b949e";

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3 sticky top-0 z-10"
        style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
        <button onClick={() => router.back()} style={{ color: "#8b949e", background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", paddingTop: 2 }}>←</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-white font-bold truncate">{parceiro.nome}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: `${statusCor}25`, color: statusCor }}>
              {parceiro.status.replace("_", " ")}
            </span>
            <button
              type="button"
              onClick={() => void copiarLinkPortal()}
              className="text-xs px-2 py-0.5 rounded border border-[#30363d] text-[#8b949e] hover:text-[#c9a24a]"
            >
              Link portal
            </button>
          </div>
          {msgLinkPortal && (
            <p className="text-[10px] mt-1 break-all" style={{ color: "#8b949e" }}>{msgLinkPortal}</p>
          )}
          <p className="text-xs" style={{ color: "#8b949e" }}>
            {parceiro.especialidade || "—"}{parceiro.cidade ? ` · ${parceiro.cidade}/${parceiro.estado}` : ""}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-px" style={{ background: "#30363d" }}>
        {[
          { val: `${parceiro.modulo_atual}/8`, label: "Módulo" },
          { val: parceiro.total_leads_recebidos, label: "Leads" },
          { val: `${parceiro.comissao_pct}%`, label: "Comissão" },
        ].map(s => (
          <div key={s.label} className="py-2 text-center" style={{ background: "#161b22" }}>
            <p className="font-bold" style={{ color: "#c9a24a" }}>{s.val}</p>
            <p className="text-xs" style={{ color: "#484f58" }}>{s.label}</p>
          </div>
        ))}
      </div>

      <CrmStickyTabs
        scrollable
        activeId={aba}
        onChange={(id) => setAba(id as typeof aba)}
        tabs={[
          { id: "perfil", label: "Perfil", icon: User },
          { id: "modulos", label: "Módulos", icon: Layers },
          { id: "documentos", label: "Documentos", icon: FileText },
          { id: "referencias", label: "Referências", icon: Link2 },
          { id: "logs", label: "Logs", icon: ScrollText },
        ]}
      />

      <div className="p-4 max-w-2xl mx-auto">
        {/* PERFIL */}
        {aba === "perfil" && (
          <div className="space-y-3">
            <div className="rounded-xl p-4" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "#484f58", textTransform: "uppercase", letterSpacing: "0.08em" }}>Contato</p>
              <div className="space-y-2">
                {[
                  { label: "Telefone", val: parceiro.telefone },
                  { label: "E-mail", val: parceiro.email },
                  { label: "CPF", val: parceiro.cpf },
                  { label: "CNPJ", val: parceiro.cnpj },
                  { label: "Instagram", val: parceiro.instagram },
                  { label: "LinkedIn", val: parceiro.linkedin },
                  { label: "Site", val: parceiro.site },
                ].filter(x => x.val).map(x => (
                  <div key={x.label} className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "#484f58" }}>{x.label}</span>
                    <span className="text-xs font-medium" style={{ color: "#e6edf3" }}>{x.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#161b22", border: "1px solid #30363d" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "#484f58", textTransform: "uppercase", letterSpacing: "0.08em" }}>Captação</p>
              <div className="space-y-2">
                {[
                  { label: "Estágio captação", val: parceiro.hub_parceiros_captacao?.estagio || "—" },
                  { label: "Origem", val: parceiro.hub_parceiros_captacao?.origem || "—" },
                  { label: "Canal", val: parceiro.hub_parceiros_captacao?.canal || "—" },
                  { label: "Cadastrado", val: tempoRelativo(parceiro.criado_em) },
                  { label: "Recebe leads", val: parceiro.recebe_leads ? "Sim" : "Não" },
                ].map(x => (
                  <div key={x.label} className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "#484f58" }}>{x.label}</span>
                    <span className="text-xs font-medium" style={{ color: "#e6edf3" }}>{x.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {parceiro.bio && (
              <div className="rounded-xl p-4" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <p className="text-xs font-bold mb-2" style={{ color: "#484f58", textTransform: "uppercase", letterSpacing: "0.08em" }}>Bio</p>
                <p className="text-sm" style={{ color: "#e6edf3" }}>{parceiro.bio}</p>
              </div>
            )}
          </div>
        )}

        {/* MÓDULOS */}
        {aba === "modulos" && (
          <div className="space-y-2">
            {modulosTemplate.map(tmpl => {
              const m = modulos.find(x => x.modulo_numero === tmpl.numero);
              const status = m?.status || "pendente";
              const cor = MODULO_STATUS_COR[status];
              const podeAvancar = !m || status !== "concluido";
              return (
                <div key={tmpl.numero} className="rounded-xl p-3"
                  style={{ background: "#161b22", border: `1px solid ${cor}40`, opacity: status === "pendente" ? 0.7 : 1 }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{ width: 28, height: 28, background: `${cor}30`, color: cor }}>
                        {tmpl.numero}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">{tmpl.titulo}</p>
                        {tmpl.descricao && <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{tmpl.descricao}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: `${cor}20`, color: cor }}>
                            {status}
                          </span>
                          {m?.nota != null && <span className="text-xs" style={{ color: "#c9a24a" }}>nota: {m.nota}</span>}
                          {m?.concluido_em && <span className="text-xs" style={{ color: "#484f58" }}>{tempoRelativo(m.concluido_em)}</span>}
                          {tmpl.duracao_horas && <span className="text-xs" style={{ color: "#484f58" }}>{tmpl.duracao_horas}h</span>}
                        </div>
                      </div>
                    </div>
                    {podeAvancar && (
                      <button
                        onClick={() => avancarModulo(tmpl.numero)}
                        disabled={avancando === tmpl.numero}
                        className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                        style={{ background: "#003b2620", color: "#34d399", border: "1px solid #003b2640", cursor: "pointer", opacity: avancando === tmpl.numero ? 0.5 : 1 }}>
                        {avancando === tmpl.numero ? "..." : "✓ Concluir"}
                      </button>
                    )}
                  </div>
                  {m?.feedback && <p className="text-xs mt-2 pl-9" style={{ color: "#8b949e" }}>{m.feedback}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* DOCUMENTOS */}
        {aba === "documentos" && (
          <div>
            {documentos.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: "#484f58" }}>Nenhum documento enviado</p>
            ) : (
              <div className="space-y-2">
                {documentos.map(d => {
                  const cor = d.status === "aprovado" ? "#003b26" : d.status === "rejeitado" ? "#b3261e" : "#c9a24a";
                  return (
                    <div key={d.id} className="rounded-xl p-3" style={{ background: "#161b22", border: `1px solid ${cor}40` }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-bold text-sm">{d.tipo}</p>
                          {d.nome_arquivo && <p className="text-xs" style={{ color: "#8b949e" }}>{d.nome_arquivo}</p>}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${cor}20`, color: cor }}>{d.status}</span>
                      </div>
                      {d.observacoes && <p className="text-xs mt-1" style={{ color: "#8b949e" }}>{d.observacoes}</p>}
                      {d.enviado_em && <p className="text-xs mt-1" style={{ color: "#484f58" }}>{tempoRelativo(d.enviado_em)}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* REFERÊNCIAS */}
        {aba === "referencias" && (
          <div>
            {referencias.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: "#484f58" }}>Nenhuma referência cadastrada</p>
            ) : (
              <div className="space-y-2">
                {referencias.map(r => (
                  <div key={r.id} className="rounded-xl p-3" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white font-bold text-sm">{r.nome}</p>
                      {r.verificado && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#003b2620", color: "#34d399" }}>verificado</span>}
                    </div>
                    {r.relacao && <p className="text-xs mb-1" style={{ color: "#8b949e" }}>{r.relacao}</p>}
                    <div className="flex gap-3 text-xs" style={{ color: "#484f58" }}>
                      {r.telefone && <span>{r.telefone}</span>}
                      {r.email && <span>{r.email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LOGS — imutável */}
        {aba === "logs" && (
          <div>
            {logs.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: "#484f58" }}>Sem eventos registrados</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px" style={{ background: "#30363d" }} />
                <div className="space-y-4 pl-8">
                  {logs.map(l => (
                    <div key={l.id} className="relative">
                      <div className="absolute -left-5 top-1.5 w-2 h-2 rounded-full" style={{ background: "#c9a24a" }} />
                      <p className="text-white font-bold text-sm">{l.evento.replace(/_/g, " ")}</p>
                      {l.descricao && <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{l.descricao}</p>}
                      <div className="flex gap-2 mt-1 text-xs" style={{ color: "#484f58" }}>
                        <span>{tempoRelativo(l.criado_em)}</span>
                        {l.feito_por && <span>· {l.feito_por}</span>}
                        <span>· {l.feito_por_tipo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

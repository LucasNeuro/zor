"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";

interface Modulo {
  modulo_numero: number;
  status: string;
  concluido_em: string | null;
}

interface Parceiro {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  especialidade: string | null;
  mercado: string | null;
  cidade: string | null;
  estado: string | null;
  status: string;
  modulo_atual: number;
  recebe_leads: boolean;
  total_leads_recebidos: number;
  total_leads_convertidos: number;
  comissao_pct: number;
  criado_em: string;
  hub_parceiros_captacao: { estagio: string; origem: string | null } | null;
  hub_parceiros_homologacao: { estagio: string; modulos_concluidos: number; data_conclusao: string | null } | null;
  hub_parceiros_modulos: Modulo[];
}

const ESTAGIOS_CAPTACAO = [
  { id: "interessado", label: "Interessado", cor: "#8b949e" },
  { id: "contato_feito", label: "Contato feito", cor: "#c9a24a" },
  { id: "proposta_enviada", label: "Proposta enviada", cor: "#a78bfa" },
  { id: "documentos_pendentes", label: "Docs pendentes", cor: "#f97316" },
  { id: "aguardando_treinamento", label: "Aguard. treino", cor: "#38bdf8" },
  { id: "concluido", label: "Concluído", cor: "#003b26" },
];

function ModuloBar({ modulos, total = 8 }: { modulos: Modulo[]; total?: number }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {Array.from({ length: total }, (_, i) => {
        const m = modulos.find(x => x.modulo_numero === i + 1);
        const cor = m?.status === "concluido" ? "#003b26" : m?.status === "em_andamento" ? "#c9a24a" : "#21262d";
        return <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: cor }} />;
      })}
    </div>
  );
}

function CardParceiro({ p, onClick }: { p: Parceiro; onClick: () => void }) {
  return (
    <div onClick={onClick} className="rounded-xl p-3 cursor-pointer"
      style={{ background: "#161b22", border: "1px solid #30363d" }}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{p.nome}</p>
          <p className="text-xs truncate" style={{ color: "#8b949e" }}>
            {p.especialidade || "—"}{p.cidade ? ` · ${p.cidade}` : ""}
          </p>
        </div>
        {p.recebe_leads && (
          <span className="text-xs px-1.5 py-0.5 rounded ml-2 flex-shrink-0"
            style={{ background: "#003b2630", color: "#34d399", fontSize: 10 }}>
            leads ✓
          </span>
        )}
      </div>
      <p className="text-xs mb-1" style={{ color: "#484f58" }}>{p.telefone}</p>
      {p.hub_parceiros_modulos?.length > 0 && (
        <ModuloBar modulos={p.hub_parceiros_modulos} />
      )}
      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "#484f58" }}>
        <span>Módulo {p.modulo_atual}/8</span>
        <span>{p.comissao_pct}% comissão</span>
        {p.total_leads_recebidos > 0 && <span style={{ color: "#c9a24a" }}>{p.total_leads_recebidos} leads</span>}
      </div>
    </div>
  );
}

export default function ParceirosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [aba, setAba] = useState<"captacao" | "homologacao" | "homologados">("captacao");
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hub_parceiros")
      .select(`
        *,
        hub_parceiros_captacao(estagio, origem),
        hub_parceiros_homologacao(estagio, modulos_concluidos, data_conclusao),
        hub_parceiros_modulos(modulo_numero, status, concluido_em)
      `)
      .order("criado_em", { ascending: false });
    setParceiros((data || []) as Parceiro[]);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = parceiros.filter(p =>
    !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.telefone.includes(busca) || (p.email || "").toLowerCase().includes(busca.toLowerCase())
  );

  const captacao = filtrados.filter(p => p.status === "captacao");
  const homologacao = filtrados.filter(p => p.status === "em_homologacao");
  const homologados = filtrados.filter(p => p.status === "homologado");

  const contagens = { captacao: captacao.length, homologacao: homologacao.length, homologados: homologados.length };

  useEffect(() => {
    setSlot({
      path: pathname,
      subtitle: `${parceiros.length} cadastrados · ${homologados.length} homologados`,
      actions: (
        <button
          type="button"
          onClick={() => router.push("/crm/parceiros/novo")}
          className="rounded-lg px-3 py-1.5 text-sm font-bold"
          style={{ background: "#c9a24a", color: "#0d1117", cursor: "pointer" }}
        >
          + Convidar
        </button>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, parceiros.length, homologados.length, router]);

  return (
    <div className="flex min-h-full flex-col" style={{ background: "#0d1117" }}>
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <input
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou email..."
          className="w-full text-sm rounded-lg px-3 py-2"
          style={{ background: "#21262d", border: "1px solid #30363d", color: "#e6edf3" }}
        />
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid #30363d" }}>
        {([
          { id: "captacao", label: `Captação (${contagens.captacao})` },
          { id: "homologacao", label: `Homologação (${contagens.homologacao})` },
          { id: "homologados", label: `Homologados (${contagens.homologados})` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            className="flex-1 py-2.5 text-xs transition-colors"
            style={{
              color: aba === t.id ? "#c9a24a" : "#8b949e",
              background: "#0d1117",
              cursor: "pointer",
              borderTopWidth: 0,
              borderLeftWidth: 0,
              borderRightWidth: 0,
              borderTopStyle: "none",
              borderLeftStyle: "none",
              borderRightStyle: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              borderBottomColor: aba === t.id ? "#c9a24a" : "transparent",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center py-12 text-sm" style={{ color: "#484f58" }}>Carregando...</p>
      ) : (
        <div className="p-4">
          {/* CAPTAÇÃO — kanban by stage */}
          {aba === "captacao" && (
            captacao.length === 0 ? (
              <div className="text-center py-12">
                <p className="font-bold" style={{ color: "#e6edf3" }}>Nenhum parceiro em captação</p>
                <p className="text-xs mt-1" style={{ color: "#484f58" }}>Convide novos parceiros pelo botão acima</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ESTAGIOS_CAPTACAO.map(est => {
                  const grupo = captacao.filter(p =>
                    (p.hub_parceiros_captacao?.estagio || "interessado") === est.id
                  );
                  if (grupo.length === 0) return null;
                  return (
                    <div key={est.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: est.cor }} />
                        <span className="text-xs font-bold" style={{ color: est.cor }}>{est.label}</span>
                        <span className="text-xs" style={{ color: "#484f58" }}>({grupo.length})</span>
                      </div>
                      <div className="space-y-2">
                        {grupo.map(p => (
                          <CardParceiro key={p.id} p={p} onClick={() => router.push(`/crm/parceiros/${p.id}`)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* HOMOLOGAÇÃO — by module progress */}
          {aba === "homologacao" && (
            homologacao.length === 0 ? (
              <div className="text-center py-12">
                <p className="font-bold" style={{ color: "#e6edf3" }}>Nenhum parceiro em homologação</p>
                <p className="text-xs mt-1" style={{ color: "#484f58" }}>Parceiros chegam aqui após concluir o módulo 5</p>
              </div>
            ) : (
              <div className="space-y-2">
                {homologacao
                  .sort((a, b) => b.modulo_atual - a.modulo_atual)
                  .map(p => (
                    <div key={p.id} onClick={() => router.push(`/crm/parceiros/${p.id}`)}
                      className="rounded-xl p-3 cursor-pointer"
                      style={{ background: "#161b22", border: "1px solid #30363d" }}>
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="text-white font-bold text-sm">{p.nome}</p>
                          <p className="text-xs" style={{ color: "#8b949e" }}>{p.especialidade || "—"}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: "#c9a24a30", color: "#c9a24a" }}>
                          Módulo {p.modulo_atual}/8
                        </span>
                      </div>
                      <ModuloBar modulos={p.hub_parceiros_modulos || []} />
                      <div className="flex gap-3 mt-2 text-xs" style={{ color: "#484f58" }}>
                        <span>{p.hub_parceiros_modulos?.filter(m => m.status === "concluido").length || 0} concluídos</span>
                        {p.recebe_leads && <span style={{ color: "#34d399" }}>✓ Recebe leads</span>}
                      </div>
                    </div>
                  ))}
              </div>
            )
          )}

          {/* HOMOLOGADOS — grid */}
          {aba === "homologados" && (
            homologados.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-2xl mb-2">🏆</p>
                <p className="font-bold" style={{ color: "#e6edf3" }}>Nenhum parceiro homologado ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {homologados.map(p => (
                  <div key={p.id} onClick={() => router.push(`/crm/parceiros/${p.id}`)}
                    className="rounded-xl p-3 cursor-pointer"
                    style={{ background: "#161b22", border: "1px solid #003b2640", borderLeft: "3px solid #003b26" }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">{p.nome}</p>
                        <p className="text-xs" style={{ color: "#8b949e" }}>
                          {p.especialidade || "—"}{p.cidade ? ` · ${p.cidade}/${p.estado}` : ""}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0"
                        style={{ background: "#003b2630", color: "#34d399" }}>homologado</span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs" style={{ color: "#484f58" }}>
                      <span style={{ color: "#c9a24a" }}>{p.total_leads_recebidos} leads</span>
                      <span style={{ color: "#34d399" }}>{p.total_leads_convertidos} convertidos</span>
                      <span>{p.comissao_pct}% comissão</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

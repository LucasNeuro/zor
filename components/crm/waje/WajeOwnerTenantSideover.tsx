"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarClock,
  FileText,
  Loader2,
  QrCode,
  Receipt,
  Shield,
  Trash2,
} from "lucide-react";
import { CrmRetrofitSideoverShell } from "@/components/crm/CrmRetrofitSideoverShell";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import {
  WajeOwnerActionBtn,
  WajeOwnerRetrofitCard,
  WajeOwnerSectionHeading,
} from "@/components/crm/waje/WajeOwnerRetrofitUi";
import { WajeOwnerStatusBadge } from "@/components/crm/waje/WajeOwnerUi";
import {
  RF_ACCENT,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  rfBodyOnDarkStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

export type TenantRow = {
  id: string;
  slug: string;
  nome: string;
  ativo: boolean;
  cnpj: string | null;
  criado_em: string | null;
  trial_ate?: string | null;
};

export type TenantMensalidadeRow = {
  id: string;
  competencia: string;
  valor_reais: number;
  valor_centavos?: number;
  status: string;
  vencimento: string | null;
  pago_em: string | null;
  cora_invoice_id?: string | null;
  cora_boleto_url?: string | null;
  cora_pix_emv?: string | null;
  boleto_arquivo_url?: string | null;
  cora_status?: string | null;
  cora_erro?: string | null;
};

type TenantCadastro = {
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  pronto_cora: boolean;
  cora_emissao_bloqueada?: boolean;
  cora_emissao_motivo?: string | null;
};

type Props = {
  open: boolean;
  tenant: TenantRow | null;
  onClose: () => void;
  onUpdated: (tenant: TenantRow) => void;
  onBillingChanged?: () => void;
};

const TRIAL_PRESETS = [7, 14, 30];

function formatarData(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return v;
  }
}

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function trialAtivo(trialAte: string | null | undefined) {
  if (!trialAte) return false;
  return new Date(trialAte).getTime() > Date.now();
}

function vencimentoPadrao() {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toISOString().slice(0, 10);
}

export function WajeOwnerTenantSideover({ open, tenant, onClose, onUpdated, onBillingChanged }: Props) {
  const [salvando, setSalvando] = useState(false);
  const [carregandoPag, setCarregandoPag] = useState(false);
  const [carregandoCadastro, setCarregandoCadastro] = useState(false);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [trialDias, setTrialDias] = useState("14");
  const [mensalidades, setMensalidades] = useState<TenantMensalidadeRow[]>([]);
  const [maxMensalidades, setMaxMensalidades] = useState(12);
  const [cadastro, setCadastro] = useState<TenantCadastro | null>(null);
  const [valorPlano, setValorPlano] = useState("199");
  const [parcelas, setParcelas] = useState("12");
  const [primeiroVencimento, setPrimeiroVencimento] = useState(vencimentoPadrao);
  const [progressoBoletos, setProgressoBoletos] = useState("");

  const parcelasDisponiveis = Math.max(0, maxMensalidades - mensalidades.length);

  const carregarMensalidades = useCallback(
    async (opts?: { syncParent?: boolean }) => {
      const tenantId = tenant?.id;
      if (!tenantId) return;
      setCarregandoPag(true);
      try {
        const res = await fetch(`/api/ops/tenants/${tenantId}/pagamentos`, {
          headers: await opsApiHeaders(),
          credentials: "include",
        });
        const json = (await res.json()) as {
          data?: TenantMensalidadeRow[];
          max?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Falha ao carregar cobranças.");
        setMensalidades(json.data ?? []);
        if (json.max) setMaxMensalidades(json.max);
        if (opts?.syncParent) onBillingChanged?.();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar cobranças.");
      } finally {
        setCarregandoPag(false);
      }
    },
    [tenant?.id, onBillingChanged],
  );

  const carregarCadastro = useCallback(async () => {
    const tenantId = tenant?.id;
    if (!tenantId) return;
    setCarregandoCadastro(true);
    try {
      const res = await fetch(`/api/ops/tenants/${tenantId}`, {
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const json = (await res.json()) as {
        data?: TenantRow & { cadastro?: TenantCadastro };
        error?: string;
      };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Falha ao carregar cadastro.");
      setCadastro(json.data.cadastro ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar cadastro.");
    } finally {
      setCarregandoCadastro(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (open && tenant?.id) {
      setErro("");
      setInfo("");
      setPrimeiroVencimento(vencimentoPadrao());
      void carregarMensalidades();
      void carregarCadastro();
    }
  }, [open, tenant?.id, carregarMensalidades, carregarCadastro]);

  useEffect(() => {
    if (parcelasDisponiveis > 0) {
      setParcelas(String(Math.min(parcelasDisponiveis, 12)));
    }
  }, [parcelasDisponiveis]);

  async function patchTenant(body: Record<string, unknown>) {
    if (!tenant) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/ops/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { data?: TenantRow; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Falha ao atualizar.");
      onUpdated({ ...tenant, ...json.data, nome: json.data.nome ?? tenant.nome });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
      throw e;
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(v: boolean) {
    await patchTenant({ ativo: v });
  }

  async function aplicarTrial(dias: number) {
    await patchTenant({ trial_dias: dias });
  }

  async function limparTrial() {
    await patchTenant({ limpar_trial: true });
  }

  async function gerarBoletosPlano() {
    if (!tenant) return;
    setSalvando(true);
    setErro("");
    setInfo("");
    setProgressoBoletos("A emitir cobranças…");
    try {
      const valorCentavos = Math.round(parseFloat(valorPlano.replace(",", ".")) * 100);
      const numParcelas = Math.round(Number(parcelas));
      if (!Number.isFinite(valorCentavos) || valorCentavos < 500) {
        throw new Error("Valor mínimo do plano é R$ 5,00 por parcela.");
      }
      if (!Number.isFinite(numParcelas) || numParcelas < 1) {
        throw new Error("Informe o número de parcelas.");
      }
      if (numParcelas > parcelasDisponiveis) {
        throw new Error(`Máximo de ${parcelasDisponiveis} parcela(s) disponível(is).`);
      }
      if (!cadastro?.pronto_cora) {
        throw new Error(
          cadastro?.cora_emissao_motivo ??
            "Cadastro PJ incompleto — CNPJ obrigatório para emitir cobranças.",
        );
      }

      const res = await fetch(`/api/ops/tenants/${tenant.id}/cora-boletos`, {
        method: "POST",
        headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          valor_centavos: valorCentavos,
          parcelas: numParcelas,
          primeiro_vencimento: primeiroVencimento,
        }),
      });
      const json = (await res.json()) as {
        data?: TenantMensalidadeRow[];
        erros?: Array<{ parcela: number; error: string }>;
        resumo?: { emitidas: number; falhas: number; total_solicitado: number };
        error?: string;
      };

      const detalheErros =
        json.erros?.map((e) => `Parcela ${e.parcela}: ${e.error}`).join(" · ") ?? "";

      if (!res.ok && !json.data?.length) {
        throw new Error(detalheErros || json.error || "Falha ao gerar boletos.");
      }

      const emitidas = json.resumo?.emitidas ?? json.data?.length ?? 0;
      const falhas = json.resumo?.falhas ?? json.erros?.length ?? 0;

      if (emitidas === 0) {
        throw new Error(detalheErros || json.error || "Nenhum boleto foi emitido.");
      }

      if (falhas > 0) {
        const detalhe = json.erros?.map((e) => `Parcela ${e.parcela}: ${e.error}`).join(" · ");
        setErro(detalhe ?? `${falhas} parcela(s) falharam.`);
      }
      if (emitidas > 0) {
        setInfo(`${emitidas} boleto(s) emitido(s) com boleto + Pix.`);
      }

      await carregarMensalidades({ syncParent: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar boletos.");
    } finally {
      setSalvando(false);
      setProgressoBoletos("");
    }
  }

  async function patchMensalidade(id: string, body: Record<string, unknown>) {
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/ops/pagamentos/${id}`, {
        method: "PATCH",
        headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao atualizar cobrança.");
      await carregarMensalidades({ syncParent: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro na cobrança.");
    } finally {
      setSalvando(false);
    }
  }

  async function emitirCora(id: string, tipo: "boleto" | "pix") {
    setSalvando(true);
    setErro("");
    try {
      const path = tipo === "pix" ? "cora-pix" : "cora-boleto";
      const res = await fetch(`/api/ops/pagamentos/${id}/${path}`, {
        method: "POST",
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao emitir cobrança.");
      await carregarMensalidades({ syncParent: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao emitir cobrança.");
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarCora(id: string) {
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/ops/pagamentos/${id}/cora`, {
        method: "DELETE",
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao cancelar.");
      await carregarMensalidades({ syncParent: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao cancelar.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagarMensalidade(id: string) {
    if (!window.confirm("Apagar esta cobrança? Só é possível se o boleto ainda não foi emitido.")) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/ops/pagamentos/${id}`, {
        method: "DELETE",
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao apagar.");
      await carregarMensalidades({ syncParent: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao apagar cobrança.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagarTodasSemBoleto() {
    if (!tenant) return;
    if (
      !window.confirm(
        `Apagar ${semBoletoCount} cobrança(s) pendentes sem boleto emitido? Use isto para limpar testes antes de gerar de verdade.`,
      )
    ) {
      return;
    }
    setSalvando(true);
    setErro("");
    setInfo("");
    try {
      const res = await fetch(`/api/ops/tenants/${tenant.id}/pagamentos?sem_emissao=1`, {
        method: "DELETE",
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const json = (await res.json()) as { apagadas?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao apagar cobranças.");
      setInfo(`${json.apagadas ?? 0} cobrança(s) apagada(s).`);
      await carregarMensalidades({ syncParent: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao apagar cobranças.");
    } finally {
      setSalvando(false);
    }
  }

  const semBoletoCount = useMemo(
    () =>
      mensalidades.filter(
        (m) => !m.cora_invoice_id && m.status !== "pago" && m.status !== "cancelado",
      ).length,
    [mensalidades],
  );

  const emitidasCount = useMemo(
    () => mensalidades.filter((m) => Boolean(m.cora_invoice_id)).length,
    [mensalidades],
  );

  const emTrial = trialAtivo(tenant?.trial_ate);

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      wide
      kindLabel="Gestão do tenant"
      title={tenant?.nome ?? "Tenant"}
      subtitle={tenant?.slug ? `/${tenant.slug}` : undefined}
      icon={Building2}
      badge={
        tenant ? (
          <div className="flex flex-wrap gap-2">
            <WajeOwnerStatusBadge variant={tenant.ativo ? "ativo" : "inativo"} />
            {emTrial ? <WajeOwnerStatusBadge variant="pendente" label="Em teste" /> : null}
          </div>
        ) : null
      }
      footer={
        <div className="flex w-full justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="rounded-xl border px-4 py-2.5 text-xs font-bold disabled:opacity-50"
            style={{ borderColor: "rgba(146,255,0,0.25)", color: "#b8d4bc" }}
          >
            Fechar
          </button>
        </div>
      }
    >
      {!tenant ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin" style={{ color: RF_ACCENT }} size={22} />
        </div>
      ) : (
        <div className="space-y-1 pb-6">
          {erro ? (
            <p className="mb-4 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {erro}
            </p>
          ) : null}

          {info ? (
            <p className="mb-4 rounded-lg border border-[#92ff00]/30 bg-[#92ff00]/10 px-3 py-2 text-xs text-[#d4ffd0]">
              {info}
            </p>
          ) : null}

          <WajeOwnerSectionHeading icon={Shield}>ACESSO À PLATAFORMA</WajeOwnerSectionHeading>

          <WajeOwnerRetrofitCard
            icon={Shield}
            title="Tenant activo"
            description="Com acesso operacional ao CRM. Desactivar bloqueia login sem apagar dados."
            statusLabel={tenant.ativo ? "ACTIVO" : "INACTIVO"}
            statusActive={tenant.ativo}
            right={
              <CrmToggleSwitch
                variant="dark"
                checked={tenant.ativo}
                disabled={salvando}
                onCheckedChange={(v) => void alternarAtivo(v)}
              />
            }
          />

          <WajeOwnerRetrofitCard
            icon={CalendarClock}
            title="Desactivação automática"
            description="Após o trial, se não houver mensalidade paga, o cron diário desactiva o tenant."
            statusLabel="CRON"
            statusActive={Boolean(tenant.trial_ate)}
          />

          <WajeOwnerSectionHeading icon={CalendarClock}>PERÍODO DE TESTE</WajeOwnerSectionHeading>

          <WajeOwnerRetrofitCard
            icon={CalendarClock}
            title="Trial do tenant"
            description={
              tenant.trial_ate
                ? `Válido até ${formatarData(tenant.trial_ate)}`
                : "Nenhum período de teste configurado."
            }
            statusLabel={emTrial ? "EM TESTE" : tenant.trial_ate ? "EXPIRADO" : "SEM TRIAL"}
            statusActive={emTrial}
          >
            <div className="flex flex-wrap gap-2 pl-[54px]">
              {TRIAL_PRESETS.map((d) => (
                <WajeOwnerActionBtn
                  key={d}
                  disabled={salvando}
                  onClick={() => void aplicarTrial(d)}
                >
                  {d} dias
                </WajeOwnerActionBtn>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2 pl-[54px]">
              <label style={RF_LABEL_STYLE}>
                Dias
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={trialDias}
                  onChange={(e) => setTrialDias(e.target.value)}
                  style={{ ...RF_INPUT_STYLE, width: 72, marginTop: 4 }}
                />
              </label>
              <WajeOwnerActionBtn
                variant="primary"
                disabled={salvando}
                onClick={() => void aplicarTrial(Number(trialDias))}
              >
                Aplicar
              </WajeOwnerActionBtn>
              {tenant.trial_ate ? (
                <WajeOwnerActionBtn
                  variant="danger"
                  disabled={salvando}
                  onClick={() => void limparTrial()}
                >
                  Remover trial
                </WajeOwnerActionBtn>
              ) : null}
            </div>
          </WajeOwnerRetrofitCard>

          <WajeOwnerSectionHeading icon={FileText}>DADOS DO CADASTRO</WajeOwnerSectionHeading>

          <WajeOwnerRetrofitCard
            icon={FileText}
            title="Dados para faturamento"
            description={
              carregandoCadastro
                ? "A carregar dados do cadastro…"
                : cadastro?.cora_emissao_bloqueada
                  ? cadastro.cora_emissao_motivo ??
                    "CNPJ igual ao da conta Cora emissora — não é possível emitir boleto."
                  : cadastro?.pronto_cora
                    ? "CNPJ e endereço serão usados na emissão dos boletos."
                    : "Complete o cadastro PJ do tenant (CNPJ) para emitir cobranças."
            }
            statusLabel={
              cadastro?.cora_emissao_bloqueada
                ? "BLOQUEADO"
                : cadastro?.pronto_cora
                  ? "OK"
                  : "INCOMPLETO"
            }
            statusActive={Boolean(cadastro?.pronto_cora) && !cadastro?.cora_emissao_bloqueada}
          >
            <div className="space-y-1 pl-[54px] text-xs" style={rfBodyOnDarkStyle()}>
              <p>CNPJ: {cadastro?.cnpj ?? tenant.cnpj ?? "—"}</p>
              <p>Razão social: {cadastro?.razao_social ?? "—"}</p>
              <p>E-mail: {cadastro?.email ?? "—"}</p>
              <p>Telefone: {cadastro?.telefone ?? "—"}</p>
              <p>Endereço: {cadastro?.endereco ?? "—"}</p>
            </div>
          </WajeOwnerRetrofitCard>

          <WajeOwnerSectionHeading icon={Banknote}>
            COBRANÇAS ({mensalidades.length}/{maxMensalidades})
          </WajeOwnerSectionHeading>

          {parcelasDisponiveis > 0 ? (
            <WajeOwnerRetrofitCard
              icon={Receipt}
              title="Gerar plano de cobrança"
              description="Define valor mensal, parcelas e emite boleto + Pix para o cliente."
              statusLabel="EMISSÃO"
              statusActive={Boolean(cadastro?.pronto_cora)}
            >
              <div className="grid gap-3 pl-[54px] sm:grid-cols-3">
                <label style={RF_LABEL_STYLE}>
                  Valor do plano (R$/mês)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valorPlano}
                    onChange={(e) => setValorPlano(e.target.value)}
                    style={{ ...RF_INPUT_STYLE, marginTop: 4 }}
                  />
                </label>
                <label style={RF_LABEL_STYLE}>
                  Parcelas (máx. {parcelasDisponiveis})
                  <input
                    type="number"
                    min={1}
                    max={parcelasDisponiveis}
                    value={parcelas}
                    onChange={(e) => setParcelas(e.target.value)}
                    style={{ ...RF_INPUT_STYLE, marginTop: 4 }}
                  />
                </label>
                <label style={RF_LABEL_STYLE}>
                  1º vencimento
                  <input
                    type="date"
                    value={primeiroVencimento}
                    onChange={(e) => setPrimeiroVencimento(e.target.value)}
                    style={{ ...RF_INPUT_STYLE, marginTop: 4 }}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-[54px] pt-2">
                <WajeOwnerActionBtn
                  variant="primary"
                  disabled={salvando || !cadastro?.pronto_cora}
                  onClick={() => void gerarBoletosPlano()}
                >
                  {salvando ? "A gerar…" : `Gerar ${parcelas} boleto(s)`}
                </WajeOwnerActionBtn>
                {progressoBoletos ? (
                  <span className="text-[10px]" style={{ color: "#b8d4bc" }}>
                    {progressoBoletos}
                  </span>
                ) : null}
              </div>
            </WajeOwnerRetrofitCard>
          ) : null}

          {semBoletoCount > 0 ? (
            <WajeOwnerRetrofitCard
              icon={Trash2}
              title={`${semBoletoCount} cobrança(s) sem boleto`}
              description="Registos no sistema sem emissão — não existem no banco emissor. Apague para testar de novo."
              statusLabel="RASCUNHO"
              statusActive={false}
            >
              <div className="pl-[54px] pt-1">
                <WajeOwnerActionBtn
                  variant="danger"
                  disabled={salvando}
                  onClick={() => void apagarTodasSemBoleto()}
                >
                  Apagar todas sem boleto
                </WajeOwnerActionBtn>
              </div>
            </WajeOwnerRetrofitCard>
          ) : null}

          {mensalidades.length > 0 ? (
            <p className="mb-2 px-1 text-xs" style={rfBodyOnDarkStyle()}>
              {emitidasCount > 0
                ? "Cobranças com boleto — abra o PDF ou copie o Pix de cada parcela."
                : "Nenhum boleto emitido ainda para este tenant."}
            </p>
          ) : null}

          {carregandoPag ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin" style={{ color: RF_ACCENT }} size={20} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {mensalidades.map((m) => {
                const pago = m.status === "pago";
                const temCora = Boolean(m.cora_invoice_id);
                return (
                  <WajeOwnerRetrofitCard
                    key={m.id}
                    icon={temCora ? QrCode : Receipt}
                    title={`${formatarData(m.competencia)} · ${formatarMoeda(m.valor_reais)}`}
                    description={`Venc. ${formatarData(m.vencimento)} · ${m.status}`}
                    statusLabel={pago ? "PAGO" : temCora ? "COBRANÇA" : "PENDENTE"}
                    statusActive={pago}
                  >
                    <div className="flex flex-wrap gap-2 pl-[54px]">
                      {!temCora && !pago ? (
                        <>
                          <WajeOwnerActionBtn
                            variant="primary"
                            disabled={salvando}
                            onClick={() => void emitirCora(m.id, "boleto")}
                          >
                            Boleto
                          </WajeOwnerActionBtn>
                          <WajeOwnerActionBtn
                            disabled={salvando}
                            onClick={() => void emitirCora(m.id, "pix")}
                          >
                            Pix
                          </WajeOwnerActionBtn>
                        </>
                      ) : null}
                      {m.boleto_arquivo_url || m.cora_boleto_url ? (
                        <a
                          href={m.boleto_arquivo_url ?? m.cora_boleto_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold underline"
                          style={{ color: RF_ACCENT }}
                        >
                          PDF boleto
                        </a>
                      ) : null}
                      {m.cora_pix_emv ? (
                        <WajeOwnerActionBtn
                          disabled={salvando}
                          onClick={() => {
                            void navigator.clipboard.writeText(m.cora_pix_emv!);
                          }}
                        >
                          Copiar Pix
                        </WajeOwnerActionBtn>
                      ) : null}
                      {!pago && m.status !== "cancelado" ? (
                        <WajeOwnerActionBtn
                          disabled={salvando}
                          onClick={() => void patchMensalidade(m.id, { status: "pago" })}
                        >
                          Marcar pago
                        </WajeOwnerActionBtn>
                      ) : null}
                      {!temCora && !pago && m.status !== "cancelado" ? (
                        <WajeOwnerActionBtn
                          variant="danger"
                          disabled={salvando}
                          onClick={() => void apagarMensalidade(m.id)}
                        >
                          <Trash2 size={12} className="mr-1 inline" />
                          Apagar
                        </WajeOwnerActionBtn>
                      ) : null}
                      {temCora && !pago ? (
                        <WajeOwnerActionBtn
                          variant="danger"
                          disabled={salvando}
                          onClick={() => void cancelarCora(m.id)}
                        >
                          <Trash2 size={12} className="mr-1 inline" />
                          Cancelar
                        </WajeOwnerActionBtn>
                      ) : null}
                    </div>
                  </WajeOwnerRetrofitCard>
                );
              })}
            </div>
          )}

        </div>
      )}
    </CrmRetrofitSideoverShell>
  );
}

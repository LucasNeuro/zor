"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { WajeBrand } from "@/components/brand/WajeBrand";
import { formatCep, formatCnpj, formatCpf, isValidCnpj, isValidCpf, onlyDigits } from "@/lib/brasil-docs";
import { supabase } from "@/lib/supabase/client";
import { getSafeReturnPath } from "@/lib/auth/safe-return-path";

type CnpjLookupResponse = {
  ok: boolean;
  error?: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  situacao_cadastral?: string | null;
  endereco?: {
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
  };
  email?: string | null;
};

type CepLookupResponse = {
  ok: boolean;
  error?: string;
  cep?: string;
  logradouro?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
};

type TenantCreateResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  tenant?: { id: string; slug: string; nome_exibicao: string };
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
}

type FormData = {
  registrationType: "PJ" | "PF";
  companyName: string;
  tradeName: string;
  cpf: string;
  cnpj: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  contactName: string;
  contactEmail: string;
  password: string;
  contactPhone: string;
};

const INITIAL_FORM: FormData = {
  registrationType: "PJ",
  companyName: "",
  tradeName: "",
  cpf: "",
  cnpj: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  contactName: "",
  contactEmail: "",
  password: "",
  contactPhone: "",
};

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const cpfDigits = useMemo(() => onlyDigits(form.cpf), [form.cpf]);
  const cnpjDigits = useMemo(() => onlyDigits(form.cnpj), [form.cnpj]);
  const cepDigits = useMemo(() => onlyDigits(form.cep), [form.cep]);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFetchCnpj() {
    setError(null);
    setSuccess(null);
    if (form.registrationType !== "PJ") return;
    if (!isValidCnpj(cnpjDigits)) {
      setError("Informe um CNPJ válido para buscar os dados.");
      return;
    }

    setCnpjLoading(true);
    try {
      const res = await fetch(`/api/public/lookup/cnpj?cnpj=${cnpjDigits}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as CnpjLookupResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível consultar este CNPJ.");
        return;
      }

      setForm((prev) => ({
        ...prev,
        companyName: data.razao_social || prev.companyName,
        tradeName: data.nome_fantasia || prev.tradeName,
        cep: data.endereco?.cep ? formatCep(data.endereco.cep) : prev.cep,
        logradouro: data.endereco?.logradouro || prev.logradouro,
        numero: data.endereco?.numero || prev.numero,
        complemento: data.endereco?.complemento || prev.complemento,
        bairro: data.endereco?.bairro || prev.bairro,
        cidade: data.endereco?.cidade || prev.cidade,
        uf: data.endereco?.uf || prev.uf,
        contactEmail: data.email || prev.contactEmail,
      }));

      if ((data.situacao_cadastral ?? "").toLowerCase() !== "ativa") {
        setError("Empresa encontrada, mas a situação cadastral não está como ativa. Revise antes de continuar.");
      }
    } catch {
      setError("Falha de rede ao consultar CNPJ.");
    } finally {
      setCnpjLoading(false);
    }
  }

  async function handleFetchCep() {
    setError(null);
    setSuccess(null);
    if (cepDigits.length !== 8) {
      setError("Informe um CEP válido com 8 dígitos.");
      return;
    }

    setCepLoading(true);
    try {
      const res = await fetch(`/api/public/lookup/cep?cep=${cepDigits}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as CepLookupResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível consultar este CEP.");
        return;
      }

      setForm((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cidade: data.cidade || prev.cidade,
        uf: data.uf || prev.uf,
      }));
    } catch {
      setError("Falha de rede ao consultar CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (form.registrationType === "PJ" && !isValidCnpj(cnpjDigits)) {
      setError("CNPJ inválido.");
      return;
    }
    if (form.registrationType === "PF" && !isValidCpf(cpfDigits)) {
      setError("CPF inválido.");
      return;
    }
    if (!isValidEmail(form.contactEmail)) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (!isValidPhone(form.contactPhone)) {
      setError("Informe um telefone válido com DDD.");
      return;
    }
    if (form.uf.trim().length !== 2) {
      setError("UF inválida. Use 2 letras (ex.: SP).");
      return;
    }
    if (form.password.trim().length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const authRes = await fetch("/api/public/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.contactEmail.trim().toLowerCase(),
          password: form.password,
          fullName: form.contactName.trim(),
        }),
      });
      const authData = (await authRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        user?: { id: string };
        session?: { access_token: string; expires_in: number } | null;
      };
      if (!authRes.ok || !authData.ok) {
        setError(authData.error || "Não foi possível criar a conta no Supabase.");
        return;
      }
      const authUserId = authData.user?.id;
      if (!authUserId) {
        setError("Não foi possível obter o ID do usuário no Supabase Auth.");
        return;
      }

      const res = await fetch("/api/public/onboarding/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          authUserId,
          cpf: cpfDigits,
          cnpj: cnpjDigits,
          cep: cepDigits,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as TenantCreateResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível iniciar o tenant.");
        await supabase.auth.signOut();
        return;
      }

      const session = authData.session;
      if (session?.access_token) {
        const sync = await fetch("/api/auth/crm-session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: session.access_token,
            expires_in: session.expires_in,
          }),
        });
        if (sync.ok) {
          router.push(getSafeReturnPath("/crm", "/crm"));
          router.refresh();
          return;
        }
      }

      setSuccess(
        `${data.tenant?.nome_exibicao ?? "Tenant"} criado com sucesso (${data.tenant?.slug ?? "-"}). Verifique seu e-mail para confirmar o acesso e depois entre no login.`,
      );
      setForm(INITIAL_FORM);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg && /failed to fetch/i.test(msg)
          ? "Falha de rede ao contactar o servidor. Verifique se o dev server está a correr e recarregue a página."
          : "Falha de rede ao criar conta.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tivia-landing-bg min-h-[100dvh] overflow-hidden text-[#1c2a1c]">
      <div className="flex min-h-[100dvh]">
        <aside className="h-[100dvh] w-full overflow-y-auto border-r border-[#d7e5d3] bg-white/95 md:w-[560px] md:min-w-[500px]">
          <div className="mx-auto w-full max-w-[540px] p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <WajeBrand layout="horizontal" tone="brand" className="items-start text-left" />
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#3f5b44] hover:text-[#1f3a24]">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </div>

            <h1 className="mb-2 text-3xl font-bold text-[#132a17]">Criar conta</h1>
            <p className="mb-8 text-sm text-[#58745d]">
              Cadastre sua operação, defina a senha e acesse o Waje.
            </p>

            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <fieldset className="space-y-1.5 md:col-span-2">
                <span className="text-xs text-[#5a745d]">Tipo de cadastro</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setField("registrationType", "PJ")}
                    className={`h-10 rounded-lg border px-4 text-sm font-semibold transition ${
                      form.registrationType === "PJ"
                        ? "border-[#92ff00]/50 bg-[#ecffd8] text-[#1e3a23]"
                        : "border-[#d5e2d2] bg-white text-[#5a745d]"
                    }`}
                  >
                    Pessoa Jurídica (CNPJ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("registrationType", "PF")}
                    className={`h-10 rounded-lg border px-4 text-sm font-semibold transition ${
                      form.registrationType === "PF"
                        ? "border-[#92ff00]/50 bg-[#ecffd8] text-[#1e3a23]"
                        : "border-[#d5e2d2] bg-white text-[#5a745d]"
                    }`}
                  >
                    Pessoa Física (CPF)
                  </button>
                </div>
              </fieldset>

              {form.registrationType === "PJ" ? (
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs text-[#5a745d]">
                    CNPJ {cnpjLoading ? "• consultando..." : ""}
                  </span>
                  <input
                    required
                    value={form.cnpj}
                    onChange={(e) => setField("cnpj", formatCnpj(e.target.value))}
                    onBlur={() => {
                      if (isValidCnpj(cnpjDigits)) {
                        void handleFetchCnpj();
                      }
                    }}
                    className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                    placeholder="00.000.000/0000-00"
                  />
                </label>
              ) : (
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs text-[#5a745d]">CPF</span>
                  <input
                    required
                    value={form.cpf}
                    onChange={(e) => setField("cpf", formatCpf(e.target.value))}
                    onBlur={() => {
                      if (cpfDigits && !isValidCpf(cpfDigits)) {
                        setError("CPF inválido.");
                      }
                    }}
                    className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                    placeholder="000.000.000-00"
                  />
                </label>
              )}

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs text-[#5a745d]">
                  {form.registrationType === "PJ" ? "Razão social" : "Nome completo"}
                </span>
                <input
                  required
                  value={form.companyName}
                  onChange={(e) => setField("companyName", e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                  placeholder={form.registrationType === "PJ" ? "Empresa Exemplo LTDA" : "Seu nome completo"}
                />
              </label>

              {form.registrationType === "PJ" && (
                <label className="space-y-1.5">
                  <span className="text-xs text-[#5a745d]">Nome fantasia</span>
                  <input
                    value={form.tradeName}
                    onChange={(e) => setField("tradeName", e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                    placeholder="Marca Comercial"
                  />
                </label>
              )}

              <div className="space-y-1.5">
                <span className="text-xs text-[#5a745d]">CEP {cepLoading ? "• consultando..." : ""}</span>
                <input
                  value={form.cep}
                  onChange={(e) => setField("cep", formatCep(e.target.value))}
                  onBlur={() => {
                    if (cepDigits.length === 8) {
                      void handleFetchCep();
                    }
                  }}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                  placeholder="00000-000"
                />
              </div>

              <label className="space-y-1.5">
                <span className="text-xs text-[#5a745d]">Logradouro</span>
                <input
                  value={form.logradouro}
                  onChange={(e) => setField("logradouro", e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-[#5a745d]">Número</span>
                <input
                  value={form.numero}
                  onChange={(e) => setField("numero", e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-[#5a745d]">Complemento</span>
                <input
                  value={form.complemento}
                  onChange={(e) => setField("complemento", e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-[#5a745d]">Bairro</span>
                <input
                  value={form.bairro}
                  onChange={(e) => setField("bairro", e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-[#5a745d]">Cidade</span>
                <input
                  value={form.cidade}
                  onChange={(e) => setField("cidade", e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-[#5a745d]">UF</span>
                <input
                  value={form.uf}
                  onChange={(e) => setField("uf", e.target.value.toUpperCase().slice(0, 2))}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm uppercase text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                  placeholder="SP"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-[#5a745d]">Nome do responsável</span>
                <input
                  required
                  value={form.contactName}
                  onChange={(e) => setField("contactName", e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                  placeholder="Seu nome"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs text-[#5a745d]">E-mail de acesso</span>
                <input
                  required
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setField("contactEmail", e.target.value)}
                  onBlur={() => {
                    if (form.contactEmail && !isValidEmail(form.contactEmail)) {
                      setError("Informe um e-mail válido.");
                    }
                  }}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                  placeholder="owner@empresa.com.br"
                />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs text-[#5a745d]">Senha de acesso</span>
                <div className="relative">
                  <input
                    required
                    minLength={6}
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white py-3 pl-3 pr-12 text-sm text-[#1e3a23] outline-none transition placeholder:text-[#7f9481] focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-lg text-[#6d846f] transition-colors hover:text-[#3f9848] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#92ff00]/50"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-[18px] w-[18px]" aria-hidden />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" aria-hidden />
                    )}
                  </button>
                </div>
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs text-[#5a745d]">Telefone do responsável</span>
                <input
                  required
                  value={form.contactPhone}
                  onChange={(e) => setField("contactPhone", formatPhone(e.target.value))}
                  onBlur={() => {
                    if (form.contactPhone && !isValidPhone(form.contactPhone)) {
                      setError("Informe um telefone válido com DDD.");
                    }
                  }}
                  className="h-11 w-full rounded-lg border border-[#d5e2d2] bg-white px-3 text-sm text-[#1e3a23] outline-none transition focus:border-[#92ff00]/50 focus:ring-2 focus:ring-[#92ff00]/20"
                  placeholder="(11) 99999-9999"
                />
              </label>

              {error && (
                <div className="rounded-lg border border-[#f4b4b1] bg-[#fff5f5] px-3 py-2 text-sm text-[#9d2f2f] md:col-span-2">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-[#b9e9c5] bg-[#f3fff6] px-3 py-2 text-sm text-[#216e38] md:col-span-2">
                  {success}
                </div>
              )}

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#92ff00]/35 bg-[#92ff00] px-5 text-sm font-bold text-[#0a1206] transition hover:brightness-95 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {submitting ? "Criando conta..." : "Criar conta Waje"}
                </button>
              </div>
            </form>
          </div>
        </aside>

        <section className="relative hidden h-[100dvh] flex-1 overflow-hidden md:block bg-[radial-gradient(ellipse_at_22%_15%,rgba(146,255,0,0.16),transparent_52%),radial-gradient(ellipse_at_80%_85%,rgba(63,152,72,0.13),transparent_50%),linear-gradient(148deg,#f6fdf4,#ecf8e8_45%,#f2faf0)]">
          {/* decorative orbs */}
          <div className="tivia-float pointer-events-none absolute left-[12%] top-[20%] h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(146,255,0,0.17),transparent_65%)]" />
          <div className="tivia-float pointer-events-none absolute bottom-[22%] right-[15%] h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(63,152,72,0.14),transparent_68%)] [animation-delay:1.6s]" />
          <div className="tivia-float pointer-events-none absolute left-[35%] top-[55%] h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(146,255,0,0.11),transparent_70%)] [animation-delay:0.9s]" />
          {/* tagline */}
          <div className="absolute right-10 top-10 max-w-sm text-right">
            <p className="text-2xl font-extrabold leading-snug text-[#0b1f10]">
              Comece com onboarding guiado e leve seu atendimento para outro nível.
            </p>
            <p className="mt-2 text-sm text-[#4f6853]">Pronto em minutos. Sem cartão de crédito.</p>
          </div>
          {/* steps preview */}
          <div className="absolute bottom-10 left-10 space-y-2">
            {[
              { n: "1", label: "Crie sua conta" },
              { n: "2", label: "Configure seu agente" },
              { n: "3", label: "Conecte o WhatsApp" },
            ].map(({ n, label }) => (
              <div key={n} className="flex items-center gap-3 rounded-xl border border-[#c8e6c0] bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b1f10] text-xs font-bold text-[#92ff00]">
                  {n}
                </span>
                <span className="text-xs font-semibold text-[#1f3822]">{label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

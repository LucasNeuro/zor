"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { WajeBrand } from "@/components/brand/WajeBrand";
import { WajeWordmark } from "@/components/brand/WajeWordmark";
import { getSafeReturnPath } from "@/lib/auth/safe-return-path";

function messageForAuthRequestFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  const isNetwork =
    err instanceof TypeError ||
    msg === "Failed to fetch" ||
    /failed to fetch|networkerror|load failed/i.test(msg);
  if (!isNetwork) {
    return msg || "Não foi possível iniciar sessão. Tente novamente.";
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urlHint =
    !url || !/^https?:\/\//i.test(url)
      ? " NEXT_PUBLIC_SUPABASE_URL no .env.local deve ser uma URL válida (ex.: https://xxxxx.supabase.co ou http://127.0.0.1:54321)."
      : "";
  return (
    "Não foi possível contactar o servidor de autenticação (Supabase). Verifique: ligação à Internet; URL e chave em .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY); reinicie o servidor após alterar o .env; no dashboard Supabase confirme que o projeto não está em pausa." +
    urlHint +
    (typeof window !== "undefined" && /^http:\/\/(127\.0\.0\.1|localhost):/i.test(window.location.origin)
      ? " Se usar Supabase local (CLI), deixe supabase start a correr e confira CORS/additional redirects para este origin."
      : "")
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "nao_autorizado") {
      void fetch("/api/auth/crm-session", { method: "DELETE", credentials: "include" }).then(() =>
        supabase.auth.signOut().then(() => {
          setMsg("Este e-mail não tem permissão para acessar a plataforma. Contate o administrador.");
        })
      );
    }
    if (searchParams.get("sessao") === "invalida") {
      setMsg("Sessão expirada ou inválida no navegador. Entre novamente.");
    }
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"];
    try {
      const result = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (result.error) {
        setLoading(false);
        setMsg(result.error.message);
        return;
      }
      data = result.data;
    } catch (err) {
      setLoading(false);
      setMsg(messageForAuthRequestFailure(err));
      return;
    }
    const access_token = data.session?.access_token;
    if (!access_token) {
      setLoading(false);
      setMsg("Sessão indisponível. Tente novamente.");
      return;
    }
    const sync = await fetch("/api/auth/crm-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token,
        expires_in: data.session.expires_in,
      }),
    });
    const raw = await sync.text();
    let body: { error?: string } = {};
    try {
      body = raw ? (JSON.parse(raw) as { error?: string }) : {};
    } catch {
      body = {};
    }
    if (!sync.ok) {
      await supabase.auth.signOut();
      setLoading(false);
      const apiMsg = typeof body?.error === "string" ? body.error : null;
      setMsg(
        apiMsg ??
          `Não foi possível concluir o login (código ${sync.status}). Contacte o administrador ou tente novamente.`,
      );
      return;
    }
    setLoading(false);
    const next = searchParams.get("next");
    const destino = getSafeReturnPath(next, "/crm");
    router.push(destino);
    router.refresh();
    // Fallback se o router client não hidratar (ex.: chunks bloqueados pelo IP da rede).
    window.setTimeout(() => {
      if (window.location.pathname.startsWith("/login")) {
        window.location.assign(destino);
      }
    }, 500);
  }

  function alternarVisibilidadeSenha() {
    setShowPassword((v) => !v);
    const el = document.getElementById("login-password");
    if (el instanceof HTMLInputElement) {
      el.type = el.type === "password" ? "text" : "password";
    }
  }

  return (
    <div className="waje-auth-bg h-[100dvh] overflow-hidden">
      <style jsx global>{`
        #login-email:-webkit-autofill,
        #login-email:-webkit-autofill:hover,
        #login-email:-webkit-autofill:focus,
        #login-email:-webkit-autofill:active,
        #login-password:-webkit-autofill,
        #login-password:-webkit-autofill:hover,
        #login-password:-webkit-autofill:focus,
        #login-password:-webkit-autofill:active {
          -webkit-text-fill-color: #1e3a23;
          caret-color: #1e3a23;
          box-shadow: 0 0 0 1000px #ffffff inset;
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>
      <div className="flex h-full">
        <aside className="flex h-full w-full flex-col border-r border-[#d7e5d3] bg-white/95 md:w-[460px] md:min-w-[420px]">
          <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center p-6 text-[#1c2a1c] md:p-8">
            <div className="mb-10 flex items-center justify-between">
              <WajeBrand layout="horizontal" tone="brand" />
              <Link href="/" className="text-xs font-medium text-[#3f5b44] hover:text-[#1f3a24]">
                Voltar
              </Link>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                aria-label="E-mail de acesso"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail de acesso"
                className="w-full rounded-xl border border-[#d5e2d2] bg-white px-4 py-3.5 text-[15px] text-[#1e3a23] transition-[border-color,box-shadow] placeholder:text-[#7f9481] focus:border-[#92ff00]/55 focus:outline-none focus:ring-2 focus:ring-[#92ff00]/20"
              />
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  aria-label="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  className="w-full rounded-xl border border-[#d5e2d2] bg-white py-3.5 pl-4 pr-12 text-[15px] text-[#1e3a23] transition-[border-color,box-shadow] placeholder:text-[#7f9481] focus:border-[#92ff00]/55 focus:outline-none focus:ring-2 focus:ring-[#92ff00]/20"
                />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-xl text-[#6d846f] transition-colors hover:text-[#3f9848] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#92ff00]/50"
                    onClick={alternarVisibilidadeSenha}
                  >
                    {showPassword ? (
                      <EyeOff className="h-[18px] w-[18px]" aria-hidden />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" aria-hidden />
                    )}
                  </button>
              </div>

              {msg && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#f4b4b1] bg-[#fff5f5] px-4 py-3 text-sm leading-snug text-[#9d2f2f]"
                >
                  {msg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#92ff00]/35 bg-[#92ff00] py-3.5 text-[15px] font-semibold tracking-wide text-[#091107] transition-[transform,opacity,box-shadow] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-55"
                style={{
                  boxShadow: "0 12px 28px rgba(140, 255, 0, 0.18)",
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                <span>{loading ? "Autorizando..." : "Entrar"}</span>
                <Zap className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-[#5f745f]">
              Ainda não tem conta?{" "}
              <Link href="/cadastro" className="font-semibold text-[#1f3a24] underline-offset-2 hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        </aside>

        <section className="relative hidden h-full flex-1 overflow-hidden md:block bg-[radial-gradient(ellipse_at_25%_18%,rgba(146,255,0,0.16),transparent_52%),radial-gradient(ellipse_at_78%_82%,rgba(63,152,72,0.13),transparent_50%),linear-gradient(145deg,#f6fdf4,#ecf8e8_45%,#f2faf0)]">
          {/* decorative floating orbs */}
          <div className="waje-deco-float pointer-events-none absolute left-[10%] top-[15%] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(146,255,0,0.18),transparent_65%)]" />
          <div className="waje-deco-float pointer-events-none absolute bottom-[18%] right-[12%] h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(63,152,72,0.15),transparent_68%)] [animation-delay:1.5s]" />
          <div className="waje-deco-float pointer-events-none absolute right-[30%] top-[40%] h-20 w-20 rounded-full bg-[radial-gradient(circle,rgba(146,255,0,0.12),transparent_70%)] [animation-delay:0.8s]" />
          {/* tagline */}
          <div className="absolute right-10 top-10 max-w-sm text-right">
            <p className="text-2xl font-extrabold leading-snug text-[#0b1f10]">
              Operações, leads e atendimento em uma plataforma só.
            </p>
            <p className="mt-2 text-sm text-[#4f6853]">Entre com sua conta e continue de onde parou.</p>
          </div>
          {/* bottom illustration hint */}
          <div className="absolute bottom-10 left-10 flex items-center gap-3 rounded-2xl border border-[#c8e6c0] bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#92ff00]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2 L10 6 L14 7 L11 10 L11.5 14 L8 12 L4.5 14 L5 10 L2 7 L6 6 Z" fill="#0b1f10"/>
              </svg>
            </span>
            <div>
              <p className="text-xs font-bold">
                <WajeWordmark size="sm" tone="brand" />
              </p>
              <p className="text-[11px] text-[#527055]">Atendimento com IA</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div
      className="waje-auth-bg flex h-[100dvh] items-center justify-center text-sm text-[#527055]"
    >
      Carregando…
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

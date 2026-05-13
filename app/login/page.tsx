"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Obra10BrandHeader } from "@/components/brand/Obra10Brand";
import { LoginHeroPanel } from "@/components/login/LoginHeroPanel";
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
    router.push(getSafeReturnPath(next, "/office"));
    router.refresh();
  }

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-[var(--obra-dark,#0d1117)] md:flex-row">
      <style jsx global>{`
        #login-email:-webkit-autofill,
        #login-email:-webkit-autofill:hover,
        #login-email:-webkit-autofill:focus,
        #login-email:-webkit-autofill:active,
        #login-password:-webkit-autofill,
        #login-password:-webkit-autofill:hover,
        #login-password:-webkit-autofill:focus,
        #login-password:-webkit-autofill:active {
          -webkit-text-fill-color: var(--obra-texto, #e6edf3);
          caret-color: var(--obra-texto, #e6edf3);
          box-shadow: 0 0 0 1000px var(--obra-dark-2, #161b22) inset;
          -webkit-box-shadow: 0 0 0 1000px var(--obra-dark-2, #161b22) inset;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>
      {/* Painel do formulário — esquerda no desktop, abaixo do hero no mobile */}
      <div className="order-2 flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 md:order-1 md:w-[46%] md:max-w-xl md:flex-none md:px-12 lg:px-14 xl:px-16">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-10">
            <Obra10BrandHeader
              size="lg"
              subtitle="Plataforma"
              subtitleClassName="!text-[var(--obra-dourado,#c9a24a)] !tracking-[0.12em]"
            />
          
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="text-xs font-medium uppercase tracking-wide text-[var(--obra-texto-2,#8b949e)]"
              >
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                className="w-full rounded-xl border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)] px-4 py-3 text-[15px] text-[var(--obra-texto,#e6edf3)] transition-[border-color,box-shadow] placeholder:text-[var(--obra-texto-3,#484f58)] focus:border-[var(--obra-dourado,#c9a24a)] focus:outline-none focus:ring-1 focus:ring-[var(--obra-dourado,#c9a24a)]/35"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="text-xs font-medium uppercase tracking-wide text-[var(--obra-texto-2,#8b949e)]"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)] py-3 pl-4 pr-12 text-[15px] text-[var(--obra-texto,#e6edf3)] transition-[border-color,box-shadow] placeholder:text-[var(--obra-texto-3,#484f58)] focus:border-[var(--obra-dourado,#c9a24a)] focus:outline-none focus:ring-1 focus:ring-[var(--obra-dourado,#c9a24a)]/35"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-xl text-[var(--obra-texto-2,#8b949e)] transition-colors hover:text-[var(--obra-dourado,#c9a24a)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--obra-dourado,#c9a24a)]/50"
                  onClick={() => setShowPassword((v: boolean) => !v)}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
                </button>
              </div>
            </div>

            {msg && (
              <div
                role="alert"
                className="rounded-xl border border-[rgba(248,81,73,0.35)] bg-[rgba(179,38,30,0.08)] px-4 py-3 text-sm leading-snug text-[#f0aba8]"
              >
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-[rgba(201,162,74,0.22)] py-3.5 text-[15px] font-semibold tracking-wide text-[var(--obra-dourado-light,#e0b86a)] transition-[transform,opacity,box-shadow] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-55"
              style={{
                background: "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
                boxShadow: "0 8px 24px rgba(0, 40, 26, 0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-10 text-center text-[11px] leading-relaxed text-[var(--obra-texto-3,#484f58)]">
            Problemas para entrar? Contate o administrador da sua organização.
          </p>
        </div>
      </div>

      <LoginHeroPanel />
    </div>
  );
}

function LoginFallback() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center bg-[var(--obra-dark,#0d1117)] text-sm text-[var(--obra-texto-2,#8b949e)]"
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

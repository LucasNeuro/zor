/** Cookie httpOnly lido pelo `proxy.ts` para sessão CRM (sem @supabase/ssr). */
export const CRM_ACCESS_COOKIE = "obra10_crm_access";

export async function fetchAuthUserFromAccessToken(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: key,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return (await res.json()) as { id: string; email?: string | null };
  } catch (err) {
    console.error("[fetchAuthUserFromAccessToken] rede / TLS / Supabase:", err);
    throw err;
  }
}

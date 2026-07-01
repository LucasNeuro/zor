import { describe, expect, it } from "vitest";
import { hostSupabaseDeUrl, mascararHostSupabase } from "./mascarar-host-supabase";

describe("mascararHostSupabase", () => {
  it("mascara ref longo do projecto", () => {
    expect(mascararHostSupabase("vrlwfikzeyuywjgunyhy.supabase.co")).toBe(
      "vrlw••••••.supabase.co"
    );
  });

  it("aceita URL completa", () => {
    expect(mascararHostSupabase("https://tvsgoasczmryypitevrx.supabase.co")).toBe(
      "tvsg••••••.supabase.co"
    );
  });
});

describe("hostSupabaseDeUrl", () => {
  it("extrai host de URL https", () => {
    expect(hostSupabaseDeUrl("https://abc.supabase.co")).toBe("abc.supabase.co");
  });
});

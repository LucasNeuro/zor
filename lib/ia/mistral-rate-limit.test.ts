import { describe, expect, it } from "vitest";
import { mensagemErroBriefingChat } from "@/lib/hub/briefing-chat-errors";
import { isMistralRateLimitError, mensagemMistralRateLimitUsuario } from "@/lib/ia/mistral-rate-limit";

describe("mistral rate limit", () => {
  it("detecta 429 JSON", () => {
    const raw =
      'Mistral HTTP 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","code":"1300"}';
    expect(isMistralRateLimitError(raw)).toBe(true);
  });

  it("mensagem amigável no briefing", () => {
    const msg = mensagemErroBriefingChat(
      'Mistral HTTP 429: {"message":"Rate limit exceeded"}'
    );
    expect(msg).toContain("30–60 segundos");
    expect(msg).not.toContain("HTTP 429");
  });

  it("mensagem de áudio menciona transcrição", () => {
    expect(mensagemMistralRateLimitUsuario("audio")).toMatch(/transcrição|áudio/i);
  });
});

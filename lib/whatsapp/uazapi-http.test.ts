import { describe, expect, it } from "vitest";
import { extrairMensagemErroUazapi } from "@/lib/whatsapp/uazapi-http";

describe("extrairMensagemErroUazapi", () => {
  it("traduz WHATSAPP_REACHOUT_TIMELOCK com data limite", () => {
    const msg = extrairMensagemErroUazapi(
      {
        error_key: "WHATSAPP_REACHOUT_TIMELOCK",
        message_ptbr: "O servidor do WhatsApp recusou esta mensagem.",
        details: {
          reachout_timelock: {
            active: true,
            until: "2026-07-04T12:43:30Z",
          },
        },
      },
      500
    );
    expect(msg).toContain("WhatsApp");
    expect(msg).toContain("Limite até");
    expect(msg).toMatch(/04\/07\/2026/);
  });

  it("prefere message_ptbr", () => {
    expect(
      extrairMensagemErroUazapi({ message: "english", message_ptbr: "português" }, 400)
    ).toBe("português");
  });
});

import { describe, expect, it } from "vitest";
import { telefoneConversaId, telefonesConversaEquivalentes } from "@/lib/crm/isolamento-conversa-lead";

describe("isolamento-conversa-lead", () => {
  it("normaliza telefone para id de conversa", () => {
    expect(telefoneConversaId("+55 (11) 97036-4763")).toBe("5511970364763");
  });

  it("equivalência com ou sem 55", () => {
    expect(telefonesConversaEquivalentes("5511999990000", "11999990000")).toBe(true);
    expect(telefonesConversaEquivalentes("5511999990000", "5511888880000")).toBe(false);
  });
});

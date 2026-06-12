import { NextResponse } from "next/server";
import { WA_PRESETS_META, waPresetHintsParaCriacao } from "@/lib/hub/presets/wa-conversacao-preset";

/** Lista presets de conversação WhatsApp disponíveis no Waje. */
export async function GET() {
  return NextResponse.json({
    presets: Object.values(WA_PRESETS_META),
    hints_criacao: waPresetHintsParaCriacao(),
  });
}

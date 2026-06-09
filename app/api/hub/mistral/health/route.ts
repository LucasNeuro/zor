import { NextRequest, NextResponse } from "next/server";
import { pingMistralApi } from "@/lib/ia/mistral-health";

/** GET — testa se MISTRAL_API_KEY do .env é aceite pela Mistral. */
export async function GET(_request: NextRequest) {
  const result = await pingMistralApi();
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      fingerprint: result.fingerprint,
      httpStatus: result.httpStatus,
    });
  }
  return NextResponse.json(
    {
      ok: false,
      fingerprint: result.fingerprint,
      httpStatus: result.httpStatus,
      error: result.detail,
    },
    { status: result.httpStatus === 401 ? 401 : 503 }
  );
}

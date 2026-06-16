import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import {
  EMAIL_CHANNEL_DISABLED_CODE,
  EMAIL_CHANNEL_DISABLED_MESSAGE,
  isEmailChannelEnabled,
} from "@/lib/feature-flags";
import { runEmailSyncTick } from "@/lib/email/email-sync";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Poll Gmail OAuth inboxes (canal_email) e dispara pipeline IA + resposta.
 * Agendar a cada 1–5 min com Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  if (!isEmailChannelEnabled()) {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        code: EMAIL_CHANNEL_DISABLED_CODE,
        message: EMAIL_CHANNEL_DISABLED_MESSAGE,
      },
      { status: 503 }
    );
  }

  const result = await runEmailSyncTick(db());
  return NextResponse.json({ ok: !result.error, ...result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}

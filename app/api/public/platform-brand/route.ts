import { NextRequest, NextResponse } from "next/server";
import {
  hostFromRequest,
  resolvePlatformBrand,
  toPlatformBrandPublic,
} from "@/lib/platform-brands";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const host = hostFromRequest(request);
  const brand = await resolvePlatformBrand(host);
  return NextResponse.json(
    { data: toPlatformBrandPublic(brand) },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    },
  );
}

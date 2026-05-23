import { NextResponse } from "next/server";
import { buildHealthResponse } from "@/lib/crm/health-checks";

export async function GET() {
  return NextResponse.json(buildHealthResponse());
}

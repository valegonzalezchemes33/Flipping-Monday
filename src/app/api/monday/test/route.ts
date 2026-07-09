// ============================================================================
// API: /api/monday/test — prueba la conexión con Monday.com
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { testMondayConnection, MondayAPIError } from "@/lib/monday-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido" },
      { status: 400 }
    );
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "API key requerida" },
      { status: 400 }
    );
  }

  try {
    const result = await testMondayConnection(apiKey);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MondayAPIError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status === 401 ? 401 : 500 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

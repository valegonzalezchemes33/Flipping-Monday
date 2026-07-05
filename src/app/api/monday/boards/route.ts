// ============================================================================
// API: /api/monday/boards — lista boards disponibles en la cuenta de Monday
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { fetchMondayBoardsList, MondayAPIError } from "@/lib/monday-client";

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
    const boards = await fetchMondayBoardsList(apiKey);
    return NextResponse.json({
      ok: true,
      boards: boards.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        board_kind: b.board_kind,
        items_count: b.items_count,
        workspace_id: b.workspace_id,
      })),
    });
  } catch (e: any) {
    const status = e instanceof MondayAPIError ? e.status : 500;
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error al listar boards" },
      { status }
    );
  }
}

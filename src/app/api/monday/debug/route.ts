// ============================================================================
// API: /api/monday/debug — endpoint de diagnóstico que prueba varias queries
// y devuelve los resultados + errores para que el usuario pueda ver qué falla
// ============================================================================
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONDAY_API_URL = "https://api.monday.com/v2";

async function tryQuery(apiKey: string, query: string, label: string) {
  try {
    const res = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    return {
      label,
      ok: !json.errors,
      httpStatus: res.status,
      errors: json.errors?.map((e: any) => e.message) ?? null,
      data: json.data ?? null,
      raw: JSON.stringify(json).slice(0, 500),
    };
  } catch (e: any) {
    return {
      label,
      ok: false,
      error: e?.message ?? "unknown",
    };
  }
}

export async function POST(req: NextRequest) {
  let body: { apiKey?: string; boardId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey requerida" }, { status: 400 });
  }

  const boardId = body.boardId;

  // Probar varias queries para ver cuáles funcionan
  const tests: Promise<any>[] = [
    tryQuery(apiKey, `{ me { id name email } }`, "me"),
    tryQuery(apiKey, `{ users(limit: 5) { id name email } }`, "users"),
    tryQuery(apiKey, `{ teams(limit: 5) { id name } }`, "teams"),
    tryQuery(apiKey, `{ workspaces(limit: 5) { id name kind } }`, "workspaces"),
    tryQuery(
      apiKey,
      `{ boards(limit: 5) { id name board_kind items_count } }`,
      "boards-list"
    ),
  ];

  if (boardId) {
    // FIX: sanitizar boardId para prevenir GraphQL injection
    const safeBoardId = String(boardId).replace(/[^0-9]/g, "");
    if (!safeBoardId) {
      tests.push(Promise.resolve({ test: "board-basic", error: "boardId inválido" }));
    } else {
      tests.push(
        tryQuery(
          apiKey,
          `{ boards(ids: [${safeBoardId}]) { id name board_kind items_count } }`,
          "board-basic"
        )
      );
      tests.push(
        tryQuery(
          apiKey,
          `{ boards(ids: [${safeBoardId}]) { columns { id title type } } }`,
          "board-columns"
        )
      );
      tests.push(
        tryQuery(
          apiKey,
          `{ boards(ids: [${safeBoardId}]) { groups { id title color } } }`,
          "board-groups"
        )
      );
      tests.push(
        tryQuery(
          apiKey,
          `{ boards(ids: [${safeBoardId}]) { items_page(limit: 5) { cursor items { id name } } } }`,
          "board-items-page"
        )
      );
      tests.push(
        tryQuery(
          apiKey,
          `{ boards(ids: [${safeBoardId}]) { items(limit: 5) { id name } } }`,
          "board-items-legacy"
        )
      );
    }
  }

  const results = await Promise.all(tests);

  return NextResponse.json({
    ok: true,
    results,
    summary: results.map((r) => ({
      label: r.label,
      ok: r.ok,
      errors: r.errors,
    })),
  });
}

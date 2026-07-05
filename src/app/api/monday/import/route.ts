// ============================================================================
// API: /api/monday/import — importa boards seleccionados via SSE streaming
// ============================================================================
// Recibe: { apiKey, boardIds[] } → stream de eventos de progreso
import { NextRequest } from "next/server";
import {
  fetchMondayBoardFull,
  fetchMondayTeams,
  fetchMondayUsers,
  fetchMondayWorkspaces,
  MondayAPIError,
} from "@/lib/monday-client";
import {
  mapBoard,
  mapTeam,
  mapUser,
  mapWorkspace,
} from "@/lib/monday-mapper";
import type {
  Board,
  Team,
  User,
  Workspace,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ImportRequest {
  apiKey: string;
  boardIds: string[];
  importUsers?: boolean;
  importTeams?: boolean;
}

export async function POST(req: NextRequest) {
  let body: ImportRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { apiKey, boardIds, importUsers = true, importTeams = true } = body;

  if (!apiKey || !boardIds || !Array.isArray(boardIds) || boardIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "apiKey y boardIds[] son requeridos" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const collected: {
        users: User[];
        teams: Team[];
        workspaces: Workspace[];
        boards: Board[];
      } = {
        users: [],
        teams: [],
        workspaces: [],
        boards: [],
      };

      try {
        send("start", {
          totalBoards: boardIds.length,
          startedAt: new Date().toISOString(),
        });

        // ----------------------------------------------------------
        // 1. Workspaces (para mapear board → workspace)
        // ----------------------------------------------------------
        send("step", {
          step: "workspaces",
          message: "Obteniendo workspaces de Monday…",
        });
        try {
          const mondayWorkspaces = await fetchMondayWorkspaces(apiKey);
          collected.workspaces = mondayWorkspaces.map(mapWorkspace);
          send("progress", {
            step: "workspaces",
            count: collected.workspaces.length,
          });
        } catch (e: any) {
          send("warn", {
            step: "workspaces",
            message: `No se pudieron obtener workspaces: ${e?.message ?? "error"}`,
          });
        }

        // ----------------------------------------------------------
        // 2. Users (opcional)
        // ----------------------------------------------------------
        if (importUsers) {
          send("step", {
            step: "users",
            message: "Obteniendo usuarios de Monday…",
          });
          try {
            const mondayUsers = await fetchMondayUsers(apiKey);
            collected.users = mondayUsers.map(mapUser);
            send("progress", {
              step: "users",
              count: collected.users.length,
            });
          } catch (e: any) {
            send("warn", {
              step: "users",
              message: `No se pudieron obtener users: ${e?.message ?? "error"}`,
            });
          }
        }

        // ----------------------------------------------------------
        // 3. Teams (opcional)
        // ----------------------------------------------------------
        if (importTeams) {
          send("step", {
            step: "teams",
            message: "Obteniendo teams de Monday…",
          });
          try {
            const mondayTeams = await fetchMondayTeams(apiKey);
            collected.teams = mondayTeams.map(mapTeam);
            send("progress", {
              step: "teams",
              count: collected.teams.length,
            });
          } catch (e: any) {
            send("warn", {
              step: "teams",
              message: `No se pudieron obtener teams: ${e?.message ?? "error"}`,
            });
          }
        }

        // ----------------------------------------------------------
        // 4. Boards completos (uno por uno con streaming)
        // ----------------------------------------------------------
        for (let i = 0; i < boardIds.length; i++) {
          const boardId = boardIds[i];
          send("step", {
            step: "board",
            message: `Importando board ${i + 1}/${boardIds.length}: ${boardId}…`,
            current: i + 1,
            total: boardIds.length,
          });

          try {
            const mondayBoard = await fetchMondayBoardFull(apiKey, boardId);
            // Mapear workspace: usar el workspace_id del board, o un default
            const wsId =
              mondayBoard.workspace_id
                ? `m-w-${mondayBoard.workspace_id}`
                : collected.workspaces[0]?.id ?? "w1";

            const mappedBoard = mapBoard(mondayBoard, wsId);
            collected.boards.push(mappedBoard);

            send("board-imported", {
              boardId: mappedBoard.id,
              boardName: mappedBoard.name,
              itemsCount: mappedBoard.items.length,
              columnsCount: mappedBoard.columns.length,
              groupsCount: mappedBoard.groups.length,
              current: i + 1,
              total: boardIds.length,
            });
          } catch (e: any) {
            const isApiError = e instanceof MondayAPIError;
            send("board-error", {
              boardId,
              message: e?.message ?? "Error al importar board",
              status: isApiError ? e.status : 500,
            });
            // Continuar con el siguiente board
          }
        }

        // ----------------------------------------------------------
        // 5. Resultado final — devolver todo el payload mapeado
        // ----------------------------------------------------------
        send("done", {
          completedAt: new Date().toISOString(),
          summary: {
            boards: collected.boards.length,
            users: collected.users.length,
            teams: collected.teams.length,
            workspaces: collected.workspaces.length,
            totalItems: collected.boards.reduce(
              (a, b) => a + b.items.length,
              0
            ),
            totalColumns: collected.boards.reduce(
              (a, b) => a + b.columns.length,
              0
            ),
          },
          payload: collected,
        });
      } catch (err: any) {
        send("error", {
          message: err?.message ?? "Error fatal durante la importación",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ============================================================================
// Cliente de Monday.com GraphQL API
// ============================================================================
// Documentación: https://developer.monday.com/api-reference/docs
// Endpoint: POST https://api.monday.com/v2
// Auth: header Authorization con API token (no "Bearer")

import type {
  MondayBoard,
  MondayBoardsResponse,
  MondayErrorResponse,
  MondayMeResponse,
  MondayTeamsResponse,
  MondayUsersResponse,
  MondayWorkspacesResponse,
  MondayItem,
} from "./monday-types";

const MONDAY_API_URL = "https://api.monday.com/v2";

export class MondayAPIError extends Error {
  status: number;
  details?: any;
  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = "MondayAPIError";
    this.status = status;
    this.details = details;
  }
}

async function mondayFetch(
  apiKey: string,
  query: string,
  variables?: Record<string, any>
): Promise<any> {
  if (!apiKey || apiKey.trim().length < 10) {
    throw new MondayAPIError("API key inválida o vacía", 401);
  }

  const body: any = { query };
  if (variables) body.variables = variables;

  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey.trim(),
      "Content-Type": "application/json",
      "API-Version": "2024-01",
    },
    body: JSON.stringify(body),
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new MondayAPIError(
      `Respuesta no JSON de Monday (HTTP ${res.status})`,
      res.status
    );
  }

  if (!res.ok) {
    const err = json as MondayErrorResponse;
    const msg =
      err.errors?.[0]?.message ||
      err.error_message ||
      `Error HTTP ${res.status}`;
    throw new MondayAPIError(msg, res.status, json);
  }

  if (json.errors && json.errors.length > 0) {
    throw new MondayAPIError(
      json.errors[0].message || "Error GraphQL Monday",
      200,
      json
    );
  }

  return json;
}

// ----------------------------------------------------------------------------
// 1. Validar API key + obtener info de cuenta
// ----------------------------------------------------------------------------
export async function testMondayConnection(apiKey: string): Promise<{
  ok: boolean;
  account?: {
    id: string;
    name: string;
    email: string;
    planTier: string;
    logo?: string;
  };
  error?: string;
}> {
  try {
    const query = `
      query {
        me {
          id
          name
          email
          account {
            id
            name
            plan { tier }
            logo
          }
        }
      }
    `;
    const data: MondayMeResponse = await mondayFetch(apiKey, query);
    return {
      ok: true,
      account: {
        id: data.data.me.account.id,
        name: data.data.me.account.name,
        email: data.data.me.email,
        planTier: data.data.me.account.plan?.tier ?? "unknown",
        logo: data.data.me.account.logo,
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message ?? "Error desconocido al conectar con Monday",
    };
  }
}

// ----------------------------------------------------------------------------
// 2. Obtener usuarios y teams
// ----------------------------------------------------------------------------
export async function fetchMondayUsers(apiKey: string) {
  const query = `
    query {
      users(limit: 200) {
        id
        name
        email
        is_guest
        enabled
        title
        photo_small
      }
    }
  `;
  const data: MondayUsersResponse = await mondayFetch(apiKey, query);
  return data.data.users;
}

export async function fetchMondayTeams(apiKey: string) {
  const query = `
    query {
      teams(limit: 100) {
        id
        name
        users(limit: 100) {
          id
          name
          email
        }
      }
    }
  `;
  const data: MondayTeamsResponse = await mondayFetch(apiKey, query);
  return data.data.teams;
}

// ----------------------------------------------------------------------------
// 3. Obtener workspaces
// ----------------------------------------------------------------------------
export async function fetchMondayWorkspaces(apiKey: string) {
  const query = `
    query {
      workspaces(limit: 100) {
        id
        name
        kind
        description
      }
    }
  `;
  const data: MondayWorkspacesResponse = await mondayFetch(apiKey, query);
  return data.data.workspaces;
}

// ----------------------------------------------------------------------------
// 4. Listar boards (sin items todavía, para selección)
// ----------------------------------------------------------------------------
export async function fetchMondayBoardsList(apiKey: string): Promise<
  MondayBoard[]
> {
  const query = `
    query {
      boards(limit: 100, state: active) {
        id
        name
        description
        board_kind
        workspace_id
        state
        items_count
        board_folder_name
      }
    }
  `;
  const data: MondayBoardsResponse = await mondayFetch(apiKey, query);
  return data.data.boards;
}

// ----------------------------------------------------------------------------
// 5. Obtener board completo: columns, groups, items (con paginación)
// ----------------------------------------------------------------------------
export async function fetchMondayBoardFull(
  apiKey: string,
  boardId: string
): Promise<MondayBoard> {
  const query = `
    query($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        description
        board_kind
        workspace_id
        state
        items_count
        columns {
          id
          title
          type
          archived
          settings_str
        }
        groups {
          id
          title
          color
          archived
        }
        items_page(limit: 500) {
          cursor
          items {
            id
            name
            state
            created_at
            updated_at
            group { id title color }
            column_values {
              id
              text
              value
              type
              title
            }
            creator { id name }
          }
        }
        views {
          id
          name
          type
        }
      }
    }
  `;
  const data = await mondayFetch(apiKey, query, { boardId: [boardId] });
  const board = data.data.boards[0];
  if (!board) {
    throw new MondayAPIError(`Board ${boardId} no encontrado`, 404);
  }

  // Paginar items si hay cursor
  let allItems: MondayItem[] = board.items_page?.items ?? [];
  let cursor = board.items_page?.cursor;

  while (cursor) {
    const pageQuery = `
      query($cursor: String!) {
        next_items_page(cursor: $cursor, limit: 500) {
          cursor
          items {
            id
            name
            state
            created_at
            updated_at
            group { id title color }
            column_values {
              id
              text
              value
              type
              title
            }
            creator { id name }
          }
        }
      }
    `;
    const pageData = await mondayFetch(apiKey, pageQuery, { cursor });
    const nextPage = pageData.data.next_items_page;
    allItems = [...allItems, ...(nextPage.items ?? [])];
    cursor = nextPage.cursor;
  }

  return {
    ...board,
    items_page: { cursor: null, items: allItems },
  };
}

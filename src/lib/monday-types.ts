// ============================================================================
// Tipos para respuestas de Monday.com GraphQL API
// ============================================================================
// API v2 — endpoint: https://api.monday.com/v2
// Headers: Authorization: <API_KEY>, Content-Type: application/json

export interface MondayUser {
  id: string;
  name: string;
  email: string;
  is_guest: boolean;
  enabled: boolean;
  title?: string;
  photo_small?: string;
  url?: string;
}

export interface MondayTeam {
  id: string;
  name: string;
  users: MondayUser[];
}

export interface MondayWorkspace {
  id: string;
  name: string;
  kind: "open" | "closed" | "private";
  description: string;
}

export interface MondayBoardKind {
  id: string;
  name: string;
  description: string;
  board_kind: "public" | "private" | "shareable";
  board_folder_name?: string;
  workspace_id?: string | null;
  state: "all" | "active" | "archived" | "deleted";
  position: number;
  items_count: number;
}

export interface MondayColumn {
  id: string;
  title: string;
  type: string; // text, numbers, status, dropdown, date, timeline, people, etc.
  archived: boolean;
  settings_str: string; // JSON string con labels, etc.
  width?: number;
}

export interface MondayGroup {
  id: string;
  title: string;
  color: string;
  archived: boolean;
  position: number;
}

export interface MondayColumnValue {
  id: string; // = column id
  text: string;
  value: string; // JSON string con estructura según tipo
  type: string;
  title: string;
}

export interface MondayItem {
  id: string;
  name: string;
  state: "active" | "archived" | "deleted";
  group: { id: string; title: string; color: string };
  board: { id: string; name: string };
  column_values: MondayColumnValue[];
  created_at: string;
  updated_at: string;
  creator: { id: string; name: string };
  subitems?: MondayItem[];
}

export interface MondayBoard extends MondayBoardKind {
  columns: MondayColumn[];
  groups: MondayGroup[];
  items_page?: {
    cursor: string | null;
    items: MondayItem[];
  };
  views: { id: string; name: string; type: string }[];
}

// Respuestas GraphQL tipadas
export interface MondayMeResponse {
  data: {
    me: {
      id: string;
      name: string;
      email: string;
      account: {
        id: string;
        name: string;
        plan: { tier: string };
        logo: string;
      };
    };
  };
}

export interface MondayUsersResponse {
  data: { users: MondayUser[] };
}

export interface MondayTeamsResponse {
  data: { teams: MondayTeam[] };
}

export interface MondayWorkspacesResponse {
  data: { workspaces: MondayWorkspace[] };
}

export interface MondayBoardsResponse {
  data: { boards: MondayBoard[] };
}

export interface MondayErrorResponse {
  errors?: { message: string; extensions?: { code: string } }[];
  error_message?: string;
}

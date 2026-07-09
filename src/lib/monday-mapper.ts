// ============================================================================
// Mapeador de Monday.com → modelo interno de monday-AI
// ============================================================================
import type {
  MondayBoard,
  MondayColumn,
  MondayColumnValue,
  MondayGroup,
  MondayItem,
  MondayTeam,
  MondayUser,
  MondayWorkspace,
} from "./monday-types";
import type {
  Board,
  ColumnDef,
  ColumnType,
  ColumnValue,
  Group,
  Item,
  Team,
  User,
  Workspace,
} from "./types";

// Mapeo de tipos de columna Monday → nuestros tipos
const COLUMN_TYPE_MAP: Record<string, ColumnType> = {
  name: "text",
  text: "text",
  "long-text": "long_text",
  numbers: "numbers",
  status: "status",
  dropdown: "dropdown",
  date: "date",
  timeline: "timeline",
  people: "people",
  email: "email",
  phone: "phone",
  link: "link",
  file: "file",
  checkbox: "checkbox",
  rating: "rating",
  "progress-bar": "progress",
  formula: "formula",
  mirror: "mirror",
  "auto-number": "auto_number",
  "creation-log": "created_time",
  "last-updated": "last_updated",
  tags: "tags",
  "time-tracking": "time_tracking",
  vote: "vote",
  dependency: "dependency",
  button: "button",
  integration: "integration",
  location: "location",
  "color-picker": "color_picker",
  doc: "doc",
  "subtasks": "text",
  "world-clock": "text",
  // Nuestro tipo IA — no existe en Monday real
  "ai_agent": "ai_agent",
  // Alias común para prioridad
  priority: "priority",
};

// ----------------------------------------------------------------------------
// Parsear settings_str de Monday (JSON string con labels de status/priority)
// ----------------------------------------------------------------------------
function parseColumnSettings(col: MondayColumn): Partial<ColumnDef> {
  const settings: Partial<ColumnDef> = {};
  if (!col.settings_str) return settings;

  try {
    const s = JSON.parse(col.settings_str);

    // Para status: { labels: { "0": "Done", "1": "Working on it" } }
    if (s.labels && typeof s.labels === "object") {
      const labels: Record<string, { name: string; color: string }> = {};
      const colorPalette = [
        "#00C875",
        "#FFC700",
        "#E2445C",
        "#0072E5",
        "#A25BFF",
        "#FF642E",
        "#579BFC",
        "#401694",
        "#9CD326",
        "#5559DF",
        "#5AB1FF",
        "#FF158A",
      ];
      Object.entries(s.labels).forEach(([id, name]: [string, any], idx) => {
        labels[id] = {
          name: String(name ?? `Estado ${id}`),
          color: s.labels_colors?.[id]?.color ?? colorPalette[idx % colorPalette.length],
        };
      });
      settings.labels = labels;
    }

    // Para priority: { labels: { "1": "Critical", ... } } — mapear a nuestros colores
    if (col.type === "color" || col.type === "priority") {
      const priorityColors: Record<string, string> = {
        "1": "#401694",
        "2": "#5559DF",
        "3": "#5AB1FF",
        "4": "#9CD326",
      };
      const priorityNames: Record<string, string> = {
        "1": "Critical",
        "2": "High",
        "3": "Medium",
        "4": "Low",
      };
      const labels: Record<string, { name: string; color: string }> = {};
      Object.keys(s.labels ?? {}).forEach((id) => {
        labels[id] = {
          name: s.labels?.[id] ?? priorityNames[id] ?? `Prioridad ${id}`,
          color: s.labels_colors?.[id]?.color ?? priorityColors[id] ?? "#C4C4C4",
        };
      });
      if (Object.keys(labels).length > 0) settings.labels = labels;
    }

    // Para formula: { formula: "..." }
    if (s.formula) settings.formula = String(s.formula);
  } catch {
    /* settings_str no es JSON válido — ignorar */
  }

  return settings;
}

// ----------------------------------------------------------------------------
// Mapear tipo de columna Monday → nuestro tipo
// ----------------------------------------------------------------------------
export function mapColumnType(mondayType: string, columnId: string): ColumnType {
  if (columnId === "name") return "text";
  if (columnId === "person" || columnId === "people") return "people";
  if (columnId === "status") return "status";
  if (columnId === "priority" || mondayType === "color") return "priority";
  return COLUMN_TYPE_MAP[mondayType] ?? "text";
}

// ----------------------------------------------------------------------------
// Mapear una columna Monday → ColumnDef
// ----------------------------------------------------------------------------
export function mapColumn(col: MondayColumn): ColumnDef {
  const type = mapColumnType(col.type, col.id);
  const def: ColumnDef = {
    id: col.id,
    title: col.title,
    type,
    archived: col.archived,
    width: col.width ?? 140,
  };

  // Añadir settings parseadas (labels, formula)
  Object.assign(def, parseColumnSettings(col));

  return def;
}

// ----------------------------------------------------------------------------
// Mapear un grupo Monday → Group
// ----------------------------------------------------------------------------
export function mapGroup(g: MondayGroup, index: number = 0): Group {
  return {
    id: g.id,
    title: g.title,
    color: g.color || "#579BFC",
    position: g.position ?? index,
    collapsed: false,
  };
}

// ----------------------------------------------------------------------------
// Parsear value de una columna Monday → nuestro ColumnValue
// ----------------------------------------------------------------------------
function parseColumnValue(cv: MondayColumnValue, type: ColumnType): any {
  if (!cv.value || cv.value === "null" || cv.value === "{}") {
    // Para texto directo, usar cv.text
    if (cv.text) return { text: cv.text };
    return null;
  }

  try {
    const parsed = JSON.parse(cv.value);

    switch (type) {
      case "status":
        // Monday usa index 0-N, nosotros también
        return { labelId: String(parsed.index ?? parsed.labelId ?? "0") };
      case "priority":
        // FIX: Monday usa priority 1-4, nosotros usamos 0-3 → restar 1
        const pIdx = parsed.index ?? parsed.labelId ?? 1;
        return { labelId: String(Math.max(0, Number(pIdx) - 1)) };

      case "people":
        // { "personsAndTeams": [{ "id": 123, "kind": "person" }] }
        return {
          userIds: (parsed.personsAndTeams ?? [])
            .filter((p: any) => p.kind === "person")
            .map((p: any) => `m-u-${p.id}`),
        };

      case "date":
        // { "date": "2024-01-15" }
        return { date: parsed.date ?? null };

      case "checkbox":
        // { "checked": "true" }
        return { checked: parsed.checked === "true" || parsed.checked === true };

      case "rating":
        return { value: Number(parsed.rating ?? 0) };

      case "progress":
        return { value: Number(parsed.value ?? parsed.percentage ?? 0) };

      case "dropdown":
        // { "labels": [1, 2] }
        return { labelIds: parsed.labels ?? [] };

      case "timeline":
        // { "from": "2024-01-01", "to": "2024-01-15" }
        return { from: parsed.from, to: parsed.to };

      default:
        // text, numbers, email, phone, link, etc. — usar text o value directo
        return { text: cv.text ?? parsed.text ?? String(parsed) };
    }
  } catch {
    // Si no es JSON, usar cv.text
    return cv.text ? { text: cv.text } : null;
  }
}

// ----------------------------------------------------------------------------
// Mapear un item Monday → Item
// ----------------------------------------------------------------------------
export function mapItem(
  item: MondayItem,
  boardId: string,
  localColumns: ColumnDef[]
): Item {
  const columnValues: ColumnValue[] = item.column_values
    .map((cv) => {
      const colDef = localColumns.find((c) => c.id === cv.id);
      if (!colDef) return null;
      const value = parseColumnValue(cv, colDef.type);
      if (!value) return null;
      return { columnId: cv.id, value };
    })
    .filter(Boolean) as ColumnValue[];

  return {
    id: `m-i-${item.id}`, // prefijo m- para distinguir de items locales
    boardId,
    groupId: item.group?.id ?? "default",
    name: item.name,
    columnValues,
    createdAt: item.created_at ?? new Date().toISOString(),
    updatedAt: item.updated_at ?? new Date().toISOString(),
    position: 0,
    archived: item.state !== "active",
  };
}

// ----------------------------------------------------------------------------
// Mapear board completo
// ----------------------------------------------------------------------------
export function mapBoard(
  board: MondayBoard,
  workspaceId: string
): Board {
  // Columna name siempre primera
  const nameColumn: ColumnDef = {
    id: "name",
    title: "Item",
    type: "text",
    width: 320,
  };

  const columns: ColumnDef[] = [
    nameColumn,
    ...board.columns
      .filter((c) => c.id !== "name" && !c.archived)
      .map(mapColumn),
  ];

  const groups: Group[] = (board.groups ?? [])
    .filter((g) => !g.archived)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((g, i) => mapGroup(g, i));

  const items: Item[] = (board.items_page?.items ?? []).map((item) =>
    mapItem(item, `m-b-${board.id}`, columns)
  );

  return {
    id: `m-b-${board.id}`, // prefijo m- para distinguir
    workspaceId,
    name: board.name,
    description: board.description ?? "",
    boardKind: board.board_kind ?? "public",
    boardType: "board",
    columns,
    groups: groups.length > 0 ? groups : [
      { id: "default", title: "Default", color: "#579BFC", position: 0 },
    ],
    items,
    views: (board.views ?? []).map((v) => ({
      id: `m-v-${v.id}`,
      name: v.name,
      type: (v.type as any) ?? "main_table",
    })),
  };
}

// ----------------------------------------------------------------------------
// Mapear usuario Monday → User
// ----------------------------------------------------------------------------
export function mapUser(u: MondayUser): User {
  return {
    id: `m-u-${u.id}`,
    name: u.name,
    email: u.email,
    role: u.is_guest ? "guest" : "member",
    color: colorFromString(u.email || u.name),
    avatarUrl: u.photo_small,
  };
}

// ----------------------------------------------------------------------------
// Mapear team
// ----------------------------------------------------------------------------
export function mapTeam(t: MondayTeam): Team {
  return {
    id: `m-t-${t.id}`,
    name: t.name,
    memberIds: (t.users ?? []).map((u) => `m-u-${u.id}`),
  };
}

// ----------------------------------------------------------------------------
// Mapear workspace
// ----------------------------------------------------------------------------
export function mapWorkspace(w: MondayWorkspace): Workspace {
  return {
    id: `m-w-${w.id}`,
    name: w.name,
    kind: w.kind === "closed" ? "closed" : "open",
    description: w.description,
    boardIds: [], // se llena después
    color: "#0072E5",
  };
}

// ----------------------------------------------------------------------------
// Util: generar color desde string (para avatares sin color)
// ----------------------------------------------------------------------------
const AVATAR_COLORS = [
  "#0072E5",
  "#00C875",
  "#FFC700",
  "#FF642E",
  "#A25BFF",
  "#FF158A",
  "#579BFC",
  "#401694",
];

export function colorFromString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

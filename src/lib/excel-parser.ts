// ============================================================================
// Parser de Excel exportado desde Monday.com — REESCRITO COMPLETO
// ============================================================================
// Formato real de export de Monday.com:
// Fila 0: [Nombre del Board, "", "", ...]
// Fila 1: [Name, Subitems, Columna1, Columna2, ...]  ← headers
// Fila 2: [Nombre del Grupo, "", "", ...]  ← header de grupo (solo col A)
// Fila 3: [Item 1, subitems_count, val1, val2, ...]  ← item
// Fila 4: [Item 2, subitems_count, val1, val2, ...]  ← item
// Fila 5: [Nombre del Grupo 2, "", "", ...]  ← header de grupo
// Fila 6: [Item 3, subitems_count, val1, val2, ...]  ← item
// ...
// Si hay subitems: filas con "Subitems" en col A y sus propios headers

import type { Board, ColumnDef, ColumnValue, Group, Item, SubItem } from "./types";

// ---- Utilidades de fecha ----
function excelDateToISO(serial: number): string | null {
  if (!serial || isNaN(serial)) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = serial * 86400000;
  const date = new Date(epoch.getTime() + ms);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

// ---- Colores de Monday para status ----
const MONDAY_STATUS_COLORS: Record<string, string> = {
  "listo con retraso": "#A25BFF",
  "listo retrasado": "#A25BFF",
  "listo a tiempo": "#00C875",
  "listo": "#00C875",
  "done": "#00C875",
  "pagado": "#00C875",
  "en proceso": "#FFC700",
  "working on it": "#FFC700",
  "confirmado": "#5559DF",
  "siguientes pasos": "#579BFC",
  "proyectado": "#579BFC",
  "stuck": "#E2445C",
  "atascado": "#E2445C",
  "not started": "#C4C4C4",
  "no iniciado": "#C4C4C4",
  "pendiente": "#C4C4C4",
  "crítico": "#E2445C",
  "critico": "#E2445C",
  "diferible": "#FFC700",
  "egreso": "#FF642E",
  "ingreso": "#00C875",
  // Más colores de Monday
  "grass green": "#9CD326",
  "purple": "#A25BFF",
  "red": "#E2445C",
  "blue": "#579BFC",
  "yellow": "#FFC700",
  "orange": "#FF642E",
  "dark blue": "#401694",
  "light blue": "#5559DF",
  "grey": "#C4C4C4",
  "pink": "#FF158A",
};

function getStatusColor(label: string): string {
  const lower = label.toLowerCase().replace(/[✅☑️⚠️❌🟡🔵🟣🟢🔴]/g, "").trim();
  if (MONDAY_STATUS_COLORS[lower]) return MONDAY_STATUS_COLORS[lower];
  for (const [key, color] of Object.entries(MONDAY_STATUS_COLORS)) {
    if (lower.includes(key)) return color;
  }
  // Rotar colores de Monday si no se encuentra
  const FALLBACK_COLORS = ["#579BFC", "#00C875", "#FFC700", "#FF642E", "#A25BFF", "#FF158A"];
  return FALLBACK_COLORS[label.length % FALLBACK_COLORS.length];
}

// ---- Colores para grupos (rotar como Monday) ----
const GROUP_COLORS = ["#FFC700", "#FF642E", "#00C875", "#A25BFF", "#579BFC", "#FF158A", "#401694", "#9CD326"];

// ---- Mapeo de nombres de columna Excel → tipo interno ----
function inferColumnType(header: string): ColumnDef["type"] {
  const h = header.toLowerCase().trim();
  if (h === "name" || h === "nombre" || h === "item" || h === "elemento" || h === "tarea" || h === "task") return "text";
  if (h === "subelementos" || h === "subitems") return "text";
  if (h.includes("propietario") || h.includes("owner") || h.includes("people") || h.includes("persona") || h.includes("asignad")) return "people";
  if (h === "estado" || h === "status") return "status";
  if (h.includes("prioridad") || h === "priority") return "priority";
  if (h.includes("tipo") && h.length <= 8) return "status";
  if (h.includes("categoría") || h.includes("categoria") || h.includes("category")) return "status";
  if (h.includes("obra")) return "status";
  if (h.includes("fecha") || h.includes("date") || h.includes("deadline") || h.includes("límite") || h.includes("vencim")) return "date";
  if (h.includes("cronograma") || h.includes("timeline") || h.includes("schedule")) return "date";
  if (h.includes("duración") || h.includes("duration")) return "numbers";
  if (h.includes("esfuerzo") || h.includes("effort")) return "numbers";
  if (h.includes("pago") || h.includes("monto") || h.includes("saldo") || h.includes("flujo") || h.includes("precio") || h.includes("costo") || h.includes("total") || h.includes("cantidad")) return "numbers";
  if (h.includes("depende") || h.includes("depend")) return "text";
  if (h.includes("progreso") || h.includes("progress")) return "progress";
  if (h.includes("checkbox") || h === "✓" || h === "check") return "checkbox";
  if (h.includes("email") || h.includes("correo")) return "email";
  if (h.includes("teléfono") || h.includes("phone")) return "phone";
  if (h.includes("link") || h.includes("enlace") || h.includes("url")) return "link";
  if (h.includes("item id") || h.includes("auto")) return "auto_number";
  return "text";
}

// ---- Anchos recomendados por tipo de columna ----
const COLUMN_WIDTHS: Record<string, number> = {
  text: 340,
  people: 160,
  status: 180,
  priority: 140,
  date: 150,
  numbers: 140,
  ai_agent: 190,
  auto_number: 140,
  email: 180,
  phone: 140,
  link: 160,
  checkbox: 80,
  timeline: 180,
  progress: 140,
};

export interface ParsedExcelBoard {
  board: Board;
  warnings: string[];
}

// ---- Helper: contar celdas no vacías en una fila (excluyendo col 0) ----
function countNonEmptyAfterCol0(row: any[]): number {
  let count = 0;
  for (let c = 1; c < row.length; c++) {
    const v = row[c];
    if (v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== ".") count++;
  }
  return count;
}

// ---- Helper: ¿es una fila de headers? ----
function isHeaderRow(col0: string): boolean {
  const lower = col0.toLowerCase().trim();
  return ["name", "nombre", "item", "elemento", "tarea", "task", "subitems", "subelementos"].includes(lower);
}

export function parseMondayExcel(
  rows: any[][],
  fileName: string
): ParsedExcelBoard {
  const warnings: string[] = [];

  if (!rows || rows.length < 2) {
    throw new Error("El archivo Excel no tiene suficientes filas");
  }

  // ============================================================
  // PASO 1: Extraer nombre del board (fila 0, col 0)
  // ============================================================
  const boardName = String(rows[0]?.[0] ?? fileName.replace(/\.xlsx?$/i, "")).trim();

  // ============================================================
  // PASO 2: Encontrar la fila de headers principal
  // ============================================================
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] ?? "").trim().toLowerCase();
    if (col0 === "name" || col0 === "nombre" || col0 === "item" || col0 === "elemento" || col0 === "tarea" || col0 === "task") {
      headerRowIdx = i;
      break;
    }
  }

  // Fallback: buscar primera fila con 3+ columnas no vacías
  if (headerRowIdx === -1) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i];
      if (!row) continue;
      let nonEmpty = 0;
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== "") nonEmpty++;
      }
      if (nonEmpty >= 3) {
        headerRowIdx = i;
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 0;
  }

  const headerRow = rows[headerRowIdx] ?? [];

  // ============================================================
  // PASO 3: Crear columnas desde los headers
  // ============================================================
  const columns: ColumnDef[] = [{
    id: "name",
    title: String(headerRow[0] ?? "Name").trim() || "Name",
    type: "text",
    width: COLUMN_WIDTHS.text,
  }];

  for (let c = 1; c < headerRow.length; c++) {
    const header = String(headerRow[c] ?? "").trim();
    if (!header) continue;
    // Saltar columna "Subitems" — se procesa aparte
    if (header.toLowerCase() === "subitems" || header.toLowerCase() === "subelementos") continue;

    const type = inferColumnType(header);
    const colDef: ColumnDef = {
      id: `col-${c}`,
      title: header,
      type,
      width: COLUMN_WIDTHS[type] ?? 140,
    };

    if (type === "status" || type === "priority") {
      colDef.labels = {};
    }

    columns.push(colDef);
  }

  // Mapa: índice de columna en Excel → índice en nuestro array de columnas
  // (porque saltamos "Subitems" y la col 0 es "name")
  const excelColToOurCol: Record<number, number> = {};
  let ourColIdx = 1; // 0 es "name"
  for (let c = 1; c < headerRow.length; c++) {
    const header = String(headerRow[c] ?? "").trim();
    if (!header) continue;
    if (header.toLowerCase() === "subitems" || header.toLowerCase() === "subelementos") continue;
    excelColToOurCol[c] = ourColIdx;
    ourColIdx++;
  }

  // ============================================================
  // PASO 4: Primera pasada — recolectar valores de status para crear labels
  // ============================================================
  const statusLabelMaps: Record<string, Map<string, { id: string; name: string; color: string }>> = {};
  columns.forEach((col) => {
    if (col.type === "status" || col.type === "priority") {
      statusLabelMaps[col.id] = new Map();
    }
  });

  for (let rowIdx = headerRowIdx + 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;
    const col0 = String(row[0] ?? "").trim();
    if (!col0 || isHeaderRow(col0)) continue;
    // Saltar filas que parecen ser headers de grupo (solo col0 con contenido)
    if (countNonEmptyAfterCol0(row) === 0) continue;

    for (const [excelIdxStr, ourIdx] of Object.entries(excelColToOurCol)) {
      const excelIdx = Number(excelIdxStr);
      const col = columns[ourIdx];
      if (!col || (col.type !== "status" && col.type !== "priority")) continue;

      const rawValue = row[excelIdx];
      if (rawValue === undefined || rawValue === null) continue;
      const textValue = String(rawValue).replace(/[✅☑️⚠️❌🟡🔵🟣🟢🔴]/g, "").trim();
      if (!textValue || textValue.toLowerCase() === "null") continue;

      const labelMap = statusLabelMaps[col.id];
      if (!labelMap.has(textValue)) {
        const id = String(labelMap.size);
        labelMap.set(textValue, {
          id,
          name: textValue,
          color: getStatusColor(textValue),
        });
      }
    }
  }

  // Asignar labels a las columnas
  const textToLabelId: Record<string, Record<string, string>> = {};
  for (const col of columns) {
    if (col.type === "status" || col.type === "priority") {
      const labelMap = statusLabelMaps[col.id];
      const labels: Record<string, { name: string; color: string }> = {};
      textToLabelId[col.id] = {};
      labelMap.forEach((v) => {
        labels[v.id] = { name: v.name, color: v.color };
        textToLabelId[col.id][v.name.toLowerCase()] = v.id;
      });
      col.labels = labels;
    }
  }

  // ============================================================
  // PASO 5: Segunda pasada — extraer grupos, items y subitems
  // ============================================================
  const groups: Group[] = [];
  const items: Item[] = [];
  let currentGroup: Group | null = null;
  let currentGroupColorIdx = 0;
  let itemPosition = 0;
  let inSubitems = false;
  let parentItem: Item | null = null;
  let subitemColumns: ColumnDef[] = [];
  let subitemColIndexMap: Record<number, number> = {};

  for (let rowIdx = headerRowIdx + 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row || row.length === 0) {
      // Fila vacía → resetear estado de subitems
      inSubitems = false;
      parentItem = null;
      continue;
    }

    const col0 = String(row[0] ?? "").trim();
    const nonEmptyAfterCol0 = countNonEmptyAfterCol0(row);

    // ---- Caso 1: Fila vacía (sin col0) → skip ----
    if (!col0) {
      // Si estábamos en subitems y hay fila vacía, salir
      if (inSubitems) {
        inSubitems = false;
        parentItem = null;
      }
      continue;
    }

    // ---- Caso 2: Header repetido (Name, Nombre, etc.) → skip ----
    if (isHeaderRow(col0) && col0.toLowerCase() !== "subitems" && col0.toLowerCase() !== "subelementos") {
      continue;
    }

    // ---- Caso 3: Header de subitems → entrar en modo subitems ----
    if (col0.toLowerCase() === "subitems" || col0.toLowerCase() === "subelementos") {
      inSubitems = true;
      subitemColumns = [];
      subitemColIndexMap = {};
      for (let c = 1; c < row.length; c++) {
        const header = String(row[c] ?? "").trim();
        if (!header) continue;
        const subCol: ColumnDef = {
          id: `subcol-${c}`,
          title: header,
          type: inferColumnType(header),
          width: COLUMN_WIDTHS[inferColumnType(header)] ?? 120,
        };
        if (subCol.type === "status" || subCol.type === "priority") {
          subCol.labels = {};
        }
        subitemColIndexMap[c] = subitemColumns.length;
        subitemColumns.push(subCol);
      }
      continue;
    }

    // ---- Caso 4: Header de grupo (solo col0 con contenido, resto vacío) ----
    if (nonEmptyAfterCol0 === 0) {
      // Es un header de grupo
      currentGroup = {
        id: `g-excel-${groups.length}`,
        title: col0,
        color: GROUP_COLORS[currentGroupColorIdx % GROUP_COLORS.length],
        position: groups.length,
        collapsed: false,
      };
      groups.push(currentGroup);
      currentGroupColorIdx++;
      itemPosition = 0;
      inSubitems = false;
      parentItem = null;
      continue;
    }

    // ---- Caso 5: Crear grupo default si no hay ----
    if (!currentGroup) {
      currentGroup = {
        id: `g-excel-${groups.length}`,
        title: "General",
        color: GROUP_COLORS[0],
        position: 0,
        collapsed: false,
      };
      groups.push(currentGroup);
      currentGroupColorIdx = 1;
    }

    // ---- Caso 6: Procesar subitem ----
    if (inSubitems && parentItem) {
      const subitemName = String(row[0] ?? "").trim() || "Subitem";
      const subColumnValues: ColumnValue[] = [];

      for (const [excelIdxStr, subColIdx] of Object.entries(subitemColIndexMap)) {
        const excelIdx = Number(excelIdxStr);
        const subCol = subitemColumns[subColIdx];
        const rawValue = row[excelIdx];
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "" || String(rawValue).trim() === ".") continue;
        const cv = parseCellValue(rawValue, subCol, {});
        if (cv) subColumnValues.push(cv);
      }

      const subitem: SubItem = {
        id: `si-excel-${rowIdx}`,
        parentId: parentItem.id,
        name: subitemName,
        columnValues: subColumnValues,
        createdAt: new Date().toISOString(),
      };

      if (!parentItem.subItems) parentItem.subItems = [];
      parentItem.subItems.push(subitem);
      continue;
    }

    // ---- Caso 7: Procesar item normal ----
    const item: Item = {
      id: `i-excel-${rowIdx}`,
      boardId: "pending",
      groupId: currentGroup.id,
      name: col0,
      columnValues: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      position: itemPosition++,
    };

    // Procesar valores de cada columna
    for (const [excelIdxStr, ourIdx] of Object.entries(excelColToOurCol)) {
      const excelIdx = Number(excelIdxStr);
      const col = columns[ourIdx];
      if (!col) continue;

      const rawValue = row[excelIdx];
      if (rawValue === undefined || rawValue === null) continue;
      const strVal = String(rawValue).trim();
      if (strVal === "" || strVal === "." || strVal.toLowerCase() === "null") continue;

      const cv = parseCellValue(rawValue, col, textToLabelId);
      if (cv) item.columnValues.push(cv);
    }

    // Verificar si la columna "Subitems" del Excel indica que este item tiene subitems
    // En Monday.com, la columna "Subitems" contiene el número de subitems
    for (let c = 1; c < headerRow.length; c++) {
      const header = String(headerRow[c] ?? "").trim().toLowerCase();
      if (header === "subitems" || header === "subelementos") {
        const subitemsCount = parseInt(String(row[c] ?? "0"), 10);
        if (subitemsCount > 0) {
          parentItem = item;
        } else {
          parentItem = null;
        }
        break;
      }
    }

    items.push(item);
  }

  // ============================================================
  // PASO 6: Construir board completo
  // ============================================================
  if (groups.length === 0) {
    groups.push({
      id: "g-excel-0",
      title: "Group 1",
      color: GROUP_COLORS[0],
      position: 0,
      collapsed: false,
    });
  }

  const boardId = `excel-b-${Date.now()}`;
  items.forEach((i) => (i.boardId = boardId));

  // Asegurar que las columnas de status tienen labels mínimas
  columns.forEach((col) => {
    if ((col.type === "status" || col.type === "priority") && (!col.labels || Object.keys(col.labels).length === 0)) {
      col.labels = {
        "0": { name: "Working on it", color: "#FFC700" },
        "1": { name: "Done", color: "#00C875" },
        "2": { name: "Stuck", color: "#E2445C" },
        "3": { name: "Not Started", color: "#C4C4C4" },
      };
    }
  });

  const board: Board = {
    id: boardId,
    workspaceId: "m-w-imported",
    name: boardName,
    description: `Importado desde Excel: ${fileName}`,
    boardKind: "public",
    boardType: "board",
    columns,
    groups,
    items,
    views: [
      { id: `v-${Date.now()}`, name: "Main Table", type: "main_table" },
      { id: `v-${Date.now()}-k`, name: "Kanban", type: "kanban" },
      { id: `v-${Date.now()}-c`, name: "Calendario", type: "calendar" },
    ],
  };

  const subitemsCount = items.reduce((a, i) => a + (i.subItems?.length ?? 0), 0);
  warnings.push(`${items.length} tareas, ${groups.length} grupos, ${columns.length - 1} columnas, ${subitemsCount} subitems`);

  return { board, warnings };
}

// ---- Parsear valor de celda según tipo ----
function parseCellValue(
  rawValue: any,
  col: ColumnDef,
  textToLabelId: Record<string, Record<string, string>>
): ColumnValue | null {
  const strValue = String(rawValue ?? "").trim();
  if (!strValue || strValue === "." || strValue.toLowerCase() === "null") return null;

  switch (col.type) {
    case "date": {
      // Si es un número (serial de Excel), convertir a fecha
      if (typeof rawValue === "number" && rawValue > 1000 && rawValue < 100000) {
        const iso = excelDateToISO(rawValue);
        if (iso) return { columnId: col.id, value: { date: iso } };
      }
      // Si ya es una fecha en texto (DD/MM/YYYY, YYYY-MM-DD, etc.)
      // Intentar parsear
      const dateMatch = strValue.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
      if (dateMatch) {
        let [, p1, p2, p3] = dateMatch;
        let year, month, day;
        if (p1.length === 4) {
          // YYYY-MM-DD
          year = p1; month = p2; day = p3;
        } else if (p3.length === 4) {
          // DD-MM-YYYY o MM-DD-YYYY (asumir DD-MM-YYYY)
          year = p3; month = p2; day = p1;
        } else {
          // 2 dígitos para año
          year = "20" + p3; month = p2; day = p1;
        }
        const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { columnId: col.id, value: { date: iso } };
      }
      // Si tiene "to" es un rango — guardar como texto
      if (strValue.includes(" to ") || strValue.includes(" - ")) {
        return { columnId: col.id, value: { text: strValue } };
      }
      return { columnId: col.id, value: { date: strValue } };
    }

    case "numbers": {
      // Limpiar símbolos de moneda y separadores
      const cleanStr = strValue.replace(/[$€£¥₹,]/g, "").trim();
      const num = typeof rawValue === "number" ? rawValue : parseFloat(cleanStr);
      if (!isNaN(num)) return { columnId: col.id, value: { text: String(num) } };
      return { columnId: col.id, value: { text: strValue } };
    }

    case "checkbox": {
      const checked = rawValue === true || strValue === "true" || strValue === "1" || strValue === "✓" || strValue.toLowerCase() === "v" || strValue.toLowerCase() === "yes" || strValue.toLowerCase() === "sí" || strValue.toLowerCase() === "si";
      return { columnId: col.id, value: { checked } };
    }

    case "people": {
      // Monday exporta nombres separados por coma
      // Lo guardamos como texto para que se muestre el nombre
      return { columnId: col.id, value: { text: strValue } };
    }

    case "status":
    case "priority": {
      // Limpiar emojis
      const cleanLabel = strValue.replace(/[✅☑️⚠️❌🟡🔵🟣🟢🔴]/g, "").trim();
      if (!cleanLabel) return null;
      // Mapear a labelId si existe
      const labelMap = textToLabelId[col.id];
      if (labelMap) {
        const labelId = labelMap[cleanLabel.toLowerCase()];
        if (labelId) {
          return { columnId: col.id, value: { labelId } };
        }
      }
      // Si no hay label, guardar como texto
      return { columnId: col.id, value: { text: cleanLabel } };
    }

    case "progress": {
      // Intentar extraer porcentaje
      const numMatch = strValue.match(/(\d+)/);
      if (numMatch) {
        const pct = parseInt(numMatch[1], 10);
        return { columnId: col.id, value: { text: String(pct) } };
      }
      return { columnId: col.id, value: { text: strValue } };
    }

    default:
      return { columnId: col.id, value: { text: strValue } };
  }
}

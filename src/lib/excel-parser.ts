// ============================================================================
// Parser de Excel exportado desde Monday.com — MÁQUINA DE ESTADOS
// ============================================================================
// Recorre el Excel fila por fila con una máquina de estados que identifica:
// 1. Metadatos del inicio (ignorar)
// 2. Nombre de grupo (capturar)
// 3. Fila "Name" = headers de columnas (mapear, NO crear item)
// 4. Filas de datos (crear items)
// 5. Filas de totales (col A vacía → ignorar)
// 6. Repite el ciclo para cada grupo

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
};

function getStatusColor(label: string): string {
  const lower = label.toLowerCase().replace(/[✅☑️⚠️❌🟡🔵🟣🟢🔴]/g, "").trim();
  if (MONDAY_STATUS_COLORS[lower]) return MONDAY_STATUS_COLORS[lower];
  for (const [key, color] of Object.entries(MONDAY_STATUS_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#579BFC";
}

// ---- Colores para grupos (rotar como Monday) ----
const GROUP_COLORS = ["#FFC700", "#FF642E", "#00C875", "#A25BFF", "#579BFC", "#FF158A", "#401694", "#9CD326"];

// ---- Mapeo de nombres de columna Excel → tipo interno ----
function inferColumnType(header: string): ColumnDef["type"] {
  const h = header.toLowerCase().trim();
  if (h === "name" || h === "nombre" || h === "item" || h === "elemento") return "text";
  if (h === "subelementos" || h === "subitems") return "text";
  if (h.includes("propietario") || h.includes("owner") || h.includes("people") || h.includes("persona")) return "people";
  if (h === "estado" || h === "status") return "status";
  if (h.includes("prioridad") || h === "priority") return "priority";
  if (h.includes("tipo") && h.length <= 5) return "status";
  if (h.includes("categoría") || h.includes("categoria") || h.includes("category")) return "status";
  if (h.includes("obra")) return "status";
  if (h.includes("fecha") || h.includes("date") || h.includes("deadline") || h.includes("límite")) return "date";
  if (h.includes("cronograma") || h.includes("timeline") || h.includes("schedule")) return "date";
  if (h.includes("duración") || h.includes("duration")) return "numbers";
  if (h.includes("esfuerzo") || h.includes("effort")) return "numbers";
  if (h.includes("pago") || h.includes("monto") || h.includes("saldo") || h.includes("flujo")) return "numbers";
  if (h.includes("depende") || h.includes("depend")) return "text";
  if (h.includes("progreso")) return "status";
  if (h.includes("checkbox") || h === "✓") return "checkbox";
  if (h.includes("email") || h.includes("correo")) return "email";
  if (h.includes("teléfono") || h.includes("phone")) return "phone";
  if (h.includes("link") || h.includes("enlace")) return "link";
  if (h.includes("item id") || h.includes("auto")) return "auto_number";
  return "text";
}

// ---- Anchos recomendados por tipo de columna (igual que boards manuales) ----
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
};

export interface ParsedExcelBoard {
  board: Board;
  warnings: string[];
}

export function parseMondayExcel(
  rows: any[][],
  fileName: string
): ParsedExcelBoard {
  const warnings: string[] = [];

  if (rows.length < 3) {
    throw new Error("El archivo Excel no tiene suficientes filas");
  }

  // ---- 1. Extraer nombre del board (row 0, col 0) ----
  const boardName = String(rows[0]?.[0] ?? fileName.replace(/\.xlsx?$/i, "")).trim();

  // ---- 2. Encontrar la primera fila de headers ----
  let headerRowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] ?? "").trim().toLowerCase();
    if (col0 === "name" || col0 === "nombre" || col0 === "item" || col0 === "elemento") {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error("No se encontró fila de headers (Nombre/name)");
  }

  const headerRow = rows[headerRowIdx];

  // ---- 3. Crear columnas 1:1 desde los headers del Excel ----
  // MISMA ESTRUCTURA que los boards manuales
  const columns: ColumnDef[] = [{
    id: "name",
    title: "Tarea",
    type: "text",
    width: COLUMN_WIDTHS.text,
  }];

  for (let c = 1; c < headerRow.length; c++) {
    const header = String(headerRow[c] ?? "").trim();
    if (!header) continue;

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

  // ---- 4. Primera pasada: recolectar todos los valores de status para crear labels ----
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
    if (!col0) continue;
    if (col0 === "Subitems" || col0 === "Nombre" || col0 === "name") continue;

    let nonEmpty = 0;
    for (let c = 1; c < row.length; c++) {
      if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== "" && String(row[c]).trim() !== ".") nonEmpty++;
    }
    if (nonEmpty <= 1) continue;

    for (let c = 1; c < columns.length; c++) {
      const col = columns[c];
      if (!col || (col.type !== "status" && col.type !== "priority")) continue;

      const rawValue = row[c];
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

  // ---- 5. Segunda pasada: extraer grupos, items y subitems ----
  const groups: Group[] = [];
  const items: Item[] = [];
  let currentGroup: Group | null = null;
  let currentGroupColorIdx = 0;
  let itemPosition = 0;
  let inSubitems = false;
  let parentItem: Item | null = null;
  let expectingGroup = true;
  let subitemColumns: ColumnDef[] = [];
  let subitemColIndexMap: Record<number, number> = {};

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row || row.length === 0) {
      inSubitems = false;
      parentItem = null;
      expectingGroup = true;
      continue;
    }

    const col0 = String(row[0] ?? "").trim();

    let nonEmptyAfterCol0 = 0;
    for (let c = 1; c < row.length; c++) {
      const v = row[c];
      if (v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== ".") nonEmptyAfterCol0++;
    }

    // ---- Detectar grupo ----
    if (col0 && col0 !== "Name" && col0 !== "Subitems" && col0 !== "name" && col0 !== "Nombre" && col0.length <= 60 && nonEmptyAfterCol0 <= 1 && (expectingGroup || groups.length === 0)) {
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
      expectingGroup = false;
      continue;
    }

    expectingGroup = false;

    // ---- Headers repetidos ----
    if (col0 === "Nombre" || col0 === "name" || col0 === "Item" || col0 === "Elemento") {
      continue;
    }

    // ---- Subitems header ----
    if (col0 === "Subitems") {
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

    // ---- Fila de totales (nombre vacío) ----
    if (!col0 && currentGroup && !inSubitems) {
      continue;
    }

    // ---- Crear grupo default si no hay ----
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

    // ---- Salir de modo subitems si hay col0 ----
    if (inSubitems && col0 && col0 !== "Subitems") {
      inSubitems = false;
      parentItem = null;
    }

    // ---- Procesar subitem ----
    if (inSubitems && parentItem) {
      const subitemName = String(row[1] ?? "").trim() || "Subitem";
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

    // ---- Procesar item normal ----
    if (!col0) continue;

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

    for (let c = 1; c < columns.length; c++) {
      const col = columns[c];
      if (!col) continue;

      const rawValue = row[c];
      if (rawValue === undefined || rawValue === null) continue;
      const strVal = String(rawValue).trim();
      if (strVal === "" || strVal === "." || strVal.toLowerCase() === "null") continue;

      const cv = parseCellValue(rawValue, col, textToLabelId);
      if (cv) item.columnValues.push(cv);
    }

    const subelementosValue = String(row[1] ?? "").trim();
    if (subelementosValue && subelementosValue !== "." && subelementosValue.toLowerCase() !== "subelementos") {
      parentItem = item;
    } else {
      parentItem = null;
    }

    items.push(item);
  }

  // ---- 6. Construir board completo — MISMA ESTRUCTURA que boards manuales ----
  if (groups.length === 0) {
    groups.push({
      id: "g-excel-0",
      title: "Grupo 1",
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
        "0": { name: "Listo", color: "#00C875" },
        "1": { name: "En proceso", color: "#FFC700" },
        "2": { name: "Pendiente", color: "#579BFC" },
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
    // MISMAS VISTAS que los boards manuales
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
      if (typeof rawValue === "number") {
        if (rawValue % 1 !== 0) {
          // datetime
          const iso = excelDateToISO(rawValue);
          if (iso) return { columnId: col.id, value: { date: iso } };
        } else {
          const iso = excelDateToISO(rawValue);
          if (iso) return { columnId: col.id, value: { date: iso } };
        }
      }
      if (strValue.includes(" to ")) return null;
      return { columnId: col.id, value: { date: strValue } };
    }

    case "numbers": {
      const num = typeof rawValue === "number" ? rawValue : parseFloat(strValue.replace(/[^0-9.-]/g, ""));
      if (!isNaN(num)) return { columnId: col.id, value: { text: String(num) } };
      return { columnId: col.id, value: { text: strValue } };
    }

    case "checkbox": {
      const checked = rawValue === true || strValue === "true" || strValue === "1" || strValue === "✓" || strValue.toLowerCase() === "v";
      return { columnId: col.id, value: { checked } };
    }

    case "people": {
      return { columnId: col.id, value: { text: strValue } };
    }

    case "status":
    case "priority": {
      const cleanLabel = strValue.replace(/[✅☑️⚠️❌🟡🔵🟣🟢🔴]/g, "").trim();
      if (!cleanLabel) return null;
      const labelMap = textToLabelId[col.id];
      if (labelMap) {
        const labelId = labelMap[cleanLabel.toLowerCase()];
        if (labelId) {
          return { columnId: col.id, value: { labelId } };
        }
      }
      return { columnId: col.id, value: { text: cleanLabel } };
    }

    default:
      return { columnId: col.id, value: { text: strValue } };
  }
}

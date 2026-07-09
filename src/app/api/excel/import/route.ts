// ============================================================================
// API: /api/excel/import — recibe un archivo Excel de Monday.com, lo parsea
// y devuelve un board completo listo para fusionar en el store
// ============================================================================
// OPTIMIZACIÓN: limitar filas procesadas para evitar OOM en sandbox de 4GB.
// Monday.com puede exportar Excel con miles de filas — el parser las procesa
// todas en memoria. Limitamos a 2000 filas para que no crashee el server.
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parseMondayExcel } from "@/lib/excel-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Máximo de filas a procesar (para evitar OOM en sandbox)
const MAX_ROWS = 2000;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No se recibió ningún archivo" },
        { status: 400 }
      );
    }

    if (!file.name.match(/\.xlsx?$/i)) {
      return NextResponse.json(
        { ok: false, error: "El archivo debe ser .xlsx o .xls" },
        { status: 400 }
      );
    }

    // Validar tamaño del archivo (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: `Archivo demasiado grande: ${Math.round(file.size / 1024 / 1024)}MB. Máximo 5MB.` },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let wb: XLSX.WorkBook;
    try {
      // Usar cellDates para parsear fechas correctamente
      wb = XLSX.read(buffer, { type: "buffer", cellDates: false, cellNF: false, cellText: false });
    } catch (parseErr: any) {
      console.error("[excel-import] XLSX.read error:", parseErr?.message);
      return NextResponse.json(
        { ok: false, error: `No se pudo leer el Excel: ${parseErr?.message ?? "formato inválido"}. Asegúrate de que sea un archivo .xlsx válido exportado de Monday.com.` },
        { status: 400 }
      );
    }

    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) {
      return NextResponse.json(
        { ok: false, error: "El archivo no tiene hojas" },
        { status: 400 }
      );
    }

    // Parsear filas — limitar a MAX_ROWS para evitar OOM
    let rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as any[][];
    
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "La primera hoja está vacía" },
        { status: 400 }
      );
    }

    // Truncar si excede el máximo
    let truncated = false;
    const originalCount = rows.length;
    if (rows.length > MAX_ROWS) {
      rows = rows.slice(0, MAX_ROWS);
      truncated = true;
    }

    // Parsear con try/catch específico
    let board, warnings;
    try {
      const result = parseMondayExcel(rows, file.name);
      board = result.board;
      warnings = result.warnings;
    } catch (parseErr: any) {
      console.error("[excel-import] parseMondayExcel error:", parseErr?.message);
      return NextResponse.json(
        { ok: false, error: `Error al parsear el Excel: ${parseErr?.message ?? "estructura no reconocida"}. El archivo debe ser un export de Monday.com.` },
        { status: 400 }
      );
    }

    if (truncated) {
      warnings.push(`⚠️ Se procesaron las primeras ${MAX_ROWS} filas de ${originalCount} totales (límite de memoria).`);
    }

    return NextResponse.json({
      ok: true,
      board,
      warnings,
      summary: {
        boardName: board.name,
        groups: board.groups.length,
        items: board.items.length,
        columns: board.columns.length,
        subitems: board.items.reduce(
          (a, i) => a + (i.subItems?.length ?? 0),
          0
        ),
      },
    });
  } catch (e: any) {
    console.error("[excel-import] Error general:", e?.message);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error al parsear el Excel" },
      { status: 500 }
    );
  }
}

// ============================================================================
// API: /api/excel/import — recibe un archivo Excel de Monday.com, lo parsea
// y devuelve un board completo listo para fusionar en el store
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parseMondayExcel } from "@/lib/excel-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const wb = XLSX.read(buffer, { type: "buffer" });

    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) {
      return NextResponse.json(
        { ok: false, error: "El archivo no tiene hojas" },
        { status: 400 }
      );
    }

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];

    const { board, warnings } = parseMondayExcel(rows, file.name);

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
    console.error("[excel-import] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error al parsear el Excel" },
      { status: 500 }
    );
  }
}

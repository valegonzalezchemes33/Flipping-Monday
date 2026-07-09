// ============================================================================
// API: /api/agent/parse-file — Parsea archivos para que la IA los pueda leer
// ============================================================================
// Recibe: { file: base64, fileName, mimeType }
// Devuelve: { text: string, type: string, summary: string }
//
// Soporta:
// - Imágenes (PNG, JPG, GIF, WebP) → usa VLM para describirlas
// - Excel (.xlsx, .xls) → extrae datos como tabla markdown
// - Word (.docx) → extrae texto del documento
// - PDF → extrae texto
// - CSV → devuelve contenido como texto
// - Texto (.txt, .json, .md, .csv, código) → devuelve contenido
import { NextRequest, NextResponse } from "next/server";
import { getZaiInstance } from "@/lib/groq-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParseRequest {
  file: string; // data URL: data:mime;base64,xxxx
  fileName: string;
  mimeType: string;
  prompt?: string; // para imágenes: qué buscar
}

export async function POST(req: NextRequest) {
  let body: ParseRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { file, fileName, mimeType, prompt } = body;

  if (!file || !file.startsWith("data:")) {
    return NextResponse.json(
      { error: "file debe ser un data URL (data:mime;base64,...)" },
      { status: 400 }
    );
  }

  // Validar tamaño (máx 10MB)
  const approxBytes = (file.length * 3) / 4;
  if (approxBytes > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Archivo demasiado grande (máx 10MB)" },
      { status: 413 }
    );
  }

  try {
    // Extraer el base64 y el mime real
    const base64Match = file.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json(
        { error: "Formato data URL inválido" },
        { status: 400 }
      );
    }
    const actualMime = base64Match[1];
    const base64Data = base64Match[2];
    const buffer = Buffer.from(base64Data, "base64");

    // Detectar tipo de archivo
    const ext = fileName.toLowerCase().split(".").pop() ?? "";
    const isImage = actualMime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext);
    const isExcel = actualMime.includes("spreadsheet") || ["xlsx", "xls"].includes(ext);
    const isWord = actualMime.includes("word") || ["docx", "doc"].includes(ext);
    const isPdf = actualMime === "application/pdf" || ext === "pdf";
    const isCsv = actualMime === "text/csv" || ext === "csv";
    const isText = actualMime.startsWith("text/") || ["txt", "json", "md", "xml", "html", "css", "js", "ts", "py", "sql", "yaml", "yml", "sh"].includes(ext);

    // === IMAGEN → VLM ===
    if (isImage) {
      return await parseImage(file, prompt, fileName);
    }

    // === EXCEL → XLSX library ===
    if (isExcel) {
      return await parseExcel(buffer, fileName);
    }

    // === WORD ===
    if (isWord) {
      return await parseWord(buffer, fileName, ext);
    }

    // === PDF ===
    if (isPdf) {
      return await parsePdf(buffer, fileName);
    }

    // === CSV ===
    if (isCsv) {
      return parseCsv(buffer, fileName);
    }

    // === TEXTO ===
    if (isText) {
      return parseText(buffer, fileName);
    }

    // Tipo no soportado
    return NextResponse.json({
      text: `(Archivo "${fileName}" de tipo ${actualMime} — tipo no soportado para parseo automático. Solo se soportan: imágenes, Excel, Word, PDF, CSV y texto.)`,
      type: "unsupported",
      summary: `Archivo no soportado: ${actualMime}`,
    });
  } catch (err: any) {
    console.error("[parse-file] error:", err?.message);
    return NextResponse.json(
      { error: `Error parseando archivo: ${err?.message ?? "desconocido"}` },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// Parsear imagen con VLM (con retry/backoff para 502/429)
// ----------------------------------------------------------------------------
async function parseImage(dataUrl: string, prompt: string | undefined, fileName: string) {
  const userPrompt =
    prompt?.trim() ||
    "Describe lo que ves en esta imagen en detalle. Si hay texto, transcríbelo. Si hay datos, tablas o gráficos, extrae la información clave.";

  // Validar que el data URL no sea demasiado grande (máx ~4MB para VLM)
  const approxSize = (dataUrl.length * 3) / 4;
  if (approxSize > 4 * 1024 * 1024) {
    return NextResponse.json({
      text: `(Imagen demasiado grande para el VLM: ${Math.round(approxSize / 1024 / 1024)}MB. El máximo es 4MB. Intenta con una imagen más pequeña.)`,
      type: "image_error",
      summary: `Imagen demasiado grande`,
    });
  }

  // Reintentar hasta 4 veces en 502/429 con backoff exponencial
  const maxRetries = 4;
  let lastErr: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const zai = await getZaiInstance();

      const completion: any = await zai.chat.completions.createVision({
        model: "glm-4v",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        thinking: { type: "disabled" },
      });

      const text =
        completion?.choices?.[0]?.message?.content ??
        "(no se pudo extraer contenido de la imagen)";

      return NextResponse.json({
        text,
        type: "image",
        summary: `Imagen analizada con VLM: ${fileName}`,
      });
    } catch (err: any) {
      lastErr = err;
      const msg = (err?.message ?? "").toLowerCase();
      // Reintentar en: 502 (Bad Gateway), 429 (rate limit), timeout, network error
      const isRetryable =
        msg.includes("502") ||
        msg.includes("bad gateway") ||
        msg.includes("429") ||
        msg.includes("rate") ||
        msg.includes("timeout") ||
        msg.includes("context deadline") ||
        msg.includes("network");
      if (isRetryable && attempt < maxRetries) {
        const waitMs = 1500 * Math.pow(2, attempt); // 1.5s, 3s, 6s, 12s
        console.log(`[parse-file] VLM retry ${attempt + 1}/${maxRetries} en ${waitMs}ms (${msg.slice(0, 80)})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      // Si no es reintentable o se agotaron los intentos, devolver error
      break;
    }
  }

  // Si llegamos aquí, todos los reintentos fallaron
  const errMsg = lastErr?.message ?? "Error desconocido";
  return NextResponse.json({
    text: `(No pude analizar la imagen después de varios intentos. Error: ${errMsg}. Posibles causas: 1) El servicio de visión está temporalmente saturado, 2) La imagen es demasiado grande, 3) Formato no soportado. Intenta nuevamente en unos segundos o usa una imagen más pequeña.)`,
    type: "image_error",
    summary: `Error en VLM tras reintentos`,
  });
}

// ----------------------------------------------------------------------------
// Parsear Excel con XLSX
// ----------------------------------------------------------------------------
async function parseExcel(buffer: Buffer, fileName: string) {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });

    let result = "";
    let totalRows = 0;
    const sheetNames = workbook.SheetNames;

    for (const sheetName of sheetNames.slice(0, 5)) {
      // máximo 5 hojas
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

      if (rows.length === 0) continue;

      result += `\n=== Hoja: ${sheetName} (${rows.length} filas) ===\n`;

      // Convertir a tabla markdown (limitar a primeras 50 filas)
      const maxRows = Math.min(rows.length, 50);
      for (let i = 0; i < maxRows; i++) {
        const row = rows[i];
        const cells = row.map((c) => String(c ?? "").slice(0, 50)).join(" | ");
        result += `| ${cells} |\n`;
      }

      if (rows.length > 50) {
        result += `... (${rows.length - 50} filas más)\n`;
      }

      totalRows += rows.length;
    }

    return NextResponse.json({
      text: result || "(Excel vacío o sin datos)",
      type: "excel",
      summary: `Excel: ${fileName} — ${sheetNames.length} hojas, ${totalRows} filas total`,
    });
  } catch (err: any) {
    return NextResponse.json({
      text: `(Error parseando Excel: ${err?.message})`,
      type: "excel_error",
      summary: `Error parseando Excel`,
    });
  }
}

// ----------------------------------------------------------------------------
// Parsear Word (.docx)
// ----------------------------------------------------------------------------
async function parseWord(buffer: Buffer, fileName: string, ext: string) {
  try {
    // Para .docx: extraer texto del XML del zip
    // Para .doc (binario): no soportado fácilmente sin librería pesada
    if (ext === "doc") {
      return NextResponse.json({
        text: `(Archivo .doc legacy "${fileName}". Los archivos .doc antiguo no se pueden parsear automáticamente. Conviértelo a .docx o PDF.)`,
        type: "word_legacy",
        summary: `Word .doc no soportado`,
      });
    }

    // .docx es un zip con document.xml adentro
    const JSZip = await import("jszip").catch(() => null);
    if (!JSZip) {
      // Fallback: intentar extraer texto del buffer buscando strings
      const text = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
      return NextResponse.json({
        text: text || `(No se pudo extraer texto de ${fileName})`,
        type: "word",
        summary: `Word (extracción básica): ${fileName}`,
      });
    }

    const zip = await (JSZip as any).loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("string");

    if (!docXml) {
      return NextResponse.json({
        text: `(No se encontró document.xml en ${fileName})`,
        type: "word_error",
        summary: `Word inválido`,
      });
    }

    // Extraer texto del XML (quitar tags)
    const text = docXml
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000); // limitar a 8000 chars

    return NextResponse.json({
      text,
      type: "word",
      summary: `Word: ${fileName} — ${text.length} caracteres`,
    });
  } catch (err: any) {
    return NextResponse.json({
      text: `(Error parseando Word: ${err?.message})`,
      type: "word_error",
      summary: `Error parseando Word`,
    });
  }
}

// ----------------------------------------------------------------------------
// Parsear PDF
// ----------------------------------------------------------------------------
async function parsePdf(buffer: Buffer, fileName: string) {
  try {
    // Intentar con pdf-parse si está disponible
    const pdfParse = await import("pdf-parse").catch(() => null);

    if (!pdfParse) {
      // Fallback: extraer texto buscando streams de texto
      const text = buffer.toString("latin1").match(/\(([^)]+)\)/g)?.map((s) => s.slice(1, -1)).join(" ").slice(0, 5000) ?? "";
      return NextResponse.json({
        text: text || `(No se pudo extraer texto del PDF ${fileName}. PDF escaneado o protegido.)`,
        type: "pdf",
        summary: `PDF (extracción básica): ${fileName}`,
      });
    }

    const data = await (pdfParse as any)(buffer);
    const text = (data.text || "").slice(0, 8000);

    return NextResponse.json({
      text,
      type: "pdf",
      summary: `PDF: ${fileName} — ${data.numpages || "?"} páginas, ${text.length} caracteres`,
    });
  } catch (err: any) {
    return NextResponse.json({
      text: `(Error parseando PDF: ${err?.message}. Puede ser un PDF escaneado que requiere OCR.)`,
      type: "pdf_error",
      summary: `Error parseando PDF`,
    });
  }
}

// ----------------------------------------------------------------------------
// Parsear CSV
// ----------------------------------------------------------------------------
function parseCsv(buffer: Buffer, fileName: string) {
  const text = buffer.toString("utf-8").slice(0, 8000);
  const lines = text.split("\n").filter((l) => l.trim());
  const rowCount = lines.length;
  const colCount = lines[0]?.split(",").length ?? 0;

  return NextResponse.json({
    text,
    type: "csv",
    summary: `CSV: ${fileName} — ${rowCount} filas, ${colCount} columnas`,
  });
}

// ----------------------------------------------------------------------------
// Parsear texto plano
// ----------------------------------------------------------------------------
function parseText(buffer: Buffer, fileName: string) {
  const text = buffer.toString("utf-8").slice(0, 8000);

  return NextResponse.json({
    text,
    type: "text",
    summary: `Texto: ${fileName} — ${text.length} caracteres`,
  });
}

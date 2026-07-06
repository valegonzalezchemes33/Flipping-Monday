// ============================================================================
// API: /api/agent/vision — Análisis de imágenes con NVIDIA NIM (Llama 3.2 Vision)
// ============================================================================
// Recibe: { image: dataURL (base64), prompt? }
// Devuelve: { text: string } — descripción/análisis de la imagen
// Usa NVIDIA NIM (Llama 3.2 90B Vision Instruct) con la API key única.
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_API_KEY =
  process.env.NVIDIA_API_KEY ||
  "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";

interface VisionRequest {
  image: string; // data URL: data:image/png;base64,xxxx
  prompt?: string;
}

export async function POST(req: NextRequest) {
  let body: VisionRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { image, prompt } = body;

  if (!image || !image.startsWith("data:")) {
    return new Response(
      JSON.stringify({ error: "image debe ser un data URL (data:image/...;base64,...)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validar tamaño razonable (máx ~10MB en base64)
  const approxBytes = (image.length * 3) / 4;
  if (approxBytes > 10 * 1024 * 1024) {
    return new Response(
      JSON.stringify({ error: "Imagen demasiado grande (máx 10MB)" }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
  }

  const userPrompt =
    prompt?.trim() ||
    "Describe lo que ves en esta imagen en detalle. Si hay texto, transcríbelo. Si hay datos, tablas o gráficos, extrae la información clave.";

  try {
    // Reintentar hasta 3 veces en 429 con backoff exponencial
    const maxRetries = 3;
    let lastErr: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${NVIDIA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta/llama-3.2-90b-vision-instruct",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: userPrompt },
                  { type: "image_url", image_url: { url: image } },
                ],
              },
            ],
            max_tokens: 1000,
            temperature: 0.2,
          }),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
            const waitMs = 1000 * Math.pow(2, attempt);
            console.log(`[vision] HTTP ${res.status}, retry ${attempt + 1}/${maxRetries} en ${waitMs}ms`);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          throw new Error(`NVIDIA HTTP ${res.status}: ${txt.slice(0, 200)}`);
        }

        const data = await res.json();
        const text =
          data?.choices?.[0]?.message?.content ??
          "(no se pudo extraer contenido de la imagen)";

        return new Response(
          JSON.stringify({ text, model: "meta/llama-3.2-90b-vision-instruct" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        lastErr = e;
        const msg = (e?.message ?? "").toLowerCase();
        const isRetryable =
          msg.includes("429") || msg.includes("rate") || msg.includes("too many requests");
        if (isRetryable && attempt < maxRetries) {
          const waitMs = 1000 * Math.pow(2, attempt);
          console.log(`[vision] retry ${attempt + 1}/${maxRetries} en ${waitMs}ms`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw e;
      }
    }
    throw lastErr ?? new Error("Vision: fallo desconocido tras reintentos");
  } catch (err: any) {
    console.error("[vision] error:", err?.message);
    const msg = err?.message ?? "Error desconocido";
    const status = msg.includes("429") || msg.toLowerCase().includes("rate") ? 429 : 500;
    return new Response(
      JSON.stringify({
        error: `No pude analizar la imagen: ${msg}`,
        retryable: status === 429,
      }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
}

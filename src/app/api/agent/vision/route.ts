// ============================================================================
// API: /api/agent/vision — Análisis de imágenes con VLM (Vision Language Model)
// ============================================================================
// Recibe: { image: dataURL (base64), prompt, history? }
// Devuelve: { text: string } — descripción/análisis de la imagen
// Usa el SDK z-ai-web-dev-sdk (GLM-4V) que SÍ funciona en este sandbox.
// Esto permite al Sidekick "ver" imágenes adjuntadas por el usuario.
import { NextRequest } from "next/server";
import { getZaiInstance } from "@/lib/groq-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const zai = await getZaiInstance();

    // Reintentar hasta 4 veces en 429 con backoff exponencial (1s, 2s, 4s, 8s)
    const maxRetries = 4;
    let lastErr: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const completion: any = await zai.chat.completions.createVision({
          model: "glm-4v",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ],
          thinking: { type: "disabled" },
        });

        const text =
          completion?.choices?.[0]?.message?.content ??
          "(no se pudo extraer contenido de la imagen)";

        return new Response(JSON.stringify({ text, model: "glm-4v" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e: any) {
        lastErr = e;
        const msg = (e?.message ?? "").toLowerCase();
        const isRetryable = msg.includes("429") || msg.includes("rate") ||
          msg.includes("too many requests") || msg.includes("timeout");
        if (isRetryable && attempt < maxRetries) {
          const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s
          console.log(`[vision] 429, retry ${attempt + 1}/${maxRetries} en ${waitMs}ms`);
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

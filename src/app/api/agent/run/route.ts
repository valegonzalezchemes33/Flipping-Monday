// ============================================================================
// API: /api/agent/run — Ejecuta un agente IA con streaming SSE
// ============================================================================
// El SDK z-ai-web-dev-sdk no soporta true streaming de tokens; usamos
// non-streaming y "troceamos" la respuesta en palabras para simular UX streaming.
import { NextRequest } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AgentRunRequest {
  agentId: string;
  agentName: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  userPrompt: string;
  itemId?: string;
}

export async function POST(req: NextRequest) {
  let body: AgentRunRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { systemPrompt, temperature, maxTokens, userPrompt, agentName } = body;

  if (!systemPrompt || !userPrompt) {
    return new Response(
      JSON.stringify({ error: "systemPrompt and userPrompt are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const abortListener = () => { try { controller.close(); } catch {} };
      req.signal.addEventListener("abort", abortListener);
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {}
      };

      try {
        send("meta", { agentName, startedAt: new Date().toISOString() });
        send("info", { message: "Inicializando modelo…" });

        const zai = await ZAI.create();

        const modelMap: Record<string, string> = {
          "glm-4.6": "glm-4.6",
          "glm-4.5-air": "glm-4.5-air",
          "gpt-4o": "glm-4.6",
          "claude-sonnet-5": "glm-4.6",
        };
        const sdkModel = modelMap[body.model] ?? "glm-4.6";

        // Non-streaming call
        const completion: any = await zai.chat.completions.create({
          model: sdkModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        });

        const content =
          completion?.choices?.[0]?.message?.content ??
          completion?.choices?.[0]?.delta?.content ??
          "";

        if (!content) {
          send("error", { message: "El modelo devolvió contenido vacío" });
          controller.close();
          return;
        }

        // Simular streaming cortando en palabras para UX
        const tokens = content.split(/(\s+)/);
        for (let i = 0; i < tokens.length; i += 2) {
          const chunk = tokens.slice(i, i + 2).join("");
          if (chunk) {
            send("chunk", { text: chunk });
            await new Promise((r) => setTimeout(r, 18));
          }
        }

        const tokensUsed =
          completion?.usage?.total_tokens ??
          completion?.usage?.completion_tokens ??
          Math.ceil(content.length / 4);

        send("done", {
          completedAt: new Date().toISOString(),
          tokensUsed,
          fullOutput: content,
        });
      } catch (err: any) {
        send("error", {
          message: err?.message ?? "Error desconocido en ejecución del agente",
        });
      } finally {
        req.signal.removeEventListener("abort", abortListener);
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

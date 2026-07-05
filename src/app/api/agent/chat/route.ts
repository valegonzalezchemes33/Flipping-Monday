// ============================================================================
// API: /api/agent/chat — Sidekick chat con tool calling loop
// ============================================================================
// Recibe: { messages, groqApiKey?, context (boardId, itemId, userName...) }
// Devuelve: SSE stream con eventos: delta (texto), tool_call, tool_result, done
// El loop: LLM → si tool_calls → ejecutar → devolver resultado → LLM → repeat
import { NextRequest } from "next/server";
import { chat, type GroqMessage, type GroqTool } from "@/lib/groq-client";
import { SIDEKICK_TOOLS, buildSystemPrompt } from "@/lib/sidekick-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  messages: GroqMessage[];
  groqApiKey?: string;
  model?: string; // modelo a usar; si no se especifica, se elige automaticamente
  context?: {
    userName?: string;
    activeBoardName?: string;
    activeBoardId?: string;
    selectedItemName?: string;
    selectedItem?: string;
    workspaceName?: string;
    selectedItemUpdates?: any[];
    selectedItemFiles?: any[];
    selectedItemColumnValues?: any[];
  };
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, groqApiKey, context, model: requestedModel } = body;

  // Elegir modelo: si hay key de Groq y no se especificó un modelo Z.ai, usar Groq.
  // Si el requestedModel es un modelo de Groq ya (llama, deepseek) y hay key, usarlo.
  // Si no hay key de Groq, usar glm-4.6 (Z.ai, siempre gratis).
  const hasGroqKey = !!(groqApiKey && groqApiKey.trim().length > 10);
  const defaultGroqModel = "llama-3.3-70b-versatile"; // mejor balance calidad/velocidad
  const modelToUse = requestedModel ||
    (hasGroqKey ? defaultGroqModel : "glm-4.6");

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages[] requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // FIX: escuchar req.signal para cerrar el stream si el cliente se
      // desconecta. Sin esto, las conexiones SSE quedaban zombie consumiendo
      // memoria y event loop.
      const abortListener = () => {
        try { controller.close(); } catch { /* ya cerrado */ }
      };
      req.signal.addEventListener("abort", abortListener);

      const send = (event: string, data: any) => {
        // Si el controller ya está cerrado, no intentar escribir
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          /* controller cerrado — ignorar */
        }
      };

      // Construir system prompt con contexto
      const systemPrompt = buildSystemPrompt({
        userName: context?.userName ?? "Usuario",
        activeBoardName: context?.activeBoardName,
        activeBoardId: context?.activeBoardId,
        selectedItemName: context?.selectedItemName,
        selectedItem: context?.selectedItem,
        workspaceName: context?.workspaceName,
        selectedItemUpdates: context?.selectedItemUpdates,
        selectedItemFiles: context?.selectedItemFiles,
        selectedItemColumnValues: context?.selectedItemColumnValues,
      });

      const fullMessages: GroqMessage[] = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];

      try {
        send("status", { message: "Pensando…" });

        // Una sola ronda de LLM — el cliente maneja el loop de tools
        // Si hay tool_calls, el cliente los ejecuta y re-envía con role: "tool"
        const result = await chat(
          {
            messages: fullMessages,
            tools: SIDEKICK_TOOLS as GroqTool[],
            temperature: 0.4,
            maxTokens: 2000,
            model: modelToUse,
            groqApiKey,
          },
          { apiKey: groqApiKey }
        );

        send("backend", { backend: result.backend, model: result.model });

        // Stream del contenido en chunks
        if (result.content) {
          const words = result.content.split(/(\s+)/);
          for (let i = 0; i < words.length; i += 2) {
            const chunk = words.slice(i, i + 2).join("");
            if (chunk) {
              send("delta", { text: chunk });
              await new Promise((r) => setTimeout(r, 15));
            }
          }
        }

        // Emitir tool calls para que el cliente los ejecute
        for (const tc of result.toolCalls) {
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = {};
          }
          send("tool_call", {
            id: tc.id,
            name: tc.function.name,
            arguments: parsedArgs,
          });
        }

        send("done", {
          finishReason: result.finishReason,
          hasToolCalls: result.toolCalls.length > 0,
          backend: result.backend,
          model: result.model,
          content: result.content,
        });
      } catch (err: any) {
        send("error", {
          message: err?.message ?? "Error en el chat",
        });
      } finally {
        // Limpiar listener del abort signal para evitar memory leak
        req.signal.removeEventListener("abort", abortListener);
        try { controller.close(); } catch { /* ya cerrado */ }
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

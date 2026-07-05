// ============================================================================
// API: /api/agent/run — Ejecuta un agente IA con streaming SSE
// ============================================================================
// Rutea automaticamente: Groq (cuando hay API key) o Z.ai SDK (fallback gratis).
// Persiste el resultado en SQLite via Prisma si DATABASE_URL esta configurada.
import { NextRequest } from "next/server";
import { chat } from "@/lib/groq-client";

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
  groqApiKey?: string;
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

  const {
    systemPrompt, temperature, maxTokens, userPrompt, agentName,
    agentId, itemId, model = "glm-4.6", groqApiKey,
  } = body;

  if (!systemPrompt || !userPrompt) {
    return new Response(
      JSON.stringify({ error: "systemPrompt and userPrompt are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const abortListener = () => {
        try { controller.close(); } catch { /* ya cerrado */ }
      };
      req.signal.addEventListener("abort", abortListener);

      const send = (event: string, data: any) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch { /* controller cerrado */ }
      };

      let fullOutput = "";
      let tokensUsed = 0;
      let resultModel = model;
      let resultBackend: "groq" | "zai" = "zai";
      let execError: string | null = null;

      try {
        send("meta", { agentName, startedAt: new Date().toISOString() });
        send("info", { message: "Pensando..." });

        const result = await chat(
          {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            model,
            temperature,
            maxTokens,
            groqApiKey,
          },
          { apiKey: groqApiKey }
        );

        const content = result.content ?? "";
        resultModel = result.model;
        resultBackend = result.backend;

        if (!content) {
          send("error", { message: "El modelo devolvio contenido vacio" });
          controller.close();
          return;
        }

        fullOutput = content;

        // Simular streaming cortando en palabras para UX
        const tokens = content.split(/(\s+)/);
        for (let i = 0; i < tokens.length; i += 2) {
          const chunk = tokens.slice(i, i + 2).join("");
          if (chunk) {
            send("chunk", { text: chunk });
            await new Promise((r) => setTimeout(r, 15));
          }
        }

        tokensUsed = Math.ceil(content.length / 4);

        send("done", {
          completedAt: new Date().toISOString(),
          tokensUsed,
          fullOutput: content,
          model: resultModel,
          backend: resultBackend,
        });
      } catch (err: any) {
        execError = err?.message ?? "Error desconocido";
        send("error", { message: execError });
      } finally {
        // Persistir en SQLite (best-effort, no bloquear si falla)
        try {
          if (process.env.DATABASE_URL && agentId) {
            const { PrismaClient } = await import("@prisma/client");
            const prisma = new PrismaClient();
            await prisma.agentExecution.create({
              data: {
                agentId,
                itemId: itemId ?? null,
                status: execError ? "failed" : "completed",
                output: fullOutput || null,
                error: execError,
                tokensUsed,
                durationMs: Date.now() - startedAt,
                model: resultModel,
                backend: resultBackend,
              },
            });
            await prisma.$disconnect();
          }
        } catch (dbErr: any) {
          console.warn("[agent/run] DB persist failed (non-critical):", dbErr?.message);
        }

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

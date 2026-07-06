// ============================================================================
// NVIDIA NIM Client — único provider de IA (NVIDIA Integrate API)
// ============================================================================
// API compatible con OpenAI. Ya no hay fallback a Z.ai, no hay OpenAI, no hay Anthropic.
// Toda la IA del sistema pasa por un solo cliente con una sola API key.
// ============================================================================

import { getModelInfo as _getModelInfo } from "./model-catalog";
export type { ModelInfo } from "./model-catalog";

// --- Constantes globales de NVIDIA NIM ---
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
// En producción, leer de variable de entorno; en desarrollo, fallback a la key hardcodeada
const NVIDIA_API_KEY =
  process.env.NVIDIA_API_KEY ||
  "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";

// Tipos re-exportados desde groq-types (client-safe)
export type {
  GroqMessage,
  GroqToolCall,
  GroqTool,
  ChatOptions,
  ChatResult,
} from "./groq-types";
import type {
  GroqMessage,
  GroqToolCall,
  GroqTool,
  ChatOptions,
  ChatResult,
} from "./groq-types";

// ----------------------------------------------------------------------------
// Llamada a NVIDIA NIM con retry/backoff para 429 (rate limit)
// ----------------------------------------------------------------------------
async function callNvidia(
  opts: ChatOptions,
  apiKey?: string
): Promise<ChatResult> {
  const resolvedKey = apiKey || NVIDIA_API_KEY;
  const model = opts.model || "meta/llama-3.3-70b-instruct";

  const body: any = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 2000,
  };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }

  // Reintentar hasta 3 veces en 429/5xx con backoff exponencial (0.8s, 1.6s, 3.2s)
  const maxRetries = 3;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resolvedKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          const waitMs = 800 * Math.pow(2, attempt);
          console.log(`[nvidia] HTTP ${res.status}, retry ${attempt + 1}/${maxRetries} en ${waitMs}ms`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw new Error(`NVIDIA HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) throw new Error("NVIDIA: respuesta sin choices");

      return {
        content: choice.message?.content ?? null,
        toolCalls: choice.message?.tool_calls ?? [],
        finishReason: choice.finish_reason ?? "stop",
        model: data.model ?? model,
        backend: "nvidia",
      };
    } catch (e: any) {
      lastErr = e;
      if (opts.signal?.aborted) throw e;
      const isRetryable =
        e?.message?.includes("429") ||
        e?.message?.includes("fetch failed") ||
        e?.message?.includes("network");
      if (isRetryable && attempt < maxRetries) {
        const waitMs = 800 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("NVIDIA: fallo desconocido tras reintentos");
}

// ----------------------------------------------------------------------------
// API principal — única ruta, siempre a NVIDIA NIM
// ----------------------------------------------------------------------------
export async function chat(
  opts: ChatOptions,
  context?: { apiKey?: string }
): Promise<ChatResult> {
  const resolvedKey = context?.apiKey || NVIDIA_API_KEY;
  const modelId = typeof opts.model === "string" ? opts.model : "meta/llama-3.3-70b-instruct";

  console.log(`[nvidia] Usando ${modelId}`);
  return await callNvidia({ ...opts, model: modelId }, resolvedKey);
}

// ----------------------------------------------------------------------------
// Chat con streaming SSE — emite eventos {delta, tool_call, done, error, backend}
// ----------------------------------------------------------------------------
export async function chatStream(
  opts: ChatOptions,
  context: { apiKey?: string; onEvent: (event: string, data: any) => void }
): Promise<ChatResult> {
  const { onEvent } = context;
  onEvent("status", { message: "Pensando…" });

  const result = await chat(opts, context);

  // Emitir contenido como chunks simulados para UX streaming
  if (result.content) {
    const words = result.content.split(/(\s+)/);
    for (let i = 0; i < words.length; i += 2) {
      const chunk = words.slice(i, i + 2).join("");
      if (chunk) {
        onEvent("delta", { text: chunk });
        await new Promise((r) => setTimeout(r, 12));
      }
    }
  }

  // Emitir tool calls
  for (const tc of result.toolCalls) {
    onEvent("tool_call", {
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    });
  }

  onEvent("done", {
    backend: result.backend,
    model: result.model,
    finishReason: result.finishReason,
    hasToolCalls: result.toolCalls.length > 0,
  });

  return result;
}

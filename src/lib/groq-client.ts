// ============================================================================
// Groq client — wrapper con fallback automatico a Z.ai SDK
// ============================================================================
// IMPORTANTE: Este archivo solo puede usarse server-side (API routes).
// El z-ai-web-dev-sdk usa fs/promises de Node.js.
// Para componentes cliente (agente-builder, settings-dialog, etc.),
// importar MODEL_CATALOG directamente desde @/lib/model-catalog
// ============================================================================

import { getModelInfo as _getModelInfo } from "./model-catalog";
export type { ModelInfo } from "./model-catalog";

/** Devuelve true si el modelo usa el provider Groq */
export function isGroqModel(modelId: string): boolean {
  return _getModelInfo(modelId)?.provider === "groq";
}

/** Devuelve true si el modelo usa el provider Z.ai */
export function isZaiModel(modelId: string): boolean {
  const info = _getModelInfo(modelId);
  return info?.provider === "zai" || !info;
}


const GROQ_MODELS = {
  fast: "meta/llama-3.1-8b-instruct",
  versatile: "meta/llama-3.3-70b-instruct",
  reasoning: "deepseek-ai/deepseek-r1",
} as const;

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
// Llamada primaria a Groq con retry/backoff para 429 (rate limit)
// ----------------------------------------------------------------------------
async function callGroq(
  opts: ChatOptions,
  apiKey: string
): Promise<ChatResult> {
  const model =
    typeof opts.model === "string" && opts.model in GROQ_MODELS
      ? GROQ_MODELS[opts.model as keyof typeof GROQ_MODELS]
      : opts.model || GROQ_MODELS.versatile;

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
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        // 429 = rate limit; 5xx = server error — reintentable
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          const waitMs = 800 * Math.pow(2, attempt);
          console.log(`[groq] HTTP ${res.status}, retry ${attempt + 1}/${maxRetries} en ${waitMs}ms`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw new Error(`Groq HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) throw new Error("Groq: respuesta sin choices");

      return {
        content: choice.message?.content ?? null,
        toolCalls: choice.message?.tool_calls ?? [],
        finishReason: choice.finish_reason ?? "stop",
        model: data.model ?? model,
        backend: "groq",
      };
    } catch (e: any) {
      lastErr = e;
      // Si es un error de red o 429, reintentar; si es abort, no
      if (opts.signal?.aborted) throw e;
      const isRetryable = e?.message?.includes("429") ||
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
  throw lastErr ?? new Error("Groq: fallo desconocido tras reintentos");
}

// ----------------------------------------------------------------------------
// Fallback a Z.ai SDK (GLM-4.6) — funciona en este sandbox
// Incluye retry/backoff para 429 (rate limit del SDK)
// ----------------------------------------------------------------------------
// Cache de la instancia del SDK Z.ai — ZAI.create() es costoso y consume
// memoria. Lo creamos una sola vez y reusamos la instancia en todas las
// llamadas. Sin esto, cada request al endpoint de chat creaba una nueva
// instancia → memory leak → OOM kill en el sandbox de 4GB.
let _zaiInstance: any = null;
let _zaiPromise: Promise<any> | null = null;
export async function getZaiInstance(): Promise<any> {
  if (_zaiInstance) return _zaiInstance;
  if (_zaiPromise) return _zaiPromise;
  _zaiPromise = (async () => {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    _zaiInstance = await ZAI.create();
    return _zaiInstance;
  })();
  return _zaiPromise;
}

async function callZai(opts: ChatOptions): Promise<ChatResult> {
  const zai = await getZaiInstance();

  // Convertir mensajes al formato del SDK
  // El SDK no soporta tool_calls nativos en el mismo formato, así que simulamos
  // comportamiento: si hay tools, los inyectamos en el system prompt como instrucciones
  let systemContent = "";
  const userMessages: any[] = [];

  for (const m of opts.messages) {
    if (m.role === "system") {
      systemContent += m.content + "\n";
    } else if (m.role === "tool") {
      // Resultado de tool → como mensaje de usuario con prefijo
      userMessages.push({
        role: "user",
        content: `[TOOL RESULT for ${m.name ?? m.tool_call_id}]: ${m.content}`,
      });
    } else if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      // El assistant quiere llamar tools — lo formateamos como decisión
      const calls = m.tool_calls
        .map((tc) => `Calling tool: ${tc.function.name}(${tc.function.arguments})`)
        .join("\n");
      userMessages.push({
        role: "assistant",
        content: calls,
      });
    } else {
      userMessages.push({ role: m.role, content: m.content ?? "" });
    }
  }

  // Si hay tools definidos, añadir al system prompt
  if (opts.tools && opts.tools.length > 0) {
    const toolsDesc = opts.tools
      .map(
        (t) =>
          `- ${t.function.name}: ${t.function.description}\n  Args: ${JSON.stringify(t.function.parameters)}`
      )
      .join("\n");
    systemContent += `\n\nYou have access to these tools. To use one, respond with EXACTLY this JSON format on its own line:\n{"tool_call": {"name": "<tool_name>", "arguments": {<args>}}}\n\nAvailable tools:\n${toolsDesc}\n\nIf you don't need a tool, respond normally to the user.`;
  }

  const messages = [
    { role: "system", content: systemContent || "You are a helpful assistant." },
    ...userMessages,
  ];

  // Reintentar hasta 3 veces en 429 con backoff exponencial
  const maxRetries = 3;
  let lastErr: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion: any = await zai.chat.completions.create({
        model: "glm-4.6",
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 2000,
      });

      const content = completion?.choices?.[0]?.message?.content ?? "";
      return parseZaiResponse(content);
    } catch (e: any) {
      lastErr = e;
      const msg = (e?.message ?? "").toLowerCase();
      const isRetryable = msg.includes("429") || msg.includes("rate") ||
        msg.includes("too many requests") || msg.includes("timeout");
      if (isRetryable && attempt < maxRetries) {
        const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        console.log(`[zai] rate limit, retry ${attempt + 1}/${maxRetries} en ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("Z.ai: fallo desconocido tras reintentos");
}

// ----------------------------------------------------------------------------
// Parser de respuesta de Z.ai — detecta tool_calls en formato JSON o "Calling tool:"
// ----------------------------------------------------------------------------
function parseZaiResponse(content: string): ChatResult {
  let toolCalls: GroqToolCall[] = [];
  let cleanContent = content;

  // Estrategia O(n) para extraer tool_call JSON del contenido:
  // 1. Buscar el índice de '{"tool_call"'
  // 2. A partir de ahí, encontrar el matching brace balanceando { y }
  // 3. Intentar JSON.parse del slice
  // Esto reemplaza el algoritmo O(n²) anterior que probaba JSON.parse desde
  // cada offset hacia atrás (64M intentos para 8KB malformados).
  const extractToolCallJson = (str: string): { json: any; start: number; end: number } | null => {
    const startIdx = str.indexOf('{"tool_call"');
    if (startIdx === -1) return null;

    // Balancear llaves desde startIdx
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = startIdx; i < str.length; i++) {
      const ch = str[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          // Encontramos el cierre del JSON
          const candidate = str.slice(startIdx, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && parsed.tool_call && parsed.tool_call.name) {
              return { json: parsed, start: startIdx, end: i + 1 };
            }
          } catch {
            // JSON malformado — no hay mucho que podamos hacer
          }
          return null;
        }
      }
    }
    return null;
  };

  const match = extractToolCallJson(content);
  if (match) {
    const tc = match.json.tool_call;
    toolCalls = [
      {
        id: `call_${Date.now()}`,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments ?? {}),
        },
      },
    ];
    cleanContent = (content.slice(0, match.start) + content.slice(match.end)).trim();
  } else {
    // Fallback: detectar formato "Calling tool: name(args)" que el LLM a veces emite
    const callingMatch = content.match(/Calling tool:\s*(\w+)\s*\(([^)]*)\)/);
    if (callingMatch) {
      const name = callingMatch[1];
      let args: any = {};
      try {
        // Intentar parsear args como JSON
        const argsStr = callingMatch[2].trim();
        if (argsStr) {
          args = JSON.parse(argsStr);
        }
      } catch {
        // Si no es JSON válido, dejar args vacío
        args = {};
      }
      toolCalls = [
        {
          id: `call_${Date.now()}`,
          type: "function",
          function: {
            name,
            arguments: JSON.stringify(args),
          },
        },
      ];
      cleanContent = content.replace(callingMatch[0], "").trim();
    }
  }

  return {
    content: cleanContent || null,
    toolCalls,
    finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
    model: "glm-4.6",
    backend: "zai",
  };
}

// ----------------------------------------------------------------------------
// API principal — rutea por provider segun el modelo solicitado
// ----------------------------------------------------------------------------
export async function chat(
  opts: ChatOptions,
  context?: { apiKey?: string }
): Promise<ChatResult> {
  // Resolver la key de Groq desde todas las fuentes posibles (opts > context > env)
  const resolvedKey = (
    opts.groqApiKey || context?.apiKey || process.env.GROQ_API_KEY || ""
  ).trim();
  const hasGroqKey = resolvedKey.length > 10;

  // Resolver el modelo: si hay key de Groq y el usuario NO eligio un modelo especifico
  // (vacío, "default", "auto"), usar el mejor modelo NVIDIA disponible.
  // Si el usuario eligió explícitamente un modelo Z.ai (glm-4.6, glm-4.5-air), respetarlo.
  // Si el usuario eligió un modelo NVIDIA (llama, deepseek), usarlo directamente.
  let modelId = typeof opts.model === "string" ? opts.model : "glm-4.6";
  const isZaiModel = modelId.startsWith("glm-");
  const isAutoOrDefault = !opts.model || opts.model === "default" || opts.model === "auto";
  
  if (hasGroqKey && (isAutoOrDefault || isZaiModel)) {
    // Solo promover si el usuario no eligió explícitamente un modelo Z.ai
    if (isAutoOrDefault) {
      modelId = "meta/llama-3.3-70b-instruct";
    } else {
      console.log(`[groq] Usuario eligió Z.ai model (${modelId}) — respetando elección, usando Z.ai`);
      // No promover, dejar que caiga a Z.ai abajo
    }
  }

  if (hasGroqKey) {
    // Con key de Groq: usar Groq SIEMPRE. Si falla, propagar el error
    // en lugar de caer a Z.ai (que requiere .ai-config no configurado).
    console.log(`[groq] Usando ${modelId} con key ...${resolvedKey.slice(-4)}`);
    return await callGroq({ ...opts, model: modelId }, resolvedKey);
  }

  // Sin key de Groq: usar Z.ai SDK (fallback gratuito)
  console.log("[zai] Sin Groq key, usando Z.ai SDK como fallback");
  try {
    return await callZai(opts);
  } catch (e: any) {
    // Z.ai puede fallar si no hay .ai-config — dar un mensaje util
    const msg = e?.message ?? "";
    if (msg.includes("Configuration file") || msg.includes(".ai-config")) {
      throw new Error(
        "Para usar la IA necesitas configurar tu API key de Groq en ⚙️ Settings > IA & Modelos"
      );
    }
    throw e;
  }
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
        // Pequeño delay para efecto streaming
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

export { GROQ_MODELS };


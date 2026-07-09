// ============================================================================
// Groq client — wrapper con fallback automático a Z.ai SDK
// ============================================================================
// La API key de Groq se usa como primaria (ultra-rápida, tool calling nativo).
// Si Groq no responde (403 por geo-blocking, rate limit, etc.), cae a Z.ai SDK.
// El usuario puede configurar su propia Groq API key en Settings.
// FIX: la API key ahora viene de env var, no hardcodeada en source.

const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || "";

const GROQ_MODELS = {
  fast: "llama-3.1-8b-instant",        // Ultra rápido para chat simple
  versatile: "llama-3.3-70b-versatile", // Balance para tasks complejas
  reasoning: "deepseek-r1-distill-llama-70b", // Razonamiento profundo
} as const;

export interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface GroqToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface GroqTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
  };
}

export interface ChatOptions {
  messages: GroqMessage[];
  tools?: GroqTool[];
  model?: keyof typeof GROQ_MODELS | string;
  temperature?: number;
  maxTokens?: number;
  groqApiKey?: string; // override
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string | null;
  toolCalls: GroqToolCall[];
  finishReason: string;
  model: string;
  backend: "groq" | "zai"; // cuál respondió
}

// ----------------------------------------------------------------------------
// Llamada primaria a Groq
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

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
}

// ----------------------------------------------------------------------------
// Fallback a Z.ai SDK (GLM-4.6) — funciona en este sandbox
// ----------------------------------------------------------------------------

// Cache de la instancia Z.ai SDK — evita recrear en cada request (memory leak)
let _zaiInstance: any = null;
let _zaiPromise: Promise<any> | null = null;
export async function getZaiInstance(): Promise<any> {
  if (_zaiInstance) return _zaiInstance;
  if (_zaiPromise) return _zaiPromise;
  _zaiPromise = (async () => {
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      _zaiInstance = await ZAI.create();
      return _zaiInstance;
    } catch (err) {
      // FIX: resetear la promise si falla, para que el próximo intento pueda reintentar
      _zaiPromise = null;
      throw err;
    }
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

  const completion: any = await zai.chat.completions.create({
    model: "glm-4.6",
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 2000,
  });

  const content = completion?.choices?.[0]?.message?.content ?? "";

  // Detectar tool_call en la respuesta (formato JSON que pedimos)
  let toolCalls: GroqToolCall[] = [];
  let cleanContent = content;

  // Buscar el primer JSON que contenga "tool_call" — intentamos parsear
  // desde cada ocurrencia de "{" hacia adelante
  // FIX: algoritmo O(n) con brace matching en vez de O(n²) con JSON.parse progresivo
  const extractToolCallJson = (str: string): { json: any; start: number; end: number } | null => {
    const startIdx = str.indexOf('{"tool_call"');
    if (startIdx === -1) return null;
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
          const candidate = str.slice(startIdx, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && parsed.tool_call && parsed.tool_call.name) {
              return { json: parsed, start: startIdx, end: i + 1 };
            }
          } catch { /* malformado */ }
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
// API principal — intenta Groq, fallback Z.ai
// ----------------------------------------------------------------------------
export async function chat(
  opts: ChatOptions,
  context?: { apiKey?: string }
): Promise<ChatResult> {
  const groqKey = (opts.groqApiKey || context?.apiKey || DEFAULT_GROQ_KEY).trim();

  // Intentar Groq primero (si hay key)
  if (groqKey && groqKey.length > 10) {
    try {
      return await callGroq(opts, groqKey);
    } catch (e: any) {
      console.log("[groq] fallback to zai:", e?.message?.slice(0, 100));
      // Caer al fallback
    }
  }

  // Fallback Z.ai
  return await callZai(opts);
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

export { GROQ_MODELS, DEFAULT_GROQ_KEY };

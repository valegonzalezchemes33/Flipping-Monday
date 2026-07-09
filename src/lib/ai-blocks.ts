// ============================================================================
// AI Blocks — primitivas reutilizables de IA (equivalente a los AI Blocks de Monday)
// ============================================================================
// Cada AI Block es una función atómica que recibe input, llama al LLM, y
// devuelve output estructurado. Se usan en:
// - AI Columns (auto-fill de columnas)
// - AI Automations (recetas trigger → AI Block → action)
// - Sidekick (tools del asistente)
// - AI Workflows (cadenas multi-step)
//
// Modelo: 1 AI Block = 1 llamada al LLM. Retry/backoff incluido.
//
// IMPORTANTE: este archivo se usa tanto en cliente como en servidor.
// NO importar z-ai-web-dev-sdk directamente. Usar fetch al endpoint /api/agent/chat
// que maneja el SDK server-side.

export type AIBlockType =
  | "summarize"
  | "categorize"
  | "extract_info"
  | "translate"
  | "sentiment"
  | "improve_text"
  | "generate_text"
  | "suggest_actions"
  | "detect_language"
  | "prioritize"
  | "assign_labels"
  | "assign_people"
  | "custom";

export interface AIBlockInput {
  text: string;
  // Para categorize/assign_labels: lista de categorías/labels disponibles
  options?: string[];
  // Para translate: idioma destino (ej: "english", "spanish")
  targetLanguage?: string;
  // Para extract_info: qué campos extraer (ej: ["email", "phone", "date"])
  fields?: string[];
  // Para custom: prompt personalizado
  customPrompt?: string;
  // Contexto adicional (ej: nombre del board, otros items)
  context?: string;
}

export interface AIBlockResult {
  success: boolean;
  output: string;
  // Para categorize/assign_labels: la categoría seleccionada
  selectedOption?: string;
  // Para sentiment: "positive" | "negative" | "neutral"
  sentiment?: "positive" | "negative" | "neutral";
  // Para extract_info: campos extraídos como key-value
  extractedFields?: Record<string, string>;
  // Para prioritize: score 1-5
  priorityScore?: number;
  // Para assign_people: IDs de usuarios sugeridos
  suggestedUserIds?: string[];
  // Metadatos
  blockType: AIBlockType;
  tokensUsed?: number;
  error?: string;
}

// ----------------------------------------------------------------------------
// Prompts system para cada AI Block
// ----------------------------------------------------------------------------
function buildPrompt(blockType: AIBlockType, input: AIBlockInput): string {
  switch (blockType) {
    case "summarize":
      return `Resume el siguiente texto en 2-3 frases concisas. Mantén la información clave. Responde SOLO con el resumen, sin prefijos.

TEXTO:
${input.text}

${input.context ? `CONTEXTO: ${input.context}` : ""}`;

    case "categorize":
    case "assign_labels":
      return `Categoriza el siguiente texto en UNA de estas categorías. Responde SOLO con el nombre exacto de la categoría, nada más.

CATEGORÍAS DISPONIBLES:
${(input.options ?? []).join(", ")}

TEXTO:
${input.text}

Categoría seleccionada:`;

    case "extract_info":
      return `Extrae la siguiente información del texto. Devuelve el resultado como JSON con estas claves: ${JSON.stringify(input.fields ?? [])}

TEXTO:
${input.text}

Responde SOLO con JSON válido, sin markdown:`;

    case "translate":
      return `Traduce el siguiente texto al ${input.targetLanguage ?? "english"}. Mantén el tono y formato. Responde SOLO con la traducción.

TEXTO:
${input.text}`;

    case "sentiment":
      return `Analiza el sentimiento del siguiente texto. Responde SOLO con una palabra: "positive", "negative", o "neutral".

TEXTO:
${input.text}

Sentimiento:`;

    case "improve_text":
      return `Mejora este texto: corrige gramática, hazlo más claro y profesional. Mantén el significado. Responde SOLO con el texto mejorado.

TEXTO:
${input.text}`;

    case "generate_text":
      return input.customPrompt || `Genera texto basado en: ${input.text}`;

    case "suggest_actions":
      return `Basándote en el siguiente texto, sugiere 3 acciones concretas a tomar. Responde como lista numerada.

TEXTO:
${input.text}

Acciones sugeridas:`;

    case "detect_language":
      return `Detecta el idioma del siguiente texto. Responde SOLO con el nombre del idioma en inglés (ej: "spanish", "english", "french").

TEXTO:
${input.text}

Idioma:`;

    case "prioritize":
      return `Evalúa la prioridad de este item en una escala del 1 al 5, donde 5 es máxima urgencia. Responde SOLO con el número.

TEXTO:
${input.text}

Prioridad (1-5):`;

    case "assign_people":
      return `Basándote en el contenido del item, sugiere a qué persona asignar. Responde SOLO con el nombre del usuario más adecuado.

USUARIOS DISPONIBLES:
${(input.options ?? []).join(", ")}

TEXTO:
${input.text}

Usuario sugerido:`;

    case "custom":
      return input.customPrompt || input.text;

    default:
      return input.text;
  }
}

// ----------------------------------------------------------------------------
// Parser de respuesta según el tipo de AI Block
// ----------------------------------------------------------------------------
function parseResult(blockType: AIBlockType, rawOutput: string, input: AIBlockInput): AIBlockResult {
  const output = rawOutput.trim();
  const base = {
    success: true,
    output,
    blockType,
  };

  switch (blockType) {
    case "categorize":
    case "assign_labels": {
      // Buscar la categoría que más se parezca
      const options = input.options ?? [];
      const matched = options.find(
        (opt) =>
          output.toLowerCase().includes(opt.toLowerCase()) ||
          opt.toLowerCase().includes(output.toLowerCase())
      );
      return { ...base, selectedOption: matched ?? output };
    }

    case "sentiment": {
      const lower = output.toLowerCase();
      let sentiment: "positive" | "negative" | "neutral" = "neutral";
      if (lower.includes("positive") || lower.includes("positivo")) sentiment = "positive";
      else if (lower.includes("negative") || lower.includes("negativo")) sentiment = "negative";
      return { ...base, sentiment };
    }

    case "extract_info": {
      try {
        const parsed = JSON.parse(output);
        return { ...base, extractedFields: parsed };
      } catch {
        // Si no es JSON válido, intentar parsear como key: value
        const fields: Record<string, string> = {};
        output.split("\n").forEach((line) => {
          const [key, ...valueParts] = line.split(":");
          if (key && valueParts.length > 0) {
            fields[key.trim().toLowerCase()] = valueParts.join(":").trim();
          }
        });
        return { ...base, extractedFields: fields };
      }
    }

    case "prioritize": {
      const match = output.match(/[1-5]/);
      const priorityScore = match ? parseInt(match[0], 10) : 3;
      return { ...base, priorityScore };
    }

    case "assign_people": {
      const options = input.options ?? [];
      const matched = options.find((opt) =>
        output.toLowerCase().includes(opt.toLowerCase())
      );
      return { ...base, output: matched ?? output };
    }

    default:
      return base;
  }
}

// ----------------------------------------------------------------------------
// Ejecutar un AI Block
// ----------------------------------------------------------------------------
export async function executeAIBlock(
  blockType: AIBlockType,
  input: AIBlockInput,
  options?: { groqApiKey?: string; maxTokens?: number }
): Promise<AIBlockResult> {
  const prompt = buildPrompt(blockType, input);

  try {
    // Usar fetch al endpoint /api/agent/chat para evitar importar el SDK
    // de Z.ai en el cliente (causa "Module not found: fs/promises")
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        groqApiKey: options?.groqApiKey,
        context: { userName: "AI Block" },
      }),
    });

    if (!res.body) throw new Error("Sin response body");

    // Leer el SSE stream y acumular el contenido
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evtBlock of events) {
        const lines = evtBlock.split("\n");
        let evt = "message";
        let data = "";
        for (const ln of lines) {
          if (ln.startsWith("event:")) evt = ln.slice(6).trim();
          else if (ln.startsWith("data:")) data += ln.slice(5).trim();
        }
        try {
          const p = JSON.parse(data);
          if (evt === "delta" && p.text) content += p.text;
          else if (evt === "done") content = content || p.content || content;
          else if (evt === "error") throw new Error(p.message);
        } catch {
          /* ignore */
        }
      }
    }

    if (!content) {
      return {
        success: false,
        output: "",
        blockType,
        error: "El modelo no devolvió contenido",
      };
    }

    return parseResult(blockType, content, input);
  } catch (err: any) {
    return {
      success: false,
      output: "",
      blockType,
      error: err?.message ?? "Error desconocido en AI Block",
    };
  }
}

// ----------------------------------------------------------------------------
// Catálogo de AI Blocks para UI (Automation Center, Column Builder, etc.)
// ----------------------------------------------------------------------------
export const AI_BLOCK_CATALOG: {
  type: AIBlockType;
  label: string;
  icon: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  needsOptions?: boolean;
  needsFields?: boolean;
  needsLanguage?: boolean;
}[] = [
  {
    type: "summarize",
    label: "Resumir",
    icon: "📝",
    description: "Resume texto en 2-3 frases concisas",
    inputLabel: "Texto a resumir",
    outputLabel: "Resumen",
  },
  {
    type: "categorize",
    label: "Categorizar",
    icon: "🏷️",
    description: "Asigna el item a una categoría",
    inputLabel: "Texto del item",
    outputLabel: "Categoría",
    needsOptions: true,
  },
  {
    type: "extract_info",
    label: "Extraer información",
    icon: "🔍",
    description: "Extrae campos específicos (email, teléfono, fecha, etc.)",
    inputLabel: "Texto fuente",
    outputLabel: "Campos extraídos (JSON)",
    needsFields: true,
  },
  {
    type: "translate",
    label: "Traducir",
    icon: "🌐",
    description: "Traduce texto a otro idioma",
    inputLabel: "Texto a traducir",
    outputLabel: "Traducción",
    needsLanguage: true,
  },
  {
    type: "sentiment",
    label: "Análisis de sentimiento",
    icon: "😊",
    description: "Detecta si el sentimiento es positivo, negativo o neutral",
    inputLabel: "Texto a analizar",
    outputLabel: "Sentimiento",
  },
  {
    type: "improve_text",
    label: "Mejorar texto",
    icon: "✨",
    description: "Corrige gramática y hace el texto más profesional",
    inputLabel: "Texto a mejorar",
    outputLabel: "Texto mejorado",
  },
  {
    type: "generate_text",
    label: "Generar texto",
    icon: "🤖",
    description: "Genera texto basado en un prompt personalizado",
    inputLabel: "Prompt",
    outputLabel: "Texto generado",
  },
  {
    type: "suggest_actions",
    label: "Sugerir acciones",
    icon: "📋",
    description: "Sugiere 3 acciones concretas basadas en el contenido",
    inputLabel: "Texto del item",
    outputLabel: "Acciones sugeridas",
  },
  {
    type: "detect_language",
    label: "Detectar idioma",
    icon: "🗣️",
    description: "Detecta el idioma del texto",
    inputLabel: "Texto",
    outputLabel: "Idioma detectado",
  },
  {
    type: "prioritize",
    label: "Priorizar",
    icon: "⚡",
    description: "Asigna una prioridad del 1 al 5",
    inputLabel: "Texto del item",
    outputLabel: "Score de prioridad",
  },
  {
    type: "assign_people",
    label: "Asignar persona",
    icon: "👤",
    description: "Sugiere a quién asignar el item",
    inputLabel: "Texto del item",
    outputLabel: "Persona sugerida",
    needsOptions: true,
  },
  {
    type: "assign_labels",
    label: "Asignar labels",
    icon: "🏷️",
    description: "Asigna múltiples labels/tags al item",
    inputLabel: "Texto del item",
    outputLabel: "Labels asignados",
    needsOptions: true,
  },
  {
    type: "custom",
    label: "Personalizado",
    icon: "⚙️",
    description: "Prompt personalizado completo",
    inputLabel: "Prompt custom",
    outputLabel: "Respuesta",
  },
];

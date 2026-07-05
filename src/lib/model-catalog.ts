// ============================================================================
// model-catalog.ts  -  Catalogo de modelos IA disponibles
// ============================================================================
// Este archivo es seguro para importar desde componentes cliente (no usa
// ninguna dependencia de Node.js). groq-client.ts contiene la logica de
// llamada a la API y solo puede usarse server-side (usa z-ai-web-dev-sdk).
// ============================================================================

export interface ModelInfo {
  id: string;
  name: string;
  provider: "zai" | "groq" | "openai" | "anthropic";
  description: string;
  speed: "fast" | "medium" | "slow";
  costTier: "free" | "low" | "medium" | "high";
  supportsTools: boolean;
  contextWindow: number;
  badge?: "recommended" | "fast" | "reasoning" | "vision";
  maxOutputTokens?: number;
}

export const MODEL_CATALOG: ModelInfo[] = [
  // Z.ai (GLM)
  {
    id: "glm-4.6",
    name: "GLM-4.6",
    provider: "zai",
    description: "Modelo potente con tool calling nativo. Ideal para tareas complejas y razonamiento.",
    speed: "medium",
    costTier: "free",
    supportsTools: true,
    contextWindow: 128000,
    badge: "recommended",
    maxOutputTokens: 8192,
  },
  {
    id: "glm-4.5-air",
    name: "GLM-4.5 Air",
    provider: "zai",
    description: "Version ligera y ultrarrapida. Perfecta para tareas simples y respuestas cortas.",
    speed: "fast",
    costTier: "free",
    supportsTools: false,
    contextWindow: 32000,
    badge: "fast",
    maxOutputTokens: 4096,
  },
  // Groq (Llama / DeepSeek)
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    provider: "groq",
    description: "El mas rapido del catalogo. Ultra-bajo latency para respuestas en tiempo real.",
    speed: "fast",
    costTier: "low",
    supportsTools: true,
    contextWindow: 128000,
    badge: "fast",
    maxOutputTokens: 8192,
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    provider: "groq",
    description: "Balance ideal entre velocidad y calidad. Excelente para la mayoria de las tareas.",
    speed: "medium",
    costTier: "low",
    supportsTools: true,
    contextWindow: 128000,
    maxOutputTokens: 32768,
  },
  {
    id: "deepseek-r1-distill-llama-70b",
    name: "DeepSeek R1 70B",
    provider: "groq",
    description: "Razonamiento profundo paso a paso. Ideal para analisis complejos y resolucion de problemas.",
    speed: "slow",
    costTier: "low",
    supportsTools: false,
    contextWindow: 128000,
    badge: "reasoning",
    maxOutputTokens: 16384,
  },
];

export function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}

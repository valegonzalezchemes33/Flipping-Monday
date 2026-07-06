// ============================================================================
// model-catalog.ts  -  Catálogo de modelos IA disponibles (solo NVIDIA NIM)
// ============================================================================
// Todos los modelos usan NVIDIA NIM (https://integrate.api.nvidia.com/v1).
// Ya no hay Z.ai, OpenAI, Anthropic como providers separados.
// ============================================================================

export interface ModelInfo {
  id: string;
  name: string;
  provider: "nvidia";
  description: string;
  speed: "fast" | "medium" | "slow";
  costTier: "free" | "low" | "medium" | "high";
  supportsTools: boolean;
  contextWindow: number;
  badge?: "recommended" | "fast" | "reasoning" | "vision";
  maxOutputTokens?: number;
}

export const MODEL_CATALOG: ModelInfo[] = [
  {
    id: "meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B Instruct",
    provider: "nvidia",
    description: "El más rápido del catálogo. Ultra-bajo latency para respuestas en tiempo real.",
    speed: "fast",
    costTier: "low",
    supportsTools: true,
    contextWindow: 128000,
    badge: "fast",
    maxOutputTokens: 8192,
  },
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B Instruct",
    provider: "nvidia",
    description: "Balance ideal entre velocidad y calidad. Recomendado para la mayoría de tareas.",
    speed: "medium",
    costTier: "low",
    supportsTools: true,
    contextWindow: 128000,
    badge: "recommended",
    maxOutputTokens: 32768,
  },
  {
    id: "meta/llama-3.2-90b-vision-instruct",
    name: "Llama 3.2 90B Vision",
    provider: "nvidia",
    description: "Modelo multimodal con capacidad de visión. Analiza imágenes y extrae información.",
    speed: "medium",
    costTier: "low",
    supportsTools: false,
    contextWindow: 128000,
    badge: "vision",
    maxOutputTokens: 4096,
  },
  {
    id: "deepseek-ai/deepseek-r1",
    name: "DeepSeek R1",
    provider: "nvidia",
    description: "Razonamiento profundo paso a paso. Ideal para análisis complejos y resolución de problemas.",
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

// ============================================================================
// groq-types.ts  -  Interfaces puras para el sistema de chat IA
// ============================================================================
// Este archivo es safe para importar desde componentes cliente.
// No tiene dependencias de Node.js ni del SDK de Z.ai.
// ============================================================================

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
  model?: string;
  temperature?: number;
  maxTokens?: number;
  groqApiKey?: string; // mantiene compatibilidad, no se usa
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string | null;
  toolCalls: GroqToolCall[];
  finishReason: string;
  model: string;
  backend: "nvidia";
}

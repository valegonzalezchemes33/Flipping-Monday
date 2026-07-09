// ============================================================================
// API: /api/agent/generate — Crea un agente IA desde un prompt en lenguaje natural
// ============================================================================
// Recibe: { prompt, groqApiKey?, context? }
// Devuelve: { agent: { name, description, systemPrompt, tools, triggers, icon, color, model, temperature } }
//
// Esto replica la función "prompt-to-agent" de Monday.com donde el usuario
// describe qué quiere que haga el agente y el sistema genera la configuración completa.
import { NextRequest, NextResponse } from "next/server";
import { getZaiInstance } from "@/lib/groq-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateRequest {
  prompt: string;
  groqApiKey?: string;
  context?: {
    boardName?: string;
    workspaceName?: string;
  };
}

// Tools disponibles que el agente puede tener (deben coincidir con sidekick-tools.ts)
const AVAILABLE_TOOLS = [
  "list_boards", "get_active_board", "get_item", "search_items",
  "create_item", "create_items_batch", "update_column_value", "move_item",
  "delete_item", "add_update", "add_group", "navigate_to_board", "open_item",
  "summarize_board", "find_at_risk_items", "duplicate_item", "archive_item",
  "rename_group", "delete_group", "add_subitem", "add_column", "create_board",
  "list_workspaces", "create_workspace", "rename_workspace", "delete_workspace",
  "rename_board", "duplicate_board", "archive_board", "delete_board",
  "duplicate_group", "delete_column", "read_attached_files", "save_file_to_item",
  "list_files", "list_groups", "get_item_updates",
  // AI Blocks
  "ai_summarize", "ai_categorize", "ai_detect_sentiment", "ai_suggest_actions",
  "ai_prioritize", "ai_translate_item", "ai_generate_subitems", "ai_board_insights",
  "ai_detect_duplicates", "ai_generate_report", "ai_draft_email", "ai_extract_action_items",
];

export async function POST(req: NextRequest) {
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { prompt, groqApiKey } = body;

  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: "prompt requerido" }, { status: 400 });
  }

  const contextInfo = body.context
    ? `\nContexto del workspace: ${body.context.workspaceName ?? ""}, Board activo: ${body.context.boardName ?? ""}`
    : "";

  const systemPrompt = `Eres un generador de agentes IA para una plataforma tipo Monday.com. El usuario describe qué quiere que haga el agente y tú generas la configuración completa en JSON.

Devuelve SOLO un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):
{
  "name": "Nombre corto del agente (máx 40 chars)",
  "description": "Descripción de 1-2 líneas de qué hace el agente",
  "systemPrompt": "Prompt del sistema que define el comportamiento del agente. Debe ser detallado, incluir su rol, qué debe hacer, qué NO debe hacer, y cómo responder. Mínimo 200 caracteres.",
  "tools": ["lista", "de", "tools", "que", "necesita"],
  "triggers": ["manual"],
  "icon": "emoji que representa al agente",
  "color": "color hex como #0072E5",
  "model": "glm-4.6",
  "temperature": 0.4,
  "scope": "global"
}

Reglas para seleccionar tools:
- SOLO incluye tools de esta lista: ${AVAILABLE_TOOLS.join(", ")}
- Si el agente necesita crear items: incluye "create_item" o "create_items_batch"
- Si necesita leer datos: incluye "list_boards", "get_active_board", "search_items"
- Si necesita IA: incluye las tools "ai_*" correspondientes
- Si necesita mover/cambiar: incluye "update_column_value", "move_item"
- Si necesita comunicar: incluye "add_update"
- "triggers" puede ser: ["manual"], ["item_created"], ["column_change"], ["schedule"]
- Para agentes que responden preguntas: ["manual"]
- Para agentes automáticos: ["item_created"] o ["column_change"]
- "scope" puede ser "global" o "board"

Ejemplo de prompt del usuario: "Un agente que categorice automáticamente los items nuevos"
Respuesta esperada: incluye ai_categorize en tools, triggers ["item_created"], scope "board".`;

  try {
    const zai = await getZaiInstance();

    const completion: any = await zai.chat.completions.create({
      model: "glm-4.6",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt + contextInfo },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = completion?.choices?.[0]?.message?.content ?? "";

    // Extraer JSON de la respuesta (puede tener markdown ```json ... ```)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Intentar extraer desde la primera { hasta la última }
      const start = jsonStr.indexOf("{");
      const end = jsonStr.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        jsonStr = jsonStr.slice(start, end + 1);
      }
    }

    let agentConfig;
    try {
      agentConfig = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "El modelo no devolvió JSON válido", raw: content.slice(0, 500) },
        { status: 500 }
      );
    }

    // Validar y normalizar
    const agent = {
      name: agentConfig.name || "Agente sin nombre",
      description: agentConfig.description || "",
      systemPrompt: agentConfig.systemPrompt || `Eres un agente IA. ${prompt}`,
      tools: Array.isArray(agentConfig.tools)
        ? agentConfig.tools.filter((t: string) => AVAILABLE_TOOLS.includes(t))
        : ["list_boards", "get_active_board"],
      triggers: Array.isArray(agentConfig.triggers) ? agentConfig.triggers : ["manual"],
      icon: agentConfig.icon || "🤖",
      color: agentConfig.color || "#0072E5",
      model: agentConfig.model || "glm-4.6",
      temperature: typeof agentConfig.temperature === "number" ? agentConfig.temperature : 0.4,
      scope: agentConfig.scope || "global",
    };

    return NextResponse.json({ agent });
  } catch (err: any) {
    console.error("[agent/generate] error:", err?.message);
    return NextResponse.json(
      { error: err?.message ?? "Error generando agente" },
      { status: 500 }
    );
  }
}

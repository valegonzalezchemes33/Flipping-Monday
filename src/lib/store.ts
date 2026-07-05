// ============================================================================
// Store Zustand — estado global de la app Monday-AI
// ============================================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ----------------------------------------------------------------------------
// Generador de IDs único — usa crypto.randomUUID() (estándar web, disponible
// en Node 19+ y todos los navegadores modernos) con fallback a timestamp+random.
// Esto evita colisiones cuando se crean múltiples items en el mismo ms
// (ej: create_items_batch llamaba addItem en forEach y todos recibían el
// mismo Date.now() → IDs duplicados → se sobrescribían silenciosamente).
// ----------------------------------------------------------------------------
let _idCounter = 0;
export function genId(prefix: string = "id"): string {
  // crypto.randomUUID está disponible en Node 19+ y browsers modernos
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  // Fallback: timestamp + contador incremental + random
  _idCounter = (_idCounter + 1) % 1000000;
  return `${prefix}-${Date.now()}-${_idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}
import type {
  Agent,
  AgentExecution,
  AutomationRecipe,
  Board,
  ColumnDef,
  Item,
  OrchestratorPlan,
  ViewType,
  Team,
  User,
  Workspace,
  ColumnValue,
  Update,
  ActivityEvent,
} from "./types";

// ----------------------------------------------------------------------------
// Tipos auxiliares (Notification + File)
// ----------------------------------------------------------------------------
export interface AppNotification {
  id: string;
  type: "mention" | "agent_completed" | "agent_failed" | "automation" | "item_updated" | "deadline";
  title: string;
  body: string;
  itemId?: string;
  agentId?: string;
  read: boolean;
  createdAt: string;
}

export interface AppFile {
  id: string;
  itemId: string;
  name: string;
  size: number;
  mime: string;
  url?: string;
  uploadedById: string;
  createdAt: string;
}

// Sidekick chat message
export interface SidekickMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  // Para tool calls del assistant
  toolCalls?: {
    id: string;
    name: string;
    arguments: any;
    result?: any;
    status?: "pending" | "executing" | "done" | "error";
    uiAction?: string;
  }[];
  // Para mensajes de tool (resultado)
  toolCallId?: string;
  // Metadata
  backend?: "groq" | "zai";
  model?: string;
  createdAt: string;
  streaming?: boolean;
}

// ----------------------------------------------------------------------------
// Datos seed (mock)
// ----------------------------------------------------------------------------

const USERS: User[] = [
  { id: "u1", name: "Sofía Reyes", email: "sofia@monday-ai.dev", role: "owner", color: "#0072E5" },
  { id: "u2", name: "Marco Liu", email: "marco@monday-ai.dev", role: "admin", color: "#00C875" },
  { id: "u3", name: "Priya Nair", email: "priya@monday-ai.dev", role: "member", color: "#FF642E" },
  { id: "u4", name: "Diego Alvarez", email: "diego@monday-ai.dev", role: "member", color: "#A25BFF" },
  { id: "u5", name: "Yuki Tanaka", email: "yuki@monday-ai.dev", role: "member", color: "#FF158A" },
];

const TEAMS: Team[] = [
  { id: "t1", name: "Ventas", memberIds: ["u1", "u2"] },
  { id: "t2", name: "Producto", memberIds: ["u3", "u4"] },
  { id: "t3", name: "Customer Success", memberIds: ["u5"] },
];

const STATUS_LABELS = {
  "0": { name: "Working on it", color: "#FFC700" },
  "1": { name: "Done", color: "#00C875" },
  "2": { name: "Stuck", color: "#E2445C" },
  "3": { name: "Not Started", color: "#C4C4C4" },
};

const PRIORITY_LABELS = {
  "0": { name: "Critical", color: "#401694" },
  "1": { name: "High", color: "#5559DF" },
  "2": { name: "Medium", color: "#5AB1FF" },
  "3": { name: "Low", color: "#9CD326" },
};

const NOW = Date.now();
const daysFromNow = (d: number) =>
  new Date(NOW + d * 86400000).toISOString().slice(0, 10);

const BOARD_SALES: Board = {
  id: "b1",
  workspaceId: "w1",
  name: "Pipeline de Ventas Q3",
  description: "Seguimiento de oportunidades y scoring de leads con IA",
  boardKind: "public",
  boardType: "board",
  columns: [
    { id: "name", title: "Tarea", type: "text", width: 340 },
    {
      id: "status",
      title: "Estado",
      type: "status",
      width: 180,
      labels: STATUS_LABELS,
    },
    {
      id: "priority",
      title: "Prioridad",
      type: "priority",
      width: 140,
      labels: PRIORITY_LABELS,
    },
    { id: "owner", title: "Responsable", type: "people", width: 160 },
    { id: "deadline", title: "Vencimiento", type: "date", width: 150 },
    { id: "value", title: "Valor (USD)", type: "numbers", width: 140 },
    {
      id: "lead_score",
      title: "Lead Score",
      type: "ai_agent",
      width: 190,
      agentIds: ["a1"],
    },
    {
      id: "ai_enrichment",
      title: "Enriquecer",
      type: "ai_agent",
      width: 190,
      agentIds: ["a3"],
    },
    { id: "updated", title: "Modificado", type: "last_updated", width: 150 },
  ],
  groups: [
    { id: "g1", title: "Nuevo Lead", color: "#579BFC", position: 0 },
    { id: "g2", title: "En Negociación", color: "#FFC700", position: 1 },
    { id: "g3", title: "Closed Won", color: "#00C875", position: 2 },
    { id: "g4", title: "Closed Lost", color: "#E2445C", position: 3 },
  ],
  items: [
    {
      id: "i1",
      boardId: "b1",
      groupId: "g1",
      name: "Acme Corp — Plataforma enterprise",
      columnValues: [
        { columnId: "status", value: { labelId: "3" } },
        { columnId: "priority", value: { labelId: "1" } },
        { columnId: "owner", value: { userIds: ["u1"] } },
        { columnId: "deadline", value: { date: daysFromNow(14) } },
        { columnId: "value", value: { text: "85000" } },
        { columnId: "lead_score", value: { lastRunId: "ex1", lastOutput: "87/100 — Alto potencial" } },
        { columnId: "updated", value: { text: daysFromNow(-2) } },
      ],
      createdAt: new Date(NOW - 3 * 86400000).toISOString(),
      updatedAt: new Date(NOW - 2 * 86400000).toISOString(),
      position: 0,
      subItems: [
        {
          id: "si1",
          parentId: "i1",
          name: "Enviar propuesta inicial",
          columnValues: [{ columnId: "status", value: { labelId: "0" } }],
          createdAt: new Date(NOW - 2 * 86400000).toISOString(),
        },
      ],
    },
    {
      id: "i2",
      boardId: "b1",
      groupId: "g1",
      name: "Globex — Migración cloud",
      columnValues: [
        { columnId: "status", value: { labelId: "3" } },
        { columnId: "priority", value: { labelId: "0" } },
        { columnId: "owner", value: { userIds: ["u2"] } },
        { columnId: "deadline", value: { date: daysFromNow(7) } },
        { columnId: "value", value: { text: "240000" } },
        { columnId: "lead_score", value: {} },
        { columnId: "updated", value: { text: daysFromNow(-1) } },
      ],
      createdAt: new Date(NOW - 1 * 86400000).toISOString(),
      updatedAt: new Date(NOW - 1 * 86400000).toISOString(),
      position: 1,
    },
    {
      id: "i3",
      boardId: "b1",
      groupId: "g2",
      name: "Initech — Renovación contrato",
      columnValues: [
        { columnId: "status", value: { labelId: "0" } },
        { columnId: "priority", value: { labelId: "1" } },
        { columnId: "owner", value: { userIds: ["u3"] } },
        { columnId: "deadline", value: { date: daysFromNow(3) } },
        { columnId: "value", value: { text: "45000" } },
        { columnId: "lead_score", value: { lastRunId: "ex2", lastOutput: "72/100 — Medio" } },
        { columnId: "updated", value: { text: daysFromNow(0) } },
      ],
      createdAt: new Date(NOW - 5 * 86400000).toISOString(),
      updatedAt: new Date(NOW).toISOString(),
      position: 0,
    },
    {
      id: "i4",
      boardId: "b1",
      groupId: "g2",
      name: "Umbrella — PoC IoT",
      columnValues: [
        { columnId: "status", value: { labelId: "0" } },
        { columnId: "priority", value: { labelId: "2" } },
        { columnId: "owner", value: { userIds: ["u4"] } },
        { columnId: "deadline", value: { date: daysFromNow(21) } },
        { columnId: "value", value: { text: "120000" } },
        { columnId: "lead_score", value: {} },
        { columnId: "updated", value: { text: daysFromNow(-3) } },
      ],
      createdAt: new Date(NOW - 6 * 86400000).toISOString(),
      updatedAt: new Date(NOW - 3 * 86400000).toISOString(),
      position: 1,
    },
    {
      id: "i5",
      boardId: "b1",
      groupId: "g3",
      name: "Stark Industries — Deploy infraestructura",
      columnValues: [
        { columnId: "status", value: { labelId: "1" } },
        { columnId: "priority", value: { labelId: "0" } },
        { columnId: "owner", value: { userIds: ["u5"] } },
        { columnId: "deadline", value: { date: daysFromNow(-2) } },
        { columnId: "value", value: { text: "540000" } },
        { columnId: "lead_score", value: { lastRunId: "ex3", lastOutput: "95/100 — Crítico estratégico" } },
        { columnId: "updated", value: { text: daysFromNow(-2) } },
      ],
      createdAt: new Date(NOW - 30 * 86400000).toISOString(),
      updatedAt: new Date(NOW - 2 * 86400000).toISOString(),
      position: 0,
    },
    {
      id: "i6",
      boardId: "b1",
      groupId: "g4",
      name: "Hooli — Piloto cancelado",
      columnValues: [
        { columnId: "status", value: { labelId: "2" } },
        { columnId: "priority", value: { labelId: "3" } },
        { columnId: "owner", value: { userIds: ["u2"] } },
        { columnId: "deadline", value: { date: daysFromNow(-15) } },
        { columnId: "value", value: { text: "0" } },
        { columnId: "lead_score", value: { lastRunId: "ex4", lastOutput: "23/100 — Bajo" } },
        { columnId: "updated", value: { text: daysFromNow(-15) } },
      ],
      createdAt: new Date(NOW - 45 * 86400000).toISOString(),
      updatedAt: new Date(NOW - 15 * 86400000).toISOString(),
      position: 0,
    },
  ],
  views: [
    { id: "v1", name: "Main Table", type: "main_table" },
    { id: "v2", name: "Kanban", type: "kanban" },
    { id: "v3", name: "Calendario", type: "calendar" },
    { id: "v4", name: "Carga de trabajo", type: "workload" },
  ],
};

const BOARD_PRODUCT: Board = {
  id: "b2",
  workspaceId: "w2",
  name: "Roadmap Producto H2 2026",
  description: "Sprints, features y releases con orquestador de agentes IA",
  boardKind: "public",
  boardType: "board",
  columns: [
    { id: "name", title: "Feature", type: "text", width: 300 },
    { id: "status", title: "Estado", type: "status", width: 160, labels: STATUS_LABELS },
    { id: "priority", title: "Prioridad", type: "priority", width: 140, labels: PRIORITY_LABELS },
    { id: "owner", title: "Asignado", type: "people", width: 140 },
    { id: "deadline", title: "Sprint", type: "date", width: 130 },
    { id: "ai_enrichment", title: "Spec Generator", type: "ai_agent", width: 180, agentIds: ["a3"] },
    { id: "updated", title: "Modificado", type: "last_updated", width: 130 },
  ],
  groups: [
    { id: "g1", title: "Backlog", color: "#C4C4C4", position: 0 },
    { id: "g2", title: "Sprint Actual", color: "#00C875", position: 1 },
    { id: "g3", title: "En Revisión", color: "#FFC700", position: 2 },
    { id: "g4", title: "Released", color: "#579BFC", position: 3 },
  ],
  items: [
    {
      id: "p1",
      boardId: "b2",
      groupId: "g2",
      name: "Builder de agentes visuales",
      columnValues: [
        { columnId: "status", value: { labelId: "0" } },
        { columnId: "priority", value: { labelId: "0" } },
        { columnId: "owner", value: { userIds: ["u3", "u4"] } },
        { columnId: "deadline", value: { date: daysFromNow(7) } },
        { columnId: "updated", value: { text: daysFromNow(0) } },
      ],
      createdAt: new Date(NOW - 7 * 86400000).toISOString(),
      updatedAt: new Date(NOW).toISOString(),
      position: 0,
    },
    {
      id: "p2",
      boardId: "b2",
      groupId: "g1",
      name: "Sync bidireccional con Monday.com",
      columnValues: [
        { columnId: "status", value: { labelId: "3" } },
        { columnId: "priority", value: { labelId: "1" } },
        { columnId: "owner", value: { userIds: ["u1"] } },
        { columnId: "deadline", value: { date: daysFromNow(30) } },
        { columnId: "updated", value: { text: daysFromNow(-1) } },
      ],
      createdAt: new Date(NOW - 4 * 86400000).toISOString(),
      updatedAt: new Date(NOW - 1 * 86400000).toISOString(),
      position: 0,
    },
    {
      id: "p3",
      boardId: "b2",
      groupId: "g3",
      name: "Vista Gantt con dependencias",
      columnValues: [
        { columnId: "status", value: { labelId: "0" } },
        { columnId: "priority", value: { labelId: "2" } },
        { columnId: "owner", value: { userIds: ["u4"] } },
        { columnId: "deadline", value: { date: daysFromNow(-1) } },
        { columnId: "updated", value: { text: daysFromNow(-1) } },
      ],
      createdAt: new Date(NOW - 14 * 86400000).toISOString(),
      updatedAt: new Date(NOW - 1 * 86400000).toISOString(),
      position: 0,
    },
  ],
  views: [
    { id: "v1", name: "Main Table", type: "main_table" },
    { id: "v2", name: "Kanban", type: "kanban" },
    { id: "v3", name: "Gantt", type: "gantt" },
  ],
};

const WORKSPACES: Workspace[] = [
  {
    id: "w1",
    name: "Ventas & Marketing",
    kind: "open",
    boardIds: ["b1"],
    color: "#0072E5",
    description: "Pipeline, campañas y reporting comercial",
  },
  {
    id: "w2",
    name: "Producto & Engineering",
    kind: "open",
    boardIds: ["b2"],
    color: "#00C875",
    description: "Roadmap, sprints y releases",
  },
  {
    id: "w3",
    name: "Operaciones",
    kind: "closed",
    boardIds: [],
    color: "#FF642E",
    description: "Procesos internos y SOC",
  },
];

const AGENTS: Agent[] = [
  {
    id: "a1",
    name: "Lead Scorer",
    description: "Analiza el contexto del item (valor, interacciones, deadline) y genera un score 0-100 con justificación.",
    systemPrompt:
      "Eres un analista de ventas B2B. Recibes el contexto de un lead: nombre, valor potencial, fecha límite, estado de pipeline. Devuelve un score 0-100, una etiqueta (Crítico/Alto/Medio/Bajo) y una justificación breve. Usa este formato JSON: {\"score\": number, \"label\": string, \"reasoning\": string}.",
    tools: [
      { name: "mcp-monday-core.get_item", description: "Obtiene item y columnas", schema: {}, isBuiltIn: true, mcpServer: "mcp-monday-core" },
      { name: "mcp-vector-search.similar_leads", description: "Busca leads similares en histórico", schema: {}, isBuiltIn: true, mcpServer: "mcp-vector-search" },
    ],
    model: "glm-4.6",
    temperature: 0.2,
    maxTokens: 800,
    version: 3,
    isActive: true,
    createdById: "u1",
    organizationId: "org1",
    boardId: "b1",
    scope: "board",
    triggers: ["manual", "column_change", "item_created"],
    icon: "🎯",
    color: "#0072E5",
    createdAt: new Date(NOW - 30 * 86400000).toISOString(),
    updatedAt: new Date(NOW - 2 * 86400000).toISOString(),
  },
  {
    id: "a2",
    name: "Email Drafter",
    description: "Redacta respuesta personalizada basada en el hilo de updates del item y el perfil del cliente.",
    systemPrompt:
      "Eres un copywriter senior de ventas. Recibes el historial de updates de un item y el contexto del lead. Redacta un email de seguimiento profesional, conciso, con CTA claro. Devuelve {\"subject\": string, \"body\": string}.",
    tools: [
      { name: "mcp-monday-core.list_updates", description: "Lista updates de un item", schema: {}, isBuiltIn: true, mcpServer: "mcp-monday-core" },
      { name: "mcp-doc-processing.parse_email", description: "Parsea email adjunto", schema: {}, isBuiltIn: true, mcpServer: "mcp-doc-processing" },
    ],
    model: "glm-4.6",
    temperature: 0.7,
    maxTokens: 1500,
    version: 2,
    isActive: true,
    createdById: "u2",
    organizationId: "org1",
    boardId: "b1",
    scope: "board",
    triggers: ["manual", "automation"],
    icon: "✉️",
    color: "#FF642E",
    createdAt: new Date(NOW - 20 * 86400000).toISOString(),
    updatedAt: new Date(NOW - 5 * 86400000).toISOString(),
  },
  {
    id: "a3",
    name: "Spec Generator",
    description: "Genera specs técnicos (PRD) a partir del nombre del feature, contexto del board y updates relacionados.",
    systemPrompt:
      "Eres un PM técnico senior. Recibes el nombre de un feature, el contexto del board y los updates. Genera un PRD en markdown con: Resumen, Objetivos, Requisitos funcionales, Criterios de aceptación, Dependencias, Riesgos. Sé específico y accionable.",
    tools: [
      { name: "mcp-monday-core.list_items", description: "Lista items relacionados", schema: {}, isBuiltIn: true, mcpServer: "mcp-monday-core" },
      { name: "mcp-vector-search.related_features", description: "Busca features similares", schema: {}, isBuiltIn: true, mcpServer: "mcp-vector-search" },
    ],
    model: "glm-4.6",
    temperature: 0.4,
    maxTokens: 3000,
    version: 1,
    isActive: true,
    createdById: "u3",
    organizationId: "org1",
    boardId: "b2",
    scope: "board",
    triggers: ["manual", "automation"],
    icon: "📝",
    color: "#A25BFF",
    createdAt: new Date(NOW - 10 * 86400000).toISOString(),
    updatedAt: new Date(NOW - 1 * 86400000).toISOString(),
  },
  {
    id: "a4",
    name: "Doc Extractor",
    description: "Extrae datos estructurados (NIT, montos, fechas) de PDFs adjuntos en updates del item.",
    systemPrompt:
      "Eres un asistente de extracción documental. Recibes el texto extraído de un PDF. Devuelve un JSON con los campos clave encontrados. Si un campo no está presente, devuelve null.",
    tools: [
      { name: "mcp-doc-processing.parse_pdf", description: "Extrae texto de PDF", schema: {}, isBuiltIn: true, mcpServer: "mcp-doc-processing" },
      { name: "mcp-monday-files.download", description: "Descarga archivo adjunto", schema: {}, isBuiltIn: true, mcpServer: "mcp-monday-files" },
    ],
    model: "glm-4.5-air",
    temperature: 0.1,
    maxTokens: 2000,
    version: 2,
    isActive: true,
    createdById: "u4",
    organizationId: "org1",
    scope: "global",
    triggers: ["manual", "webhook"],
    icon: "📎",
    color: "#00C875",
    createdAt: new Date(NOW - 15 * 86400000).toISOString(),
    updatedAt: new Date(NOW - 3 * 86400000).toISOString(),
  },
  {
    id: "a5",
    name: "Risk Analyzer",
    description: "Agente global que analiza cross-board riesgos: deadlines próximos, items stuck, sobrecarga de personas.",
    systemPrompt:
      "Eres un PMO. Recibes datos consolidados de boards: items stuck, deadlines próximos (<7d), owners sobrecargados. Devuelve un reporte de riesgos priorizado con recomendaciones accionables.",
    tools: [
      { name: "mcp-database.query_boards", description: "Query SQL cross-board", schema: {}, isBuiltIn: true, mcpServer: "mcp-database" },
      { name: "mcp-monday-core.list_boards", description: "Lista boards", schema: {}, isBuiltIn: true, mcpServer: "mcp-monday-core" },
    ],
    model: "glm-4.6",
    temperature: 0.3,
    maxTokens: 2500,
    version: 1,
    isActive: true,
    createdById: "u1",
    organizationId: "org1",
    scope: "global",
    triggers: ["schedule", "manual"],
    schedule: "0 9 * * 1",
    icon: "⚠️",
    color: "#E2445C",
    createdAt: new Date(NOW - 8 * 86400000).toISOString(),
    updatedAt: new Date(NOW - 1 * 86400000).toISOString(),
  },
];

const EXECUTIONS_SEED: AgentExecution[] = [
  {
    id: "ex1",
    agentId: "a1",
    itemId: "i1",
    triggerType: "manual",
    input: { customContext: "Acme Corp — valor 85k, deadline 14 días" },
    output: { score: 87, label: "Alto", reasoning: "Valor alto, deadline próximo, sin actividad previa stalled." },
    status: "completed",
    tokensUsed: 1240,
    costUsd: 0.012,
    startedAt: new Date(NOW - 2 * 86400000).toISOString(),
    completedAt: new Date(NOW - 2 * 86400000 + 3000).toISOString(),
    streamChunks: ["Analizando contexto...", "Valor: 85k — alto potencial.", " Score final: 87/100 — Alto."],
  },
  {
    id: "ex2",
    agentId: "a1",
    itemId: "i3",
    triggerType: "manual",
    input: { customContext: "Initech — renovación 45k" },
    output: { score: 72, label: "Medio", reasoning: "Renovación recurrente, valor moderado, competidor presente." },
    status: "completed",
    tokensUsed: 980,
    costUsd: 0.009,
    startedAt: new Date(NOW - 1 * 86400000).toISOString(),
    completedAt: new Date(NOW - 1 * 86400000 + 2500).toISOString(),
    streamChunks: ["Contexto: renovación recurrente.", " Score: 72/100 — Medio."],
  },
  {
    id: "ex3",
    agentId: "a1",
    itemId: "i5",
    triggerType: "automation",
    input: {},
    output: { score: 95, label: "Crítico", reasoning: "Cliente estratégico, valor 540k, deploy completado." },
    status: "completed",
    tokensUsed: 1320,
    costUsd: 0.013,
    startedAt: new Date(NOW - 3 * 86400000).toISOString(),
    completedAt: new Date(NOW - 3 * 86400000 + 4000).toISOString(),
    streamChunks: ["Stark Industries — strategic account.", " Score: 95/100 — Crítico."],
  },
  {
    id: "ex4",
    agentId: "a1",
    itemId: "i6",
    triggerType: "manual",
    input: {},
    output: { score: 23, label: "Bajo", reasoning: "Piloto cancelado, sin pipeline futuro." },
    status: "completed",
    tokensUsed: 850,
    costUsd: 0.008,
    startedAt: new Date(NOW - 15 * 86400000).toISOString(),
    completedAt: new Date(NOW - 15 * 86400000 + 2000).toISOString(),
    streamChunks: ["Piloto cancelado.", " Score: 23/100 — Bajo."],
  },
];

const PLANS_SEED: OrchestratorPlan[] = [
  {
    id: "plan1",
    name: "Lead-to-Ops Pipeline",
    description: "Pipeline completo: cuando entra un lead → score → si >70 → draft email → enriquecer → notificar",
    organizationId: "org1",
    isActive: true,
    createdAt: new Date(NOW - 5 * 86400000).toISOString(),
    updatedAt: new Date(NOW - 1 * 86400000).toISOString(),
    steps: [
      { id: "s1", name: "Score lead", agentId: "a1", dependsOn: [], parallel: false, inputMapping: {} },
      { id: "s2", name: "Enriquecer (si score>70)", agentId: "a3", dependsOn: ["s1"], parallel: false, condition: "output.score > 70", inputMapping: { score: "s1.output.score" } },
      { id: "s3", name: "Draft email", agentId: "a2", dependsOn: ["s1"], parallel: true, inputMapping: { score: "s1.output.score" } },
      { id: "s4", name: "Notificar owner", agentId: "a5", dependsOn: ["s2", "s3"], parallel: false, inputMapping: { enrichment: "s2.output", email: "s3.output" } },
    ],
  },
  {
    id: "plan2",
    name: "Feature Release Checklist",
    description: "Al marcar feature como Done → generar spec final → extraer docs → risk analysis cross-board",
    organizationId: "org1",
    isActive: true,
    createdAt: new Date(NOW - 3 * 86400000).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    steps: [
      { id: "s1", name: "Spec final", agentId: "a3", dependsOn: [], parallel: false },
      { id: "s2", name: "Extraer docs", agentId: "a4", dependsOn: [], parallel: true },
      { id: "s3", name: "Risk analysis", agentId: "a5", dependsOn: ["s1", "s2"], parallel: false },
    ],
  },
];

const AUTOMATIONS_SEED: AutomationRecipe[] = [
  {
    id: "auto1",
    name: "Lead → Score automático",
    description: "Cuando se crea un item en grupo 'Nuevo Lead' → ejecutar Lead Scorer",
    trigger: { kind: "when_item_created", config: { groupId: "g1" } },
    conditions: [],
    action: { kind: "run_agent", config: { agentId: "a1" } },
    isActive: true,
    boardId: "b1",
    createdAt: new Date(NOW - 7 * 86400000).toISOString(),
  },
  {
    id: "auto2",
    name: "Stuck → Notificar owner",
    description: "Cuando estado cambia a 'Stuck' → notificar al owner asignado",
    trigger: { kind: "when_status_changes", config: { labelId: "2" } },
    conditions: [],
    action: { kind: "notify", config: { recipients: ["owner"], message: "Item {{item.name}} está stuck" } },
    isActive: true,
    boardId: "b1",
    createdAt: new Date(NOW - 14 * 86400000).toISOString(),
  },
  {
    id: "auto3",
    name: "Closed Won → Mover a grupo",
    description: "Cuando estado = Done en board ventas → mover a grupo Closed Won",
    trigger: { kind: "when_status_changes", config: { labelId: "1" } },
    conditions: [],
    action: { kind: "move_item", config: { groupId: "g3" } },
    isActive: true,
    boardId: "b1",
    createdAt: new Date(NOW - 21 * 86400000).toISOString(),
  },
];

const ACTIVITY_SEED: ActivityEvent[] = [
  {
    id: "act1",
    itemId: "i1",
    type: "agent_completed",
    data: { score: 87, label: "Alto" },
    agentId: "a1",
    userId: "u1",
    createdAt: new Date(NOW - 2 * 86400000).toISOString(),
  },
  {
    id: "act2",
    itemId: "i1",
    type: "update_posted",
    data: { body: "Lead calificado como Alto. Iniciar outreach." },
    userId: "u1",
    createdAt: new Date(NOW - 2 * 86400000 + 60000).toISOString(),
  },
  {
    id: "act3",
    itemId: "i3",
    type: "column_changed",
    data: { columnId: "status", from: "3", to: "0" },
    userId: "u3",
    createdAt: new Date(NOW - 1 * 86400000).toISOString(),
  },
];

const NOTIFICATIONS_SEED: AppNotification[] = [
  {
    id: "n-seed-1",
    type: "agent_completed",
    title: "Lead Scorer completó ejecución",
    body: "Acme Corp — Plataforma enterprise → Score 87/100 (Alto)",
    itemId: "i1",
    agentId: "a1",
    read: false,
    createdAt: new Date(NOW - 2 * 3600000).toISOString(),
  },
  {
    id: "n-seed-2",
    type: "mention",
    title: "Marco Liu te mencionó",
    body: "@sofia ¿asumimos outreach de Acme Corp?",
    itemId: "i1",
    read: false,
    createdAt: new Date(NOW - 5 * 3600000).toISOString(),
  },
  {
    id: "n-seed-3",
    type: "deadline",
    title: "Deadline próximo",
    body: "Initech — Renovación contrato vence en 3 días",
    itemId: "i3",
    read: true,
    createdAt: new Date(NOW - 8 * 3600000).toISOString(),
  },
  {
    id: "n-seed-4",
    type: "automation",
    title: "Automatización ejecutada",
    body: "Closed Won → mover a grupo completado (Stark Industries)",
    itemId: "i5",
    read: true,
    createdAt: new Date(NOW - 24 * 3600000).toISOString(),
  },
];

const UPDATES_SEED: Update[] = [
  {
    id: "upd1",
    itemId: "i1",
    body: "Lead de Acme Corp entrante por referral de Stark. Valor potencial 85k, interesados en plataforma enterprise. @sofia ¿asumimos outreach?",
    authorId: "u2",
    createdAt: new Date(NOW - 3 * 86400000).toISOString(),
    mentionedUserIds: ["u1"],
    attachments: [],
  },
  {
    id: "upd2",
    itemId: "i1",
    body: "🤖 **Lead Scorer** ejecutado automáticamente. Score: **87/100 — Alto**. Razón: valor alto, deadline próximo, sin actividad previa stalled. Recomendación: priorizar outreach en 48h.",
    authorId: "u1",
    createdAt: new Date(NOW - 2 * 86400000).toISOString(),
  },
  {
    id: "upd3",
    itemId: "i1",
    body: "Sí, tomo la conducción. Programa demo para jueves.",
    authorId: "u1",
    createdAt: new Date(NOW - 2 * 86400000 + 300000).toISOString(),
    replies: [],
  },
  {
    id: "upd4",
    itemId: "i3",
    body: "Renovación Initech confirmada por cuenta. Pendiente firma contrato. @priya adelantar legal.",
    authorId: "u1",
    createdAt: new Date(NOW - 1 * 86400000).toISOString(),
    mentionedUserIds: ["u3"],
  },
];

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

interface AppState {
  // Datos
  users: User[];
  teams: Team[];
  workspaces: Workspace[];
  boards: Board[];
  agents: Agent[];
  executions: AgentExecution[];
  plans: OrchestratorPlan[];
  automations: AutomationRecipe[];
  updates: Update[];
  activities: ActivityEvent[];
  notifications: AppNotification[];
  files: AppFile[];
  currentUserId: string;

  // Favoritos y Recents
  favoriteBoardIds: string[];
  recentBoardIds: string[];

  // UI state
  activeBoardId: string;
  activeViewId: string; // board view id
  selectedItemId: string | null;
  selectedRowIds: string[]; // multi-select en tabla
  itemDetailTab: "updates" | "activity" | "files" | "subitems" | "ai";
  showAgentBuilder: boolean;
  showOrchestrator: boolean;
  showExportImport: boolean;
  commandPaletteOpen: boolean;
  showAutomations: boolean;
  showAddColumn: boolean;
  showAddBoard: boolean;
  showAddView: boolean;
  showNewPlan: boolean;
  showNewAutomation: boolean;
  showMondayConnect: boolean;
  showMondayImport: boolean;
  showSidekick: boolean;
  showSettings: boolean;
  sidebarView: "boards" | "home" | "dashboards" | "docs" | "team";

  // Configuración global de la aplicación
  settings: {
    /** API key de Groq (proveedor de modelos Llama / DeepSeek) */
    groqApiKey: string | null;
    /** API key de OpenAI (futuro soporte GPT-4o) */
    openaiApiKey: string | null;
    /** API key de Anthropic (futuro soporte Claude) */
    anthropicApiKey: string | null;
    /** Modelo por default para nuevos agentes */
    defaultModel: string;
    /** Temperatura por default para nuevos agentes */
    defaultTemperature: number;
    /** Tema de la interfaz */
    theme: "dark" | "light" | "system";
    /** Idioma de la interfaz */
    language: "es" | "en";
  };

  // Sidekick chat
  sidekickMessages: SidekickMessage[];
  /** @deprecated Usar settings.groqApiKey. Mantenido por compatibilidad. */
  sidekickGroqApiKey: string | null;
  sidekickThinking: boolean;

  // Board toolbar state
  filters: { columnId: string; op: string; value: any }[];
  sorts: { columnId: string; dir: "asc" | "desc" }[];
  groupBy: string | null;
  hiddenColumns: string[];

  // Flag de hidratación — false hasta que zustand/persist carga localStorage
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // Actions
  setActiveBoard: (boardId: string) => void;
  setActiveView: (viewId: string) => void;
  selectItem: (itemId: string | null) => void;
  toggleRowSelection: (itemId: string) => void;
  selectAllRows: (itemIds: string[]) => void;
  clearRowSelection: () => void;
  setItemDetailTab: (tab: AppState["itemDetailTab"]) => void;
  setShowAgentBuilder: (v: boolean) => void;
  setShowOrchestrator: (v: boolean) => void;
  setShowExportImport: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setShowAutomations: (v: boolean) => void;
  setShowAddColumn: (v: boolean) => void;
  setShowAddBoard: (v: boolean) => void;
  setShowAddView: (v: boolean) => void;
  setShowNewPlan: (v: boolean) => void;
  setShowNewAutomation: (v: boolean) => void;
  setShowMondayConnect: (v: boolean) => void;
  setShowMondayImport: (v: boolean) => void;
  setShowSidekick: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setSidebarView: (v: AppState["sidebarView"]) => void;

  // Settings actions
  updateSettings: (patch: Partial<AppState["settings"]>) => void;

  // Favoritos y Recents
  toggleFavorite: (boardId: string) => void;
  addToRecent: (boardId: string) => void;

  // Sidekick chat actions
  addSidekickMessage: (msg: SidekickMessage) => void;
  updateSidekickMessage: (id: string, patch: Partial<SidekickMessage>) => void;
  clearSidekickMessages: () => void;
  setSidekickGroqApiKey: (key: string | null) => void;
  setSidekickThinking: (v: boolean) => void;

  // Toolbar actions
  setFilters: (f: AppState["filters"]) => void;
  setSorts: (s: AppState["sorts"]) => void;
  setGroupBy: (g: string | null) => void;
  setHiddenColumns: (cols: string[]) => void;

  // CRUD items
  updateItemName: (itemId: string, name: string) => void;
  updateColumnValue: (itemId: string, columnId: string, value: any) => void;
  addItem: (boardId: string, groupId: string, name: string) => string;
  deleteItem: (itemId: string) => void;
  duplicateItem: (itemId: string) => void;
  moveItem: (itemId: string, toGroupId: string) => void;
  archiveItem: (itemId: string) => void;

  // CRUD groups
  addGroup: (boardId: string, title: string) => void;
  renameGroup: (boardId: string, groupId: string, title: string) => void;
  duplicateGroup: (boardId: string, groupId: string) => void;
  deleteGroup: (boardId: string, groupId: string) => void;
  toggleGroupCollapse: (boardId: string, groupId: string) => void;

  // CRUD boards / workspaces
  addBoard: (workspaceId: string, name: string) => string;
  renameBoard: (boardId: string, name: string) => void;
  duplicateBoard: (boardId: string) => string;
  archiveBoard: (boardId: string) => void;
  deleteBoard: (boardId: string) => void;
  addWorkspace: (name: string) => string;
  renameWorkspace: (workspaceId: string, name: string) => void;
  deleteWorkspace: (workspaceId: string) => void;
  addColumn: (boardId: string, col: Omit<ColumnDef, "id">) => void;
  deleteColumn: (boardId: string, columnId: string) => void;
  addView: (boardId: string, view: { name: string; type: ViewType }) => void;

  // Subitems
  addSubitem: (parentId: string, name: string) => void;
  updateSubitem: (parentId: string, subitemId: string, name: string) => void;
  deleteSubitem: (parentId: string, subitemId: string) => void;

  // Updates
  addUpdate: (itemId: string, body: string) => void;
  deleteUpdate: (updateId: string) => void;

  // Agents
  addAgent: (agent: Agent) => void;
  updateAgent: (agentId: string, patch: Partial<Agent>) => void;
  deleteAgent: (agentId: string) => void;
  addExecution: (exec: AgentExecution) => void;
  updateExecution: (id: string, patch: Partial<AgentExecution>) => void;
  appendStreamChunk: (id: string, chunk: string) => void;

  // Plans
  addPlan: (plan: OrchestratorPlan) => void;
  updatePlan: (planId: string, patch: Partial<OrchestratorPlan>) => void;
  deletePlan: (planId: string) => void;

  // Automations
  addAutomation: (auto: AutomationRecipe) => void;
  updateAutomation: (autoId: string, patch: Partial<AutomationRecipe>) => void;
  toggleAutomation: (autoId: string) => void;
  deleteAutomation: (autoId: string) => void;

  // Notifications
  pushNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Files
  addFile: (file: Omit<AppFile, "id" | "createdAt">) => void;
  deleteFile: (fileId: string) => void;

  // ---- Monday.com integration ----
  mondayApiKey: string | null;
  mondayConnected: boolean;
  mondayAccount: {
    id: string;
    name: string;
    email: string;
    planTier: string;
    logo?: string;
  } | null;
  setMondayConnection: (
    apiKey: string | null,
    account?: AppState["mondayAccount"]
  ) => void;
  disconnectMonday: () => void;

  // ---- Importación desde Monday ----
  importState: {
    active: boolean;
    currentStep: string;
    message: string;
    current: number;
    total: number;
    log: { ts: string; type: string; message: string }[];
  };
  setImportState: (patch: Partial<AppState["importState"]>) => void;
  pushImportLog: (type: string, message: string) => void;
  resetImportState: () => void;

  // Fusionar datos importados de Monday con los locales (sin duplicados)
  mergeImportedData: (data: {
    users?: User[];
    teams?: Team[];
    workspaces?: Workspace[];
    boards?: Board[];
  }) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      users: USERS,
      teams: TEAMS,
      workspaces: WORKSPACES,
      boards: [BOARD_SALES, BOARD_PRODUCT],
      agents: AGENTS,
      executions: EXECUTIONS_SEED,
      plans: PLANS_SEED,
      automations: AUTOMATIONS_SEED,
      updates: UPDATES_SEED,
      activities: ACTIVITY_SEED,
      notifications: NOTIFICATIONS_SEED,
      files: [],
      mondayApiKey: null,
      mondayConnected: false,
      mondayAccount: null,
      importState: {
        active: false,
        currentStep: "",
        message: "",
        current: 0,
        total: 0,
        log: [],
      },
      currentUserId: "u1",
      favoriteBoardIds: [],
      recentBoardIds: [],
      activeBoardId: "b1",
      activeViewId: "v1",
      selectedItemId: null,
      selectedRowIds: [],
      itemDetailTab: "updates",
      showAgentBuilder: false,
      showOrchestrator: false,
      showExportImport: false,
      commandPaletteOpen: false,
      showAutomations: false,
      showAddColumn: false,
      showAddBoard: false,
      showAddView: false,
      showNewPlan: false,
      showNewAutomation: false,
      showMondayConnect: false,
      showMondayImport: false,
      showSidekick: false,
      showSettings: false,
      sidebarView: "boards",
      settings: {
        groqApiKey: null,
        openaiApiKey: null,
        anthropicApiKey: null,
        defaultModel: "glm-4.6",
        defaultTemperature: 0.4,
        theme: "dark",
        language: "es",
      },
      sidekickMessages: [],
      sidekickGroqApiKey: null,
      sidekickThinking: false,
      filters: [],
      sorts: [],
      groupBy: null,
      hiddenColumns: [],
      // Flag que indica si el store ya se hidrató desde localStorage
      // Es false en el primer render del servidor y del cliente, y pasa a true
      // cuando zustand/persist termina de leer localStorage. La UI lo usa para
      // mostrar un splash en vez del estado seed (que causaba el "flash").
      _hasHydrated: false,
      setHasHydrated: (v: boolean) => set({ _hasHydrated: v }),

      setActiveBoard: (boardId) => {
        const board = get().boards.find((b) => b.id === boardId);
        const prevRecent = get().recentBoardIds;
        set({
          activeBoardId: boardId,
          activeViewId: board?.views[0]?.id ?? "v1",
          selectedItemId: null,
          selectedRowIds: [],
          filters: [],
          sorts: [],
          groupBy: null,
          hiddenColumns: [],
          sidebarView: "boards",
          recentBoardIds: [boardId, ...prevRecent.filter((id) => id !== boardId)].slice(0, 5),
        });
      },
      setActiveView: (viewId) => set({ activeViewId: viewId }),
      selectItem: (itemId) => set({ selectedItemId: itemId }),
      toggleRowSelection: (itemId) =>
        set((s) => ({
          selectedRowIds: s.selectedRowIds.includes(itemId)
            ? s.selectedRowIds.filter((id) => id !== itemId)
            : [...s.selectedRowIds, itemId],
        })),
      selectAllRows: (itemIds) => set({ selectedRowIds: itemIds }),
      clearRowSelection: () => set({ selectedRowIds: [] }),
      setItemDetailTab: (tab) => set({ itemDetailTab: tab }),
      setShowAgentBuilder: (v) => set({ showAgentBuilder: v }),
      setShowOrchestrator: (v) => set({ showOrchestrator: v }),
      setShowExportImport: (v) => set({ showExportImport: v }),
      setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
      setShowAutomations: (v) => set({ showAutomations: v }),
      setShowAddColumn: (v) => set({ showAddColumn: v }),
      setShowAddBoard: (v) => set({ showAddBoard: v }),
      setShowAddView: (v) => set({ showAddView: v }),
      setShowNewPlan: (v) => set({ showNewPlan: v }),
      setShowNewAutomation: (v) => set({ showNewAutomation: v }),
      setShowMondayConnect: (v) => set({ showMondayConnect: v }),
      setShowMondayImport: (v) => set({ showMondayImport: v }),
      setShowSidekick: (v) => set({ showSidekick: v }),
      setShowSettings: (v) => set({ showSettings: v }),
      setSidebarView: (v) => set({ sidebarView: v }),

      updateSettings: (patch) =>
        set((s) => ({
          settings: { ...s.settings, ...patch },
          // Sincronizar sidekickGroqApiKey por compatibilidad
          sidekickGroqApiKey: patch.groqApiKey !== undefined
            ? patch.groqApiKey
            : s.sidekickGroqApiKey,
        })),

      // ---- Favoritos y Recents ----
      toggleFavorite: (boardId) =>
        set((s) => ({
          favoriteBoardIds: s.favoriteBoardIds.includes(boardId)
            ? s.favoriteBoardIds.filter((id) => id !== boardId)
            : [...s.favoriteBoardIds, boardId],
        })),
      addToRecent: (boardId) =>
        set((s) => ({
          recentBoardIds: [boardId, ...s.recentBoardIds.filter((id) => id !== boardId)].slice(0, 5),
        })),

      // ---- Sidekick chat ----
      addSidekickMessage: (msg) =>
        set((s) => {
          // Idempotente: no agregar si ya existe un mensaje con el mismo ID
          // (evita duplicados por React StrictMode que ejecuta efectos dos veces)
          if (s.sidekickMessages.some((m) => m.id === msg.id)) return s;
          return { sidekickMessages: [...s.sidekickMessages, msg] };
        }),
      updateSidekickMessage: (id, patch) =>
        set((s) => ({
          sidekickMessages: s.sidekickMessages.map((m) =>
            m.id === id ? { ...m, ...patch } : m
          ),
        })),
      clearSidekickMessages: () => set({ sidekickMessages: [] }),
      setSidekickGroqApiKey: (key) => set({ sidekickGroqApiKey: key }),
      setSidekickThinking: (v) => set({ sidekickThinking: v }),

      setFilters: (f) => set({ filters: f }),
      setSorts: (s) => set({ sorts: s }),
      setGroupBy: (g) => set({ groupBy: g }),
      setHiddenColumns: (cols) => set({ hiddenColumns: cols }),

      updateItemName: (itemId, name) =>
        set((s) => ({
          boards: s.boards.map((b) => ({
            ...b,
            items: b.items.map((it) =>
              it.id === itemId ? { ...it, name, updatedAt: new Date().toISOString() } : it
            ),
          })),
        })),

      updateColumnValue: (itemId, columnId, value) =>
        set((s) => ({
          boards: s.boards.map((b) => ({
            ...b,
            items: b.items.map((it) => {
              if (it.id !== itemId) return it;
              const others = it.columnValues.filter((cv) => cv.columnId !== columnId);
              return {
                ...it,
                columnValues: [...others, { columnId, value }],
                updatedAt: new Date().toISOString(),
              };
            }),
          })),
          activities: [
            {
              id: genId("act"),
              itemId,
              type: "column_changed",
              data: { columnId, value },
              userId: s.currentUserId,
              createdAt: new Date().toISOString(),
            },
            ...s.activities,
          ],
        })),

      addUpdate: (itemId, body) =>
        set((s) => ({
          // Cap updates a 1000 por item para evitar memory leak
          updates: [
            {
              id: genId("upd"),
              itemId,
              body,
              authorId: s.currentUserId,
              createdAt: new Date().toISOString(),
            },
            ...s.updates,
          ].slice(0, 1000),
          activities: [
            {
              id: genId("act-upd"),
              itemId,
              type: "update_posted" as const,
              data: { body },
              userId: s.currentUserId,
              createdAt: new Date().toISOString(),
            },
            ...s.activities,
          ].slice(0, 500),
        })),

      addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
      updateAgent: (agentId, patch) =>
        set((s) => ({
          agents: s.agents.map((a) => (a.id === agentId ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)),
        })),
      deleteAgent: (agentId) => set((s) => ({ agents: s.agents.filter((a) => a.id !== agentId) })),

      addExecution: (exec) =>
        set((s) => ({
          // Cap executions a 200 para evitar memory leak
          executions: [exec, ...s.executions].slice(0, 200),
        })),
      updateExecution: (id, patch) =>
        set((s) => ({
          executions: s.executions.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      appendStreamChunk: (id, chunk) =>
        set((s) => ({
          executions: s.executions.map((e) =>
            e.id === id ? { ...e, streamChunks: [...(e.streamChunks ?? []), chunk] } : e
          ),
        })),

      addPlan: (plan) => set((s) => ({ plans: [...s.plans, plan] })),

      addGroup: (boardId, title) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  groups: [
                    ...b.groups,
                    {
                      id: genId("g"),
                      title,
                      color: "#579BFC",
                      position: b.groups.length,
                    },
                  ],
                }
              : b
          ),
        })),

      addItem: (boardId, groupId, name) => {
        // Generar ID antes del set para poder retornarlo (necesario para que
        // el Sidekick y otros callers puedan encadenar operaciones con el ID).
        const itemId = genId("i");
        const now = new Date().toISOString();
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  items: [
                    ...b.items,
                    {
                      id: itemId,
                      boardId,
                      groupId,
                      name,
                      columnValues: [],
                      createdAt: now,
                      updatedAt: now,
                      position: b.items.filter((i) => i.groupId === groupId).length,
                    },
                  ],
                }
              : b
          ),
          // Cap activities a 500 para evitar memory leak (se persistian sin límite)
          activities: [
            {
              id: genId("act"),
              itemId,
              type: "item_created" as const,
              data: { name },
              userId: s.currentUserId,
              createdAt: now,
            },
            ...s.activities,
          ].slice(0, 500),
        }));
        return itemId;
      },

      moveItem: (itemId, toGroupId) =>
        set((s) => ({
          boards: s.boards.map((b) => ({
            ...b,
            items: b.items.map((it) =>
              it.id === itemId ? { ...it, groupId: toGroupId, updatedAt: new Date().toISOString() } : it
            ),
          })),
          activities: [
            {
              id: genId("act-mv"),
              itemId,
              type: "column_changed",
              data: { field: "group", to: toGroupId },
              userId: s.currentUserId,
              createdAt: new Date().toISOString(),
            },
            ...s.activities,
          ],
        })),

      toggleGroupCollapse: (boardId, groupId) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  groups: b.groups.map((g) =>
                    g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
                  ),
                }
              : b
          ),
        })),

      // ---- Nuevas acciones de items ----
      deleteItem: (itemId) =>
        set((s) => ({
          boards: s.boards.map((b) => ({
            ...b,
            items: b.items.filter((i) => i.id !== itemId),
          })),
          selectedItemId: s.selectedItemId === itemId ? null : s.selectedItemId,
          selectedRowIds: s.selectedRowIds.filter((id) => id !== itemId),
          activities: [
            {
              id: genId("act-del"),
              itemId,
              type: "item_archived",
              data: {},
              userId: s.currentUserId,
              createdAt: new Date().toISOString(),
            },
            ...s.activities,
          ],
        })),

      duplicateItem: (itemId) =>
        set((s) => ({
          boards: s.boards.map((b) => {
            const orig = b.items.find((i) => i.id === itemId);
            if (!orig) return b;
            const copy: Item = {
              ...orig,
              id: genId("i"),
              name: `${orig.name} (copia)`,
              columnValues: orig.columnValues.map((cv) => ({ ...cv, value: JSON.parse(JSON.stringify(cv.value)) })),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            return { ...b, items: [...b.items, copy] };
          }),
        })),

      archiveItem: (itemId) =>
        set((s) => ({
          boards: s.boards.map((b) => ({
            ...b,
            items: b.items.map((i) =>
              i.id === itemId ? { ...i, archived: true } : i
            ),
          })),
          activities: [
            {
              id: genId("act-arch"),
              itemId,
              type: "item_archived",
              data: {},
              userId: s.currentUserId,
              createdAt: new Date().toISOString(),
            },
            ...s.activities,
          ],
        })),

      // ---- Nuevas acciones de grupos ----
      renameGroup: (boardId, groupId, title) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  groups: b.groups.map((g) =>
                    g.id === groupId ? { ...g, title } : g
                  ),
                }
              : b
          ),
        })),

      duplicateGroup: (boardId, groupId) =>
        set((s) => ({
          boards: s.boards.map((b) => {
            if (b.id !== boardId) return b;
            const origGroup = b.groups.find((g) => g.id === groupId);
            if (!origGroup) return b;
            const newGroupId = genId("g");
            const newGroup = {
              ...origGroup,
              id: newGroupId,
              title: `${origGroup.title} (copia)`,
              position: b.groups.length,
            };
            const groupItems = b.items
              .filter((i) => i.groupId === groupId)
              .map((i) => ({
                ...i,
                id: genId("i"),
                groupId: newGroupId,
                columnValues: i.columnValues.map((cv) => ({ ...cv, value: JSON.parse(JSON.stringify(cv.value)) })),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }));
            return {
              ...b,
              groups: [...b.groups, newGroup],
              items: [...b.items, ...groupItems],
            };
          }),
        })),

      deleteGroup: (boardId, groupId) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  groups: b.groups.filter((g) => g.id !== groupId),
                  items: b.items.filter((i) => i.groupId !== groupId),
                }
              : b
          ),
        })),

      // ---- Boards / workspaces ----
      addBoard: (workspaceId, name) => {
        const boardId = genId("b");
        const newBoard: Board = {
          id: boardId,
          workspaceId,
          name,
          description: "",
          boardKind: "public",
          boardType: "board",
          columns: [
            { id: "name", title: "Item", type: "text", width: 320 },
            {
              id: "status",
              title: "Estado",
              type: "status",
              width: 160,
              labels: {
                "0": { name: "Working on it", color: "#FFC700" },
                "1": { name: "Done", color: "#00C875" },
                "2": { name: "Stuck", color: "#E2445C" },
                "3": { name: "Not Started", color: "#C4C4C4" },
              },
            },
            { id: "owner", title: "Owner", type: "people", width: 140 },
            { id: "deadline", title: "Deadline", type: "date", width: 140 },
          ],
          groups: [
            { id: genId("g"), title: "Group 1", color: "#579BFC", position: 0 },
          ],
          items: [],
          views: [
            { id: genId("v"), name: "Main Table", type: "main_table" },
            { id: genId("v-k"), name: "Kanban", type: "kanban" },
          ],
        };
        set((s) => ({
          boards: [...s.boards, newBoard],
          // FIX: antes no actualizaba workspace.boardIds → el sidebar no
          // mostraba el board nuevo hasta refresh.
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, boardIds: [...w.boardIds, boardId] }
              : w
          ),
          activeBoardId: boardId,
          activeViewId: newBoard.views[0].id,
          selectedItemId: null,
          sidebarView: "boards",
          recentBoardIds: [boardId, ...s.recentBoardIds.filter((id) => id !== boardId)].slice(0, 5),
        }));
        return boardId;
      },

      deleteBoard: (boardId) =>
        set((s) => {
          const remaining = s.boards.filter((b) => b.id !== boardId);
          // FIX: cascade delete — limpiar updates, files, activities, executions
          // huérfanos del board eliminado para evitar memory leak.
          const boardItemIds = s.boards.find((b) => b.id === boardId)?.items.map((i) => i.id) ?? [];
          return {
            boards: remaining,
            workspaces: s.workspaces.map((w) => ({
              ...w,
              boardIds: w.boardIds.filter((id) => id !== boardId),
            })),
            updates: s.updates.filter((u) => !boardItemIds.includes(u.itemId)),
            files: s.files.filter((f) => !boardItemIds.includes(f.itemId)),
            activities: s.activities.filter((a) => !boardItemIds.includes(a.itemId ?? "")),
            favoriteBoardIds: s.favoriteBoardIds.filter((id) => id !== boardId),
            recentBoardIds: s.recentBoardIds.filter((id) => id !== boardId),
            activeBoardId:
              s.activeBoardId === boardId
                ? remaining[0]?.id ?? ""
                : s.activeBoardId,
          };
        }),

      renameBoard: (boardId, name) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId ? { ...b, name } : b
          ),
        })),

      archiveBoard: (boardId) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? { ...b, archived: true }
              : b
          ),
        })),

      duplicateBoard: (boardId) => {
        const source = get().boards.find((b) => b.id === boardId);
        if (!source) return "";
        const newId = genId("b");
        const newBoard: Board = {
          ...source,
          id: newId,
          name: `${source.name} (copia)`,
          items: source.items.map((i) => ({
            ...i,
            id: genId("i"),
            columnValues: [...i.columnValues],
            subitems: [],
          })),
          groups: source.groups.map((g) => ({
            ...g,
            id: genId("g"),
          })),
          views: source.views.map((v) => ({
            ...v,
            id: genId("v"),
          })),
        };
        set((s) => ({
          boards: [...s.boards, newBoard],
          workspaces: s.workspaces.map((w) =>
            w.id === source.workspaceId
              ? { ...w, boardIds: [...w.boardIds, newId] }
              : w
          ),
        }));
        return newId;
      },

      addWorkspace: (name) => {
        const wsId = genId("w");
        set((s) => ({
          workspaces: [
            ...s.workspaces,
            {
              id: wsId,
              name,
              kind: "open" as const,
              boardIds: [],
              color: "#0072E5",
              description: "",
            },
          ],
        }));
        return wsId;
      },

      renameWorkspace: (workspaceId, name) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, name } : w
          ),
        })),

      deleteWorkspace: (workspaceId) =>
        set((s) => {
          const remainingBoards = s.boards.filter(
            (b) => b.workspaceId !== workspaceId
          );
          return {
            workspaces: s.workspaces.filter((w) => w.id !== workspaceId),
            boards: remainingBoards,
            activeBoardId:
              s.boards.find((b) => b.id === s.activeBoardId)?.workspaceId === workspaceId
                ? remainingBoards[0]?.id ?? ""
                : s.activeBoardId,
          };
        }),

      addColumn: (boardId, col) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  columns: [
                    ...b.columns,
                    { ...col, id: `col-${Date.now()}` },
                  ],
                }
              : b
          ),
        })),

      deleteColumn: (boardId, columnId) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  columns: b.columns.filter((c) => c.id !== columnId),
                  items: b.items.map((i) => ({
                    ...i,
                    columnValues: i.columnValues.filter(
                      (cv) => cv.columnId !== columnId
                    ),
                  })),
                }
              : b
          ),
          hiddenColumns: s.hiddenColumns.filter((c) => c !== columnId),
        })),

      addView: (boardId, view) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  views: [
                    ...b.views,
                    { id: genId("v"), name: view.name, type: view.type },
                  ],
                }
              : b
          ),
        })),

      // ---- Subitems ----
      addSubitem: (parentId, name) =>
        set((s) => ({
          boards: s.boards.map((b) => ({
            ...b,
            items: b.items.map((i) =>
              i.id === parentId
                ? {
                    ...i,
                    subItems: [
                      ...(i.subItems ?? []),
                      {
                        id: `si-${Date.now()}`,
                        parentId,
                        name,
                        columnValues: [],
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  }
                : i
            ),
          })),
          activities: [
            {
              id: genId("act-sub"),
              itemId: parentId,
              type: "subitem_created",
              data: { name },
              userId: s.currentUserId,
              createdAt: new Date().toISOString(),
            },
            ...s.activities,
          ],
        })),

      updateSubitem: (parentId, subitemId, name) =>
        set((s) => ({
          boards: s.boards.map((b) => ({
            ...b,
            items: b.items.map((i) =>
              i.id === parentId
                ? {
                    ...i,
                    subItems: (i.subItems ?? []).map((si) =>
                      si.id === subitemId ? { ...si, name } : si
                    ),
                  }
                : i
            ),
          })),
        })),

      deleteSubitem: (parentId, subitemId) =>
        set((s) => ({
          boards: s.boards.map((b) => ({
            ...b,
            items: b.items.map((i) =>
              i.id === parentId
                ? {
                    ...i,
                    subItems: (i.subItems ?? []).filter(
                      (si) => si.id !== subitemId
                    ),
                  }
                : i
            ),
          })),
        })),

      // ---- Updates ----
      deleteUpdate: (updateId) =>
        set((s) => ({
          updates: s.updates.filter((u) => u.id !== updateId),
        })),

      // ---- Plans ----
      updatePlan: (planId, patch) =>
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id === planId
              ? { ...p, ...patch, updatedAt: new Date().toISOString() }
              : p
          ),
        })),
      deletePlan: (planId) =>
        set((s) => ({ plans: s.plans.filter((p) => p.id !== planId) })),

      // ---- Automations ----
      addAutomation: (auto) =>
        set((s) => ({ automations: [...s.automations, auto] })),
      updateAutomation: (autoId, patch) =>
        set((s) => ({
          automations: s.automations.map((a) =>
            a.id === autoId ? { ...a, ...patch } : a
          ),
        })),
      toggleAutomation: (autoId) =>
        set((s) => ({
          automations: s.automations.map((a) =>
            a.id === autoId ? { ...a, isActive: !a.isActive } : a
          ),
        })),
      deleteAutomation: (autoId) =>
        set((s) => ({
          automations: s.automations.filter((a) => a.id !== autoId),
        })),

      // ---- Notifications ----
      pushNotification: (n) =>
        set((s) => ({
          notifications: [
            {
              ...n,
              id: genId("n"),
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...s.notifications,
          ].slice(0, 50),
        })),
      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      // ---- Files ----
      addFile: (file) =>
        set((s) => ({
          files: [
            {
              ...file,
              id: genId("f"),
              createdAt: new Date().toISOString(),
            },
            ...s.files,
          ],
        })),
      deleteFile: (fileId) =>
        set((s) => ({ files: s.files.filter((f) => f.id !== fileId) })),

      // ---- Monday.com integration actions ----
      setMondayConnection: (apiKey, account) =>
        set({
          mondayApiKey: apiKey,
          mondayConnected: !!apiKey,
          mondayAccount: account ?? null,
        }),

      disconnectMonday: () =>
        set({
          mondayApiKey: null,
          mondayConnected: false,
          mondayAccount: null,
        }),

      setImportState: (patch) =>
        set((s) => ({ importState: { ...s.importState, ...patch } })),

      pushImportLog: (type, message) =>
        set((s) => ({
          importState: {
            ...s.importState,
            log: [
              ...s.importState.log,
              { ts: new Date().toLocaleTimeString(), type, message },
            ].slice(-200),
          },
        })),

      resetImportState: () =>
        set({
          importState: {
            active: false,
            currentStep: "",
            message: "",
            current: 0,
            total: 0,
            log: [],
          },
        }),

      // Fusionar datos importados — upsert por ID (no duplica)
      mergeImportedData: (data) =>
        set((s) => {
          const upsert = <T extends { id: string }>(
            existing: T[],
            incoming: T[] | undefined
          ): T[] => {
            if (!incoming || incoming.length === 0) return existing;
            const map = new Map(existing.map((x) => [x.id, x]));
            incoming.forEach((x) => map.set(x.id, x));
            return Array.from(map.values());
          };

          const newBoards = upsert(s.boards, data.boards);
          const newUsers = upsert(s.users, data.users);
          const newTeams = upsert(s.teams, data.teams);
          const newWorkspaces = upsert(s.workspaces, data.workspaces);

          // Actualizar boardIds en workspaces
          const updatedWorkspaces = newWorkspaces.map((w) => ({
            ...w,
            boardIds: newBoards
              .filter((b) => b.workspaceId === w.id)
              .map((b) => b.id),
          }));

          return {
            boards: newBoards,
            users: newUsers,
            teams: newTeams,
            workspaces: updatedWorkspaces,
          };
        }),
    }),
    {
      name: "monday-ai-store",
      version: 3, // bump para forzar refresh con favoritos/recents
      // skipHydration: true evita que zustand/persist intente leer localStorage
      // automáticamente durante el SSR (que causaba errores y memory pressure).
      // El HydrationGate llama manualmente a useAppStore.persist.rehydrate() en
      // el cliente después del montaje.
      skipHydration: true,
      migrate: (persistedState: any, version: number) => {
        // Migrar estado viejo: añadir campos nuevos si no existen
        if (!persistedState) return persistedState;
        if (!persistedState.favoriteBoardIds) persistedState.favoriteBoardIds = [];
        if (!persistedState.recentBoardIds) persistedState.recentBoardIds = [];
        return persistedState;
      },
      // No persistir modal state (siempre arrancan cerrados)
      partialize: (s) => ({
        users: s.users,
        teams: s.teams,
        workspaces: s.workspaces,
        boards: s.boards,
        agents: s.agents,
        executions: s.executions,
        plans: s.plans,
        automations: s.automations,
        updates: s.updates,
        activities: s.activities,
        notifications: s.notifications,
        files: s.files,
        currentUserId: s.currentUserId,
        activeBoardId: s.activeBoardId,
        mondayApiKey: s.mondayApiKey,
        mondayConnected: s.mondayConnected,
        mondayAccount: s.mondayAccount,
        sidekickMessages: s.sidekickMessages,
        sidekickGroqApiKey: s.sidekickGroqApiKey,
        favoriteBoardIds: s.favoriteBoardIds,
        recentBoardIds: s.recentBoardIds,
      }),
      // Hidratación manual: cuando persist termina de leer localStorage,
      // marcamos _hasHydrated = true para que la UI pueda mostrar el splash
      // hasta que los datos reales estén listos (evita el flash de datos seed).
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// ----------------------------------------------------------------------------
// Helpers / selectors — NOT for direct use with useAppStore() (creates new refs)
// Use these as plain functions on already-extracted state inside components.
// ----------------------------------------------------------------------------

export function findActiveBoard(state: AppState): Board | undefined {
  return state.boards.find((b) => b.id === state.activeBoardId);
}

export function findItem(state: AppState, itemId: string | null): Item | undefined {
  if (!itemId) return undefined;
  for (const b of state.boards) {
    const found = b.items.find((i) => i.id === itemId);
    if (found) return found;
  }
  return undefined;
}

// ----------------------------------------------------------------------------
// Hooks de selectores optimizados — evitan re-renders innecesarios.
// En vez de subscribirse a `s.boards` (que cambia en cualquier mutación),
// estos hooks solo se re-renderizan cuando cambia la parte relevante.
// ----------------------------------------------------------------------------
import { useMemo } from "react";

/** Hook que devuelve el board activo. Solo se re-renderiza cuando cambia ese board. */
export function useActiveBoard(): Board | undefined {
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  return useAppStore((s) => s.boards.find((b) => b.id === activeBoardId));
}

/** Hook que devuelve solo el ID del board activo (primitivo, estable). */
export function useActiveBoardId(): string {
  return useAppStore((s) => s.activeBoardId);
}

/** Hook que devuelve los items del board activo. Re-renderiza solo si cambian esos items. */
export function useActiveBoardItems(): Item[] {
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  return useAppStore((s) => {
    const b = s.boards.find((x) => x.id === activeBoardId);
    return b?.items ?? EMPTY_ITEMS;
  });
}

const EMPTY_ITEMS: Item[] = [];

/** Hook que devuelve los workspaces. Estable salvo que cambien. */
export function useWorkspaces() {
  return useAppStore((s) => s.workspaces);
}

/** Hook que devuelve los usuarios. Estable salvo que cambien. */
export function useUsers() {
  return useAppStore((s) => s.users);
}

/** Memoiza un valor derivado de estado sin disparar re-renders extras. */
export function useDerived<T>(selector: (state: AppState) => T): T {
  return useAppStore(selector);
}

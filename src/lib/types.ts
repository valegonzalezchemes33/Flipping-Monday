// ============================================================================
// MONDAY-AI — Tipos del modelo de datos (mapeo 1:1 con Monday.com + extensiones IA)
// ============================================================================

export type BoardKind = "public" | "private" | "shareable";
export type BoardType = "board" | "dashboard";

// 25+ tipos de columna de Monday
export type ColumnType =
  | "text"
  | "long_text"
  | "numbers"
  | "status"
  | "dropdown"
  | "date"
  | "timeline"
  | "people"
  | "email"
  | "phone"
  | "link"
  | "file"
  | "checkbox"
  | "rating"
  | "progress"
  | "formula"
  | "mirror"
  | "auto_number"
  | "created_time"
  | "last_updated"
  | "tags"
  | "time_tracking"
  | "vote"
  | "dependency"
  | "button"
  | "integration"
  | "location"
  | "color_picker"
  | "doc"
  | "priority" // alias visual de status
  | "ai_agent"; // NUEVO — tipo de columna que ejecuta agentes

export type ViewType =
  | "main_table"
  | "kanban"
  | "gantt"
  | "calendar"
  | "workload"
  | "form"
  | "chart"
  | "map"
  | "timeline"
  | "files"
  | "docs";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "member" | "viewer" | "guest";
  color: string; // para avatar fallback
}

export interface Team {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Workspace {
  id: string;
  name: string;
  kind: "open" | "closed";
  description?: string;
  boardIds: string[];
  color?: string;
}

export interface ColumnDef {
  id: string;
  title: string;
  type: ColumnType;
  archived?: boolean;
  width?: number;
  // Para status / dropdown / priority
  labels?: Record<string, { name: string; color: string }>;
  // Para formula
  formula?: string;
  // Para ai_agent
  agentIds?: string[];
  // Para mirror
  mirroredColumnId?: string;
  mirroredBoardId?: string;
  // Para auto_number
  prefix?: string;
  // Para people
  teamIds?: string[];
}

export interface ColumnValue {
  columnId: string;
  // Estructura según el tipo de columna
  // text/long_text/numbers/email/phone/link → { text: string }
  // status/priority/dropdown → { labelId: string }
  // date → { date: string }
  // timeline → { from: string; to: string }
  // people → { userIds: string[] }
  // checkbox → { checked: boolean }
  // rating/progress → { value: number }
  // ai_agent → { lastRunId?: string; lastOutput?: string }
  value: any;
}

export interface Group {
  id: string;
  title: string;
  color: string;
  position: number;
  collapsed?: boolean;
}

export interface Update {
  id: string;
  itemId: string;
  body: string;
  authorId: string;
  createdAt: string;
  replies?: Update[];
  mentionedUserIds?: string[];
  attachments?: { id: string; name: string; size: number; url: string }[];
}

export interface ActivityEvent {
  id: string;
  itemId: string;
  type:
    | "item_created"
    | "item_updated"
    | "column_changed"
    | "status_changed"
    | "assignee_changed"
    | "agent_run"
    | "agent_completed"
    | "agent_failed"
    | "subitem_created"
    | "update_posted"
    | "file_attached"
    | "item_archived";
  data?: Record<string, any>;
  userId?: string;
  agentId?: string;
  createdAt: string;
}

export interface SubItem {
  id: string;
  parentId: string;
  name: string;
  columnValues: ColumnValue[];
  createdAt: string;
}

export interface Item {
  id: string;
  boardId: string;
  groupId: string;
  name: string;
  columnValues: ColumnValue[];
  createdAt: string;
  updatedAt: string;
  position: number;
  archived?: boolean;
  subItems?: SubItem[];
}

export interface BoardView {
  id: string;
  name: string;
  type: ViewType;
  settings?: Record<string, any>;
}

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  boardKind: BoardKind;
  boardType: BoardType;
  columns: ColumnDef[];
  groups: Group[];
  items: Item[];
  views: BoardView[];
  archived?: boolean;
  permissions?: {
    ownerId: string;
    editorIds?: string[];
    viewerIds?: string[];
  };
}

// ============================================================================
// Agentes IA — modelo de datos
// ============================================================================

export type AgentScope = "global" | "board" | "column";
export type AgentTriggerType =
  | "manual"
  | "schedule"
  | "column_change"
  | "item_created"
  | "webhook"
  | "automation";

export interface AgentTool {
  name: string;
  description: string;
  schema: Record<string, any>;
  mcpServer?: string;
  isBuiltIn?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: AgentTool[];
  /**
   * ID del modelo a usar. Puede ser cualquier modelo del MODEL_CATALOG
   * de groq-client.ts. Ejemplos: "glm-4.6", "llama-3.3-70b-versatile",
   * "deepseek-r1-distill-llama-70b", "gpt-4o", "claude-sonnet-5".
   */
  model: string;
  /** Configuración de provider opcional por agente */
  modelConfig?: {
    provider: "zai" | "groq" | "openai" | "anthropic";
    /** Referencia a qué API key usar (nombre del campo en settings) */
    apiKeyRef?: "groqApiKey" | "openaiApiKey" | "anthropicApiKey";
  };
  temperature: number;
  maxTokens: number;
  version: number;
  isActive: boolean;
  createdById: string;
  organizationId: string;
  boardId?: string; // null = global
  columnId?: string; // si scope = column
  scope: AgentScope;
  triggers: AgentTriggerType[];
  schedule?: string; // cron
  icon?: string; // emoji
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentExecution {
  id: string;
  agentId: string;
  itemId?: string;
  triggerType: AgentTriggerType;
  triggerRef?: string;
  input: {
    item?: Item;
    columnValues?: ColumnValue[];
    user?: User;
    board?: Board;
    customContext?: string;
  };
  output?: any;
  status: ExecutionStatus;
  error?: string;
  tokensUsed?: number;
  costUsd?: number;
  startedAt: string;
  completedAt?: string;
  // Para streaming — chunks acumulados
  streamChunks?: string[];
}

export interface PlanStep {
  id: string;
  name: string;
  agentId: string;
  dependsOn: string[];
  condition?: string;
  parallel?: boolean;
  inputMapping?: Record<string, string>; // output key de paso previo → input key
  compensationAction?: string; // rollback
}

export interface OrchestratorPlan {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  steps: PlanStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrchestratorStatus = "running" | "completed" | "failed" | "partial";

export interface StepResult {
  stepId: string;
  agentExecutionId?: string;
  output?: any;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface OrchestratorExecution {
  id: string;
  planId: string;
  triggerItemId?: string;
  status: OrchestratorStatus;
  stepResults: StepResult[];
  currentStep: number;
  startedAt: string;
  completedAt?: string;
}

// ============================================================================
// Automation recipes
// ============================================================================

export type AutomationTriggerKind =
  | "when_status_changes"
  | "when_item_created"
  | "when_column_changes"
  | "when_date_arrives"
  | "when_assignee_changes"
  | "every_day"
  | "every_week"
  | "manual";

export type AutomationActionKind =
  | "create_item"
  | "change_status"
  | "notify"
  | "move_item"
  | "run_agent"
  | "run_orchestrator"
  | "http_request"
  | "create_update"
  | "assign_person"
  | "archive_item";

export interface AutomationRecipe {
  id: string;
  name: string;
  description: string;
  trigger: {
    kind: AutomationTriggerKind;
    config: Record<string, any>;
  };
  conditions: { field: string; operator: string; value: any }[];
  action: {
    kind: AutomationActionKind;
    config: Record<string, any>;
  };
  isActive: boolean;
  boardId?: string;
  createdAt: string;
}

// ============================================================================
// Export/Import — formato Monday v2.0
// ============================================================================

export interface MondayExport {
  version: "2.0";
  exportedAt: string;
  workspace: { id: string; name: string; kind: "open" | "closed" };
  boards: MondayBoardExport[];
  users: { id: string; name: string; email: string }[];
  teams: { id: string; name: string; memberIds: string[] }[];
}

export interface MondayBoardExport {
  id: string;
  name: string;
  description: string;
  boardKind: BoardKind;
  boardType: BoardType;
  columns: {
    id: string;
    title: string;
    type: ColumnType;
    labels?: Record<string, { name: string; color: string }>;
  }[];
  groups: { id: string; title: string; color: string; position: number }[];
  items: {
    id: string;
    name: string;
    groupId: string;
    columnValues: ColumnValue[];
    createdAt: string;
    updatedAt: string;
  }[];
  views: { id: string; name: string; type: ViewType }[];
  automations: {
    id: string;
    name: string;
    trigger: AutomationTriggerKind;
    action: AutomationActionKind;
    isActive: boolean;
  }[];
}

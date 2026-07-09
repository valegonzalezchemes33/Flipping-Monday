// ============================================================================
// AI Automation Recipes — recetas predefinidas como Monday.com
// ============================================================================
// Cada receta tiene: trigger → AI Block → action
// El usuario las activa desde el Automation Center.

import type { AIBlockType } from "./ai-blocks";

export type AutomationTriggerType =
  | "item_created"
  | "status_changed"
  | "column_changed"
  | "deadline_approaching"
  | "item_assigned"
  | "daily"
  | "weekly"
  | "manual";

export type AutomationActionType =
  | "set_column_value"
  | "assign_person"
  | "move_to_group"
  | "set_status"
  | "set_priority"
  | "send_notification"
  | "create_subitem"
  | "create_item"
  | "send_email";

export interface AIAutomationRecipe {
  id: string;
  name: string;
  description: string;
  icon: string;
  trigger: AutomationTriggerType;
  triggerLabel: string;
  aiBlock: AIBlockType;
  aiBlockLabel: string;
  action: AutomationActionType;
  actionLabel: string;
  // Configuración: qué columna usar como input, qué columna como output, etc.
  inputColumn?: string;
  outputColumn?: string;
  // Solo para trigger deadline_approaching: días de anticipación
  daysBefore?: number;
  // Solo para send_notification: mensaje
  notificationMessage?: string;
}

export const AI_AUTOMATION_RECIPES: AIAutomationRecipe[] = [
  {
    id: "recipe-1",
    name: "Auto-categorizar items nuevos",
    description: "Cuando se crea un item, la IA lo categoriza automáticamente",
    icon: "🏷️",
    trigger: "item_created",
    triggerLabel: "Cuando un item se crea",
    aiBlock: "categorize",
    aiBlockLabel: "Categorizar con IA",
    action: "set_column_value",
    actionLabel: "Asignar categoría a la columna",
    inputColumn: "name",
    outputColumn: "category",
  },
  {
    id: "recipe-2",
    name: "Resumir updates automáticamente",
    description: "Cuando se publica un update, la IA genera un resumen",
    icon: "📝",
    trigger: "column_changed",
    triggerLabel: "Cuando se publica un update",
    aiBlock: "summarize",
    aiBlockLabel: "Resumir texto",
    action: "set_column_value",
    actionLabel: "Guardar resumen en columna",
    inputColumn: "updates",
    outputColumn: "summary",
  },
  {
    id: "recipe-3",
    name: "Detectar sentimiento en comentarios",
    description: "Analiza si los updates son positivos/negativos/neutrales",
    icon: "😊",
    trigger: "column_changed",
    triggerLabel: "Cuando se publica un update",
    aiBlock: "sentiment",
    aiBlockLabel: "Analizar sentimiento",
    action: "set_column_value",
    actionLabel: "Asignar sentimiento a columna Status",
    inputColumn: "updates",
    outputColumn: "sentiment",
  },
  {
    id: "recipe-4",
    name: "Priorizar items automáticamente",
    description: "La IA asigna prioridad 1-5 basándose en el contenido",
    icon: "⚡",
    trigger: "item_created",
    triggerLabel: "Cuando un item se crea",
    aiBlock: "prioritize",
    aiBlockLabel: "Calcular prioridad",
    action: "set_column_value",
    actionLabel: "Asignar score a columna Priority",
    inputColumn: "name",
    outputColumn: "priority",
  },
  {
    id: "recipe-5",
    name: "Alerta de deadline cercano",
    description: "Cuando un deadline está a 3 días, la IA sugiere acciones",
    icon: "⏰",
    trigger: "deadline_approaching",
    triggerLabel: "Cuando un deadline está a 3 días",
    aiBlock: "suggest_actions",
    aiBlockLabel: "Sugerir acciones",
    action: "send_notification",
    actionLabel: "Notificar al asignado con sugerencias",
    daysBefore: 3,
    notificationMessage: "Deadline cercano. Acciones sugeridas por IA:",
  },
  {
    id: "recipe-6",
    name: "Extraer datos de emails",
    description: "Extrae email, teléfono, fecha de items creados desde email",
    icon: "📧",
    trigger: "item_created",
    triggerLabel: "Cuando un item se crea (desde email)",
    aiBlock: "extract_info",
    aiBlockLabel: "Extraer información",
    action: "set_column_value",
    actionLabel: "Rellenar columnas con datos extraídos",
    inputColumn: "email_body",
    outputColumn: "extracted_data",
  },
  {
    id: "recipe-7",
    name: "Auto-asignar persona",
    description: "La IA sugiere a quién asignar el item basándose en el contenido",
    icon: "👤",
    trigger: "item_created",
    triggerLabel: "Cuando un item se crea",
    aiBlock: "assign_people",
    aiBlockLabel: "Sugerir persona",
    action: "assign_person",
    actionLabel: "Asignar a la persona sugerida",
    inputColumn: "name",
    outputColumn: "owner",
  },
  {
    id: "recipe-8",
    name: "Mejorar texto de updates",
    description: "Cuando se publica un update, la IA lo mejora automáticamente",
    icon: "✨",
    trigger: "column_changed",
    triggerLabel: "Cuando se publica un update",
    aiBlock: "improve_text",
    aiBlockLabel: "Mejorar texto",
    action: "set_column_value",
    actionLabel: "Reemplazar con versión mejorada",
    inputColumn: "updates",
    outputColumn: "improved_text",
  },
  {
    id: "recipe-9",
    name: "Traducir items automáticamente",
    description: "Traduce el nombre del item al inglés",
    icon: "🌐",
    trigger: "item_created",
    triggerLabel: "Cuando un item se crea",
    aiBlock: "translate",
    aiBlockLabel: "Traducir al inglés",
    action: "set_column_value",
    actionLabel: "Guardar traducción en columna",
    inputColumn: "name",
    outputColumn: "english_name",
  },
  {
    id: "recipe-10",
    name: "Mover items por sentimiento",
    description: "Si el sentimiento es negativo, mueve a grupo 'Urgente'",
    icon: "🚨",
    trigger: "column_changed",
    triggerLabel: "Cuando cambia el sentimiento",
    aiBlock: "sentiment",
    aiBlockLabel: "Analizar sentimiento",
    action: "move_to_group",
    actionLabel: "Mover a 'Urgente' si es negativo",
    inputColumn: "updates",
    outputColumn: "sentiment",
  },
  {
    id: "recipe-11",
    name: "Sugerir acciones para items atascados",
    description: "Cuando un item lleva mucho tiempo en 'Stuck', sugiere acciones",
    icon: "🆘",
    trigger: "status_changed",
    triggerLabel: "Cuando status cambia a 'Stuck'",
    aiBlock: "suggest_actions",
    aiBlockLabel: "Sugerir acciones",
    action: "send_notification",
    actionLabel: "Notificar al equipo con sugerencias",
    notificationMessage: "Item atascado. Acciones sugeridas:",
  },
  {
    id: "recipe-12",
    name: "Reporte semanal con IA",
    description: "Cada lunes, la IA genera un resumen de la semana",
    icon: "📊",
    trigger: "weekly",
    triggerLabel: "Cada lunes a las 9am",
    aiBlock: "summarize",
    aiBlockLabel: "Generar resumen semanal",
    action: "send_notification",
    actionLabel: "Enviar reporte al equipo",
    notificationMessage: "📊 Reporte semanal generado por IA:",
  },
];

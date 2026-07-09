// ============================================================================
// AI Automation Executor — ejecuta recetas cuando se disparan los triggers
// ============================================================================
// Este hook se subscribe al store y ejecuta las AI Automations activas
// cuando se cumplen las condiciones del trigger.

"use client";
import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { executeAIBlock } from "@/lib/ai-blocks";
import type { AIAutomationRecipe } from "@/lib/ai-automation-recipes";

export function useAIAutomations() {
  const automations = useAppStore((s) => s.automations);
  const groqApiKey = useAppStore((s) => s.sidekickGroqApiKey);

  // Track de items ya procesados por cada automation (evita loops)
  const processedRef = useRef<Map<string, Set<string>>>(new Map());

  // Fingerprint del estado de items (solo cambia en create/update/delete)
  const itemsFingerprint = useAppStore((s) => {
    // Early return si no hay automations activas con AI
    const hasAiAutomations = s.automations.some(
      (a) => a.isActive && (a as any).aiBlock
    );
    if (!hasAiAutomations) return "noop";

    let fp = "";
    for (const b of s.boards) {
      for (const i of b.items) {
        fp += `${i.id}|${i.updatedAt}|${i.groupId};`;
      }
    }
    return fp;
  });

  useEffect(() => {
    if (itemsFingerprint === "noop") return;

    const state = useAppStore.getState();
    const activeAutomations = state.automations.filter(
      (a) => a.isActive && (a as any).aiBlock
    );

    if (activeAutomations.length === 0) return;

    // Procesar cada automation activa
    for (const automation of activeAutomations) {
      const recipe = automation as any as AIAutomationRecipe & { id: string };
      const processedKey = recipe.id || recipe.name;
      if (!processedRef.current.has(processedKey)) {
        processedRef.current.set(processedKey, new Set());
      }
      const processed = processedRef.current.get(processedKey)!;

      for (const board of state.boards) {
        for (const item of board.items) {
          // Skip si ya procesamos este item con esta automation
          if (processed.has(item.id)) continue;

          // Verificar trigger condition
          const shouldTrigger = checkTrigger(recipe, item, board, state);
          if (!shouldTrigger) continue;

          // Marcar como procesado ANTES de ejecutar (evita re-trigger)
          processed.add(item.id);

          // Ejecutar AI Automation async
          executeAutomation(recipe, item, board, state, groqApiKey);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsFingerprint, automations, groqApiKey]);
}

// ----------------------------------------------------------------------------
// Verificar si el trigger de la receta se cumple para este item
// ----------------------------------------------------------------------------
function checkTrigger(
  recipe: AIAutomationRecipe,
  item: any,
  board: any,
  state: any
): boolean {
  switch (recipe.trigger) {
    case "item_created": {
      // Solo items creados en los últimos 60 segundos
      const createdAt = new Date(item.createdAt).getTime();
      return Date.now() - createdAt < 60000;
    }

    case "status_changed": {
      // Si el status es "Stuck" (labelId "2")
      const statusCv = item.columnValues.find(
        (cv: any) => cv.columnId === "status"
      );
      return statusCv?.value?.labelId === "2";
    }

    case "deadline_approaching": {
      const dateCv = item.columnValues.find(
        (cv: any) => cv.columnId === "deadline"
      );
      if (!dateCv?.value?.date) return false;
      const deadline = new Date(dateCv.value.date).getTime();
      const days = (deadline - Date.now()) / 86400000;
      return days >= 0 && days <= (recipe.daysBefore ?? 3);
    }

    case "item_assigned": {
      const ownerCv = item.columnValues.find(
        (cv: any) => cv.columnId === "owner"
      );
      return (ownerCv?.value?.userIds?.length ?? 0) > 0;
    }

    default:
      return false;
  }
}

// ----------------------------------------------------------------------------
// Ejecutar la AI Automation: AI Block + Action
// ----------------------------------------------------------------------------
async function executeAutomation(
  recipe: AIAutomationRecipe,
  item: any,
  board: any,
  state: any,
  groqApiKey?: string | null
) {
  try {
    // 1. Obtener el texto de input desde la columna configurada
    const inputText = getInputText(recipe, item, board, state);
    if (!inputText || inputText.length < 3) return;

    // 2. Para assign_people: pasar la lista de usuarios como options
    const options =
      recipe.aiBlock === "assign_people" || recipe.aiBlock === "categorize" || recipe.aiBlock === "assign_labels"
        ? recipe.aiBlock === "assign_people"
          ? state.users.map((u: any) => u.name)
          : getLabelOptions(board, recipe.outputColumn)
        : undefined;

    // 3. Ejecutar AI Block
    const result = await executeAIBlock(
      recipe.aiBlock,
      {
        text: inputText,
        options,
        targetLanguage: recipe.aiBlock === "translate" ? "english" : undefined,
        context: `Board: ${board.name}, Item: ${item.name}`,
      },
      { groqApiKey: groqApiKey ?? undefined }
    );

    if (!result.success) {
      console.error(`[AI Automation] ${recipe.name} falló:`, result.error);
      return;
    }

    // 4. Ejecutar la acción con el output del AI Block
    executeAction(recipe, result, item, board, state);
  } catch (err) {
    console.error(`[AI Automation] Error ejecutando ${recipe.name}:`, err);
  }
}

// ----------------------------------------------------------------------------
// Obtener el texto de input desde la columna configurada
// ----------------------------------------------------------------------------
function getInputText(
  recipe: AIAutomationRecipe,
  item: any,
  board: any,
  state: any
): string {
  const colId = recipe.inputColumn ?? "name";

  if (colId === "name") return item.name;

  if (colId === "updates") {
    const updates = state.updates?.filter((u: any) => u.itemId === item.id) ?? [];
    return updates.map((u: any) => u.body).join("\n");
  }

  const cv = item.columnValues.find((x: any) => x.columnId === colId);
  return cv?.value?.text ?? cv?.value?.labelId ?? "";
}

// ----------------------------------------------------------------------------
// Obtener labels de una columna status/priority
// ----------------------------------------------------------------------------
function getLabelOptions(board: any, colId?: string): string[] {
  if (!colId) return [];
  const col = board.columns.find((c: any) => c.id === colId || c.title.toLowerCase() === colId.toLowerCase());
  if (!col?.labels) return [];
  return Object.values(col.labels).map((l: any) => l.name);
}

// ----------------------------------------------------------------------------
// Ejecutar la acción de la automation
// ----------------------------------------------------------------------------
function executeAction(
  recipe: AIAutomationRecipe,
  aiResult: any,
  item: any,
  board: any,
  state: any
) {
  const store = useAppStore.getState();
  const outputValue = aiResult.selectedOption || aiResult.output || aiResult.sentiment || "";

  switch (recipe.action) {
    case "set_column_value": {
      // Mapear el output a un labelId si la columna es status/priority
      const col = board.columns.find(
        (c: any) =>
          c.id === recipe.outputColumn ||
          c.title.toLowerCase() === (recipe.outputColumn ?? "").toLowerCase()
      );

      if (col?.type === "status" || col?.type === "priority") {
        // Buscar el labelId cuyo name coincida con el output
        const labelEntry = Object.entries(col.labels ?? {}).find(
          ([, label]: [string, any]) =>
            label.name.toLowerCase() === String(outputValue).toLowerCase()
        );
        if (labelEntry) {
          store.updateColumnValue(item.id, col.id, { labelId: labelEntry[0] });
        }
      } else if (col?.type === "numbers") {
        store.updateColumnValue(item.id, col.id, {
          text: String(aiResult.priorityScore ?? outputValue),
        });
      } else {
        store.updateColumnValue(item.id, col?.id ?? recipe.outputColumn ?? "", {
          text: outputValue,
        });
      }
      break;
    }

    case "assign_person": {
      const user = state.users.find(
        (u: any) => u.name.toLowerCase() === String(outputValue).toLowerCase()
      );
      if (user) {
        store.updateColumnValue(item.id, "owner", { userIds: [user.id] });
      }
      break;
    }

    case "move_to_group": {
      if (aiResult.sentiment === "negative") {
        const urgentGroup = board.groups.find((g: any) =>
          g.title.toLowerCase().includes("urgente") ||
          g.title.toLowerCase().includes("urgent")
        );
        if (urgentGroup) {
          store.moveItem(item.id, urgentGroup.id);
        }
      }
      break;
    }

    case "set_status": {
      if (aiResult.sentiment) {
        const labelMap: Record<string, string> = {
          positive: "1", // Done
          negative: "2", // Stuck
          neutral: "0", // Working on it
        };
        store.updateColumnValue(item.id, "status", {
          labelId: labelMap[aiResult.sentiment] ?? "0",
        });
      }
      break;
    }

    case "send_notification": {
      store.pushNotification({
        type: "automation",
        title: `🤖 ${recipe.name}`,
        body: `${recipe.notificationMessage ?? ""} ${outputValue.slice(0, 200)}`,
        itemId: item.id,
      });
      break;
    }

    case "create_subitem": {
      store.addSubitem(item.id, `AI: ${outputValue.slice(0, 50)}`);
      break;
    }
  }
}

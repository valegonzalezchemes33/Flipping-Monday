"use client";
// ============================================================================
// useAgentTriggers — watcher que dispara agentes automáticamente cuando:
// 1. Un item se crea (trigger: item_created)
// 2. Una columna cambia (trigger: column_change)
// 3. Columnas AI con autoFill se rellenan automáticamente
// ============================================================================
// OPTIMIZACIÓN: solo se subscribe a un "fingerprint" del estado relevante
// (cantidad de items + último updatedAt) en vez de a TODO el array de boards.
// Esto evita que el hook se ejecute en cada keystroke de edición inline.
import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useAgentExecution } from "@/hooks/use-agent-execution";
import type { Agent, Board, Item } from "@/lib/types";

export function useAgentTriggers() {
  // Solo escuchar agents — si no hay agentes activos, no hay nada que hacer
  const agents = useAppStore((s) => s.agents);

  // Fingerprint compacto del estado de items: solo cambia cuando se
  // crea/elimina un item o cambia su updatedAt. NO cambia en edición
  // inline de texto (que solo actualiza columnValues).
  // Esto reduce drásticamente las re-ejecuciones del effect.
  const itemsFingerprint = useAppStore((s) => {
    // Early return: si no hay agentes con triggers item_created/column_change
    // ni columnas AI con autoFill, no hace falta computar el fingerprint
    const hasTriggerAgents = s.agents.some(
      (a) => a.isActive && (a.triggers.includes("item_created" as any) || a.triggers.includes("column_change" as any))
    );
    const hasAiColumns = s.boards.some(
      (b) => b.columns.some((c) => c.type === "ai_agent" && c.agentIds && c.agentIds.length > 0)
    );
    if (!hasTriggerAgents && !hasAiColumns) return "noop";

    // Fingerprint: por cada board, item.id + updatedAt
    let fp = "";
    for (const b of s.boards) {
      for (const i of b.items) {
        fp += `${i.id}|${i.updatedAt};`;
      }
    }
    return fp;
  });

  const { runAgent } = useAgentExecution();

  // Track de items ya procesados para evitar loops
  const processedItemsRef = useRef<Set<string>>(new Set());
  // Track de la última versión de cada item para detectar cambios
  const itemVersionsRef = useRef<Map<string, string>>(new Map());
  // Track de ejecuciones en curso para no duplicar
  const runningAgentsRef = useRef<Set<string>>(new Set());
  // Track de auto-fills ya intentados para evitar loop infinito
  // (auto-fill actualiza item.updatedAt → fingerprint cambia → re-dispara)
  const autoFilledRef = useRef<Set<string>>(new Set());

  // Memoizar funciones helpers para que sean estables entre renders
  const triggerAgentsForItem = useRef<(item: Item, board: Board, triggerType: string) => void>();
  const runAutoFillAgent = useRef<(agent: Agent, item: Item, columnId: string) => Promise<void>>();

  useEffect(() => {
    // Si no hay agentes activos, no hacer nada
    if (itemsFingerprint === "noop") return;
    if (agents.length === 0 || !agents.some((a) => a.isActive)) return;

    const state = useAppStore.getState();
    const boards = state.boards;

    // ---- 1. DETECTAR ITEMS NUEVOS (trigger: item_created) ----
    for (const board of boards) {
      for (const item of board.items) {
        const version = `${item.id}-${item.updatedAt}`;
        const prevVersion = itemVersionsRef.current.get(item.id);

        if (!prevVersion) {
          // Item nuevo (o primera carga) — registrar versión
          itemVersionsRef.current.set(item.id, version);

          // Si no fue procesado antes, disparar agentes con trigger item_created
          if (!processedItemsRef.current.has(item.id)) {
            processedItemsRef.current.add(item.id);
            // Solo disparar si el item fue creado recientemente (últimos 30 segundos)
            const createdAt = new Date(item.createdAt).getTime();
            const isRecent = Date.now() - createdAt < 30000;
            if (isRecent && triggerAgentsForItem.current) {
              triggerAgentsForItem.current(item, board, "item_created");
            }
          }
          continue;
        }

        // ---- 2. DETECTAR CAMBIOS DE COLUMNA (trigger: column_change) ----
        if (prevVersion !== version) {
          itemVersionsRef.current.set(item.id, version);
          // Disparar agentes con trigger column_change
          if (triggerAgentsForItem.current) {
            triggerAgentsForItem.current(item, board, "column_change");
          }
        }
      }
    }

    // ---- 3. AUTO-FILL DE COLUMNAS AI ----
    for (const board of boards) {
      const aiColumns = board.columns.filter((c) => c.type === "ai_agent" && c.agentIds && c.agentIds.length > 0);
      if (aiColumns.length === 0) continue;

      for (const item of board.items) {
        for (const aiCol of aiColumns) {
          const cv = item.columnValues.find((v) => v.columnId === aiCol.id);
          // Si la columna AI no tiene output y el item tiene datos, ejecutar el agente.
          const fillKey = `${item.id}-${aiCol.id}`;
          if (!cv?.value?.lastOutput && !runningAgentsRef.current.has(fillKey) && !autoFilledRef.current.has(fillKey)) {
            // Verificar que el item tenga al menos un nombre
            if (item.name && item.name.trim()) {
              const agent = agents.find((a) => a.id === aiCol.agentIds?.[0]);
              if (agent && agent.isActive && runAutoFillAgent.current) {
                // Solo auto-ejecutar si el item fue creado/modificado recientemente
                const updatedAt = new Date(item.updatedAt).getTime();
                const isRecent = Date.now() - updatedAt < 30000;
                if (isRecent) {
                  autoFilledRef.current.add(fillKey);
                  runAutoFillAgent.current(agent, item, aiCol.id);
                }
              }
            }
          }
        }
      }
    }
  }, [itemsFingerprint, agents, runAgent]);

  // ---- Helper: disparar agentes para un item según trigger type ----
  triggerAgentsForItem.current = (item: Item, board: Board, triggerType: string) => {
    const matchingAgents = agents.filter(
      (a) =>
        a.isActive &&
        a.triggers.includes(triggerType as any) &&
        (a.scope === "global" || a.boardId === board.id)
    );

    for (const agent of matchingAgents) {
      const key = `${item.id}-${agent.id}-${triggerType}`;
      if (runningAgentsRef.current.has(key)) continue;
      runningAgentsRef.current.add(key);

      // Ejecutar con pequeño delay para no saturar
      setTimeout(async () => {
        try {
          await runAgent(agent, item, `Trigger: ${triggerType}`);
        } catch (e) {
          // silent fail
        } finally {
          runningAgentsRef.current.delete(key);
        }
      }, 500);
    }
  };

  // ---- Helper: auto-fill de columna AI ----
  runAutoFillAgent.current = async (agent: Agent, item: Item, columnId: string) => {
    const key = `${item.id}-${columnId}`;
    if (runningAgentsRef.current.has(key)) return;
    runningAgentsRef.current.add(key);

    try {
      const execId = await runAgent(agent, item, "Auto-fill");
      if (execId) {
        const exec = useAppStore.getState().executions.find((e) => e.id === execId);
        if (exec?.output) {
          const outStr =
            typeof exec.output === "string"
              ? exec.output
              : JSON.stringify(exec.output);
          useAppStore.getState().updateColumnValue(item.id, columnId, {
            lastRunId: execId,
            lastOutput: outStr.slice(0, 200),
          });
        }
      }
    } catch (e) {
      // silent fail
    } finally {
      runningAgentsRef.current.delete(key);
    }
  };
}

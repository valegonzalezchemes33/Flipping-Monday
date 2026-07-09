"use client";
// ============================================================================
// useAgentTriggers — watcher que dispara agentes automáticamente cuando:
// 1. Un item se crea (trigger: item_created)
// 2. Una columna cambia (trigger: column_change)
// 3. Columnas AI con autoFill se rellenan automáticamente
// ============================================================================
import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useAgentExecution } from "@/hooks/use-agent-execution";
import type { Agent, Board, Item } from "@/lib/types";

export function useAgentTriggers() {
  const boards = useAppStore((s) => s.boards);
  const agents = useAppStore((s) => s.agents);
  const executions = useAppStore((s) => s.executions);
  const { runAgent } = useAgentExecution();

  // Track de items ya procesados para evitar loops
  const processedItemsRef = useRef<Set<string>>(new Set());
  // Track de la última versión de cada item para detectar cambios
  const itemVersionsRef = useRef<Map<string, string>>(new Map());
  // Track de ejecuciones en curso para no duplicar
  const runningAgentsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
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
            if (isRecent) {
              triggerAgentsForItem(item, board, "item_created");
            }
          }
          continue;
        }

        // ---- 2. DETECTAR CAMBIOS DE COLUMNA (trigger: column_change) ----
        if (prevVersion !== version) {
          itemVersionsRef.current.set(item.id, version);
          // Disparar agentes con trigger column_change
          triggerAgentsForItem(item, board, "column_change");
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
          // Si la columna AI no tiene output y el item tiene datos, ejecutar el agente
          if (!cv?.value?.lastOutput && !runningAgentsRef.current.has(`${item.id}-${aiCol.id}`)) {
            // Verificar que el item tenga al menos un nombre
            if (item.name && item.name.trim()) {
              const agent = agents.find((a) => a.id === aiCol.agentIds?.[0]);
              if (agent && agent.isActive) {
                // Solo auto-ejecutar si el item fue creado/modificado recientemente
                const updatedAt = new Date(item.updatedAt).getTime();
                const isRecent = Date.now() - updatedAt < 30000;
                if (isRecent) {
                  runAutoFillAgent(agent, item, aiCol.id);
                }
              }
            }
          }
        }
      }
    }
  }, [boards, agents, executions]);

  // ---- Helper: disparar agentes para un item según trigger type ----
  const triggerAgentsForItem = (item: Item, board: Board, triggerType: string) => {
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
      // FIX: cooldown de 60s para evitar loop infinito
      // (agente escribe al item → updatedAt cambia → re-dispara trigger)
      setTimeout(() => runningAgentsRef.current.delete(key), 60000);

      // Ejecutar con pequeño delay para no saturar
      setTimeout(async () => {
        try {
          await runAgent(agent, item, `Trigger: ${triggerType}`);
        } catch (e) {
          // silent fail
        }
        // FIX: NO borrar el key aquí — el cooldown de 60s del setTimeout
        // de arriba es el que lo elimina. Si lo borramos aquí, el trigger
        // se puede re-disparar inmediatamente tras completar el agente.
      }, 500);
    }
  };

  // ---- Helper: auto-fill de columna AI ----
  const runAutoFillAgent = async (agent: Agent, item: Item, columnId: string) => {
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

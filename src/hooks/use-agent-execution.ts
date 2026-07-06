"use client";
// ============================================================================
// Hook useAgentExecution — ejecuta un agente via SSE streaming
// ============================================================================
import { useCallback, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Agent, AgentExecution, Item } from "@/lib/types";

export function useAgentExecution() {
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});

  const addExecution = useAppStore((s) => s.addExecution);
  const updateExecution = useAppStore((s) => s.updateExecution);
  const appendStreamChunk = useAppStore((s) => s.appendStreamChunk);
  const addUpdate = useAppStore((s) => s.addUpdate);
  const users = useAppStore((s) => s.users);
  const currentUser = useAppStore((s) => s.currentUserId);
  const nvidiaApiKey = useAppStore((s) => s.settings?.nvidiaApiKey || "");

  const runAgent = useCallback(
    async (
      agent: Agent,
      item?: Item,
      customContext?: string
    ): Promise<string | null> => {
      const execId = `ex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setRunning((r) => ({ ...r, [execId]: true }));

      const controller = new AbortController();
      abortControllers.current[execId] = controller;

      // Construir user prompt con variables
      const ctx = {
        item: item
          ? { name: item.name, columnValues: item.columnValues }
          : null,
        user: users.find((u) => u.id === currentUser),
        customContext: customContext ?? "",
        timestamp: new Date().toISOString(),
      };
      const userPrompt = `Contexto del item:
${JSON.stringify(ctx, null, 2)}

Instrucciones del agente: ${agent.description}

Devuelve tu respuesta siguiendo el system prompt. Si pides JSON, devuelve solo JSON válido.`;

      const execution: AgentExecution = {
        id: execId,
        agentId: agent.id,
        itemId: item?.id,
        triggerType: "manual",
        input: { item, customContext },
        status: "running",
        startedAt: new Date().toISOString(),
        streamChunks: [],
      };
      addExecution(execution);

      try {
        const res = await fetch("/api/agent/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: agent.id,
            agentName: agent.name,
            systemPrompt: agent.systemPrompt,
            model: agent.model,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            userPrompt,
            itemId: item?.id,
            groqApiKey: nvidiaApiKey || undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullOutput = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evtBlock of events) {
            const lines = evtBlock.split("\n");
            let event = "message";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data += line.slice(5).trim();
            }
            try {
              const parsed = JSON.parse(data);
              if (event === "chunk" && parsed.text) {
                fullOutput += parsed.text;
                appendStreamChunk(execId, parsed.text);
              } else if (event === "done") {
                fullOutput = parsed.fullOutput ?? fullOutput;
                const tokens = parsed.tokensUsed ?? Math.ceil(fullOutput.length / 4);
                updateExecution(execId, {
                  status: "completed",
                  completedAt: parsed.completedAt ?? new Date().toISOString(),
                  output: tryParse(fullOutput) ?? fullOutput,
                  tokensUsed: tokens,
                  costUsd: Number((tokens * 0.00001).toFixed(4)),
                });
                // Si hay item, escribir update automático y mapear a columna AI
                if (item) {
                  const summary =
                    typeof fullOutput === "string" && fullOutput.length > 280
                      ? fullOutput.slice(0, 280) + "…"
                      : fullOutput;
                  addUpdate(
                    item.id,
                    `🤖 **${agent.name}** ejecutado. Output:\n\n${summary}`
                  );
                  // Mapear a columna ai_agent (la primera que tenga este agente)
                  // Lo hacemos en el componente caller si lo desea, aquí solo guardamos output
                }
              } else if (event === "error") {
                updateExecution(execId, {
                  status: "failed",
                  error: parsed.message,
                  completedAt: new Date().toISOString(),
                });
              }
            } catch {
              /* ignore parse */
            }
          }
        }
        setRunning((r) => ({ ...r, [execId]: false }));
        return execId;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          updateExecution(execId, {
            status: "cancelled",
            completedAt: new Date().toISOString(),
            error: "Cancelado por el usuario",
          });
        } else {
          updateExecution(execId, {
            status: "failed",
            error: err?.message ?? "Error de red",
            completedAt: new Date().toISOString(),
          });
        }
        setRunning((r) => ({ ...r, [execId]: false }));
        return execId;
      }
    },
    [addExecution, updateExecution, appendStreamChunk, addUpdate, users, currentUser, nvidiaApiKey]
  );

  const cancel = useCallback((execId: string) => {
    abortControllers.current[execId]?.abort();
  }, []);

  return { runAgent, cancel, running };
}

function tryParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

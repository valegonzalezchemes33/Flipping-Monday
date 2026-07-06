"use client";
// ============================================================================
// AgentPanel — panel de agentes IA en el Item Detail Drawer
// ============================================================================
import { useState, useMemo } from "react";
import { useAppStore, findItem } from "@/lib/store";
import type { Agent, AgentExecution } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MODEL_CATALOG } from "@/lib/model-catalog";
import {
  Play,
  Loader2,
  Settings2,
  Plus,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Bot,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
} from "lucide-react";
import { useAgentExecution } from "@/hooks/use-agent-execution";

export function AgentPanel({ itemId }: { itemId: string }) {
  const boards = useAppStore((s) => s.boards);
  const allAgents = useAppStore((s) => s.agents);
  const allExecutions = useAppStore((s) => s.executions);
  const setShowAgentBuilder = useAppStore((s) => s.setShowAgentBuilder);

  const item = useMemo(
    () => findItem({ boards } as any, itemId),
    [boards, itemId]
  );
  const board = useMemo(
    () => boards.find((b) => b.id === item?.boardId),
    [boards, item]
  );
  const agents = useMemo(
    () =>
      allAgents.filter(
        (a) =>
          a.isActive &&
          (a.scope === "global" || a.boardId === item?.boardId)
      ),
    [allAgents, item]
  );
  const executions = useMemo(
    () => allExecutions.filter((e) => e.itemId === itemId),
    [allExecutions, itemId]
  );

  const { runAgent, running } = useAgentExecution();
  const [customContext, setCustomContext] = useState("");
  const [expandedExec, setExpandedExec] = useState<string | null>(null);

  if (!item) return null;

  const handleRun = async (agent: Agent) => {
    await runAgent(agent, item, customContext);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-[#0072E5]/5 to-transparent">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-md bg-[#0072E5] flex items-center justify-center text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Agentes IA</div>
            <div className="text-[10px] text-muted-foreground">
              {agents.length} disponibles · {executions.length} ejecuciones en este item
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Custom context */}
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 block">
            Contexto adicional (opcional)
          </label>
          <Textarea
            value={customContext}
            onChange={(e) => setCustomContext(e.target.value)}
            placeholder="Instrucciones extra para el agente: 'prioriza el valor ARR', 'considera Q4 fiscal', etc."
            className="text-xs min-h-[60px] resize-none"
          />
        </div>

        {/* Agents list */}
        <div>
          <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
            Agentes disponibles para este board
          </div>
          <div className="space-y-2">
            {agents.length === 0 && (
              <div className="text-xs text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-lg">
                Sin agentes configurados.
              </div>
            )}
            {agents.map((agent) => {
              const agentExecs = executions.filter((e) => e.agentId === agent.id);
              const isAnyRunning = agentExecs.some(
                (e) => e.status === "running" && Object.values(running).some(Boolean)
              );
              return (
                <div
                  key={agent.id}
                  className="border border-border rounded-lg p-3 hover:border-[#0072E5]/40 hover:shadow-sm transition group bg-card"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 ring-1 ring-black/5"
                      style={{ background: `${agent.color}18` }}
                    >
                      {agent.icon ?? "🤖"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold truncate">
                          {agent.name}
                        </span>
                        {agent.scope === "global" && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1 font-medium">
                            global
                          </Badge>
                        )}
                        {/* Model badge con color de provider */}
                        {(() => {
                          const info = MODEL_CATALOG.find(m => m.id === agent.model);
                          const providerColors: Record<string,string> = {
                            nvidia: "#76B900",
                          };
                          const color = info ? (providerColors[info.provider] ?? "#888") : "#888";
                          const label = info?.name ?? agent.model;
                          const speedIcon = info?.speed === "fast" ? "⚡" : info?.speed === "slow" ? "🧠" : "";
                          return (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                              style={{ background: `${color}18`, color }}
                              title={info?.description}
                            >
                              {speedIcon}{label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                        {agent.description}
                      </div>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {agent.triggers.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded font-medium"
                          >
                            {t.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-[#0072E5] hover:bg-[#0058B5] text-white font-medium shadow-sm"
                        onClick={() => handleRun(agent)}
                        disabled={isAnyRunning}
                      >
                        {isAnyRunning ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 mr-1" />
                        )}
                        Ejecutar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-muted-foreground"
                        onClick={() => setShowAgentBuilder(true)}
                      >
                        <Settings2 className="h-3 w-3 mr-1" />
                        Config
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs border-dashed"
              onClick={() => setShowAgentBuilder(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Crear agente personalizado
            </Button>
          </div>
        </div>

        {/* Execution history */}
        {executions.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
              Historial de ejecuciones
            </div>
            <div className="space-y-2">
              {executions.map((exec) => {
                const agent = agents.find((a) => a.id === exec.agentId);
                const isExpanded = expandedExec === exec.id;
                return (
                  <div
                    key={exec.id}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedExec(isExpanded ? null : exec.id)
                      }
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/40 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-base">{agent?.icon ?? "🤖"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {agent?.name ?? "Agente"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(exec.startedAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </div>
                      </div>
                      <ExecStatusBadge status={exec.status} />
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-border bg-secondary/20">
                        <ExecutionDetail exec={exec} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
function ExecStatusBadge({ status }: { status: AgentExecution["status"] }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-[#00C875] hover:bg-[#00C875] text-white text-[9px] h-5 gap-0.5">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Completado
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-[#E2445C] hover:bg-[#E2445C] text-white text-[9px] h-5 gap-0.5">
          <AlertCircle className="h-2.5 w-2.5" />
          Falló
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-[#0072E5] hover:bg-[#0072E5] text-white text-[9px] h-5 gap-0.5 pulse-ring">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Ejecutando…
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="secondary" className="text-[9px] h-5 gap-0.5">
          <X className="h-2.5 w-2.5" />
          Cancelado
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[9px] h-5 gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          Pendiente
        </Badge>
      );
  }
}

// ----------------------------------------------------------------------------
function ExecutionDetail({ exec }: { exec: AgentExecution }) {
  const allAgents = useAppStore((s) => s.agents);
  const agent = useMemo(
    () => allAgents.find((a) => a.id === exec.agentId),
    [allAgents, exec.agentId]
  );
  const chunks = exec.streamChunks ?? [];
  const isRunning = exec.status === "running";

  const visibleText = chunks.join("");
  const duration =
    exec.completedAt && exec.startedAt
      ? Math.round(
          (new Date(exec.completedAt).getTime() -
            new Date(exec.startedAt).getTime()) /
            100
        ) / 10
      : null;

  return (
    <div className="space-y-2">
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" />
          {agent?.model ?? "?"}
        </span>
        {exec.tokensUsed && (
          <span className="flex items-center gap-1">
            <Coins className="h-2.5 w-2.5" />
            {exec.tokensUsed} tokens
          </span>
        )}
        {exec.costUsd !== undefined && (
          <span className="flex items-center gap-1">
            <Coins className="h-2.5 w-2.5" />${exec.costUsd.toFixed(4)}
          </span>
        )}
        {duration !== null && (
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {duration}s
          </span>
        )}
      </div>

      {/* Output streaming */}
      <div className="bg-card border border-border rounded-md p-2.5">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5">
          Output {isRunning && "(streaming)"}
        </div>
        <pre
          className={cn(
            "text-[11px] font-mono whitespace-pre-wrap break-words text-foreground",
            isRunning && "cursor-blink"
          )}
        >
          {visibleText || (isRunning ? "Esperando respuesta…" : "Sin output.")}
        </pre>
      </div>

      {/* Input */}
      <details className="text-[10px]">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Ver input enviado
        </summary>
        <pre className="mt-1 bg-secondary/60 rounded p-2 text-[10px] font-mono overflow-x-auto">
          {JSON.stringify(exec.input, null, 2)}
        </pre>
      </details>

      {exec.error && (
        <div className="bg-[#E2445C]/10 border border-[#E2445C]/30 rounded-md p-2 text-[11px] text-[#E2445C]">
          {exec.error}
        </div>
      )}
    </div>
  );
}

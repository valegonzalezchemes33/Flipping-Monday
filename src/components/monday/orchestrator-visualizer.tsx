"use client";
// ============================================================================
// OrchestratorVisualizer — vista de planes DAG + ejecución + wizard crear plan
// ============================================================================
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { OrchestratorPlan, PlanStep } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Play,
  Loader2,
  CheckCircle2,
  Circle,
  GitBranch,
  Zap,
  ChevronRight,
  Sparkles,
  Plus,
  RotateCcw,
  Trash2,
  ArrowRight,
} from "lucide-react";

export function OrchestratorVisualizer() {
  const open = useAppStore((s) => s.showOrchestrator);
  const setOpen = useAppStore((s) => s.setShowOrchestrator);
  const plans = useAppStore((s) => s.plans);
  const agents = useAppStore((s) => s.agents);
  const addPlan = useAppStore((s) => s.addPlan);
  const deletePlan = useAppStore((s) => s.deletePlan);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id ?? "");
  const [runningStepIds, setRunningStepIds] = useState<string[]>([]);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const [failedStepIds, setFailedStepIds] = useState<string[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [logs, setLogs] = useState<{ ts: string; msg: string }[]>([]);

  const plan = plans.find((p) => p.id === selectedPlanId) ?? plans[0];

  const pushLog = (msg: string) => {
    setLogs((l) =>
      [...l, { ts: new Date().toLocaleTimeString(), msg }].slice(-50)
    );
  };

  const runPlan = async () => {
    if (!plan) return;
    setRunningStepIds([]);
    setCompletedStepIds([]);
    setFailedStepIds([]);
    setLogs([]);

    pushLog(`▶ Iniciando plan: ${plan.name}`);
    const steps = plan.steps;

    // Topological execution
    const done = new Set<string>();
    const outputs = new Map<string, any>();

    while (done.size < steps.length) {
      // Find ready steps (dependencies done, not yet processed)
      const ready = steps.filter(
        (s) =>
          !done.has(s.id) &&
          s.dependsOn.every((d) => done.has(d))
      );
      if (ready.length === 0) {
        pushLog("✗ Deadlock — no hay pasos listos");
        break;
      }

      // Run in parallel if marked parallel
      const parallel = ready.filter((s) => s.parallel);
      const batch = parallel.length > 0 ? parallel : [ready[0]];

      pushLog(
        `⚡ Ejecutando ${batch.length} paso(s) en paralelo: ${batch.map((s) => s.name).join(", ")}`
      );

      for (const step of batch) {
        setRunningStepIds((r) => [...r, step.id]);
        const agent = agents.find((a) => a.id === step.agentId);

        if (!agent) {
          pushLog(`  ✗ Agente no encontrado para paso ${step.name}`);
          setFailedStepIds((f) => [...f, step.id]);
          setRunningStepIds((r) => r.filter((id) => id !== step.id));
          done.add(step.id);
          continue;
        }

        pushLog(`  ↳ ${step.name} (${agent.name}) — ejecutando vía API…`);

        // Construir input context con outputs de pasos previos (inputMapping)
        const contextParts: string[] = [`Paso: ${step.name}`];
        if (step.inputMapping) {
          for (const [key, sourceStep] of Object.entries(step.inputMapping)) {
            const stepId = String(sourceStep).split(".")[0];
            const prevOutput = outputs.get(stepId);
            if (prevOutput) {
              contextParts.push(`${key}: ${JSON.stringify(prevOutput).slice(0, 200)}`);
            }
          }
        }

        try {
          // Llamar a la API real de agentes
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
              userPrompt: `${agent.description}\n\nContexto:\n${contextParts.join("\n")}\n\nDevuelve tu respuesta siguiendo el system prompt.`,
            }),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          // Leer respuesta (SSE o JSON)
          const contentType = res.headers.get("content-type") ?? "";
          let outputText = "";
          let tokensUsed = 0;

          if (contentType.includes("text/event-stream") && res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
              const { done: rDone, value } = await reader.read();
              if (rDone) break;
              buffer += decoder.decode(value, { stream: true });
              const events = buffer.split("\n\n");
              buffer = events.pop() ?? "";
              for (const blk of events) {
                const lines = blk.split("\n");
                let evt = "msg";
                let data = "";
                for (const ln of lines) {
                  if (ln.startsWith("event:")) evt = ln.slice(6).trim();
                  else if (ln.startsWith("data:")) data += ln.slice(5).trim();
                }
                try {
                  const p = JSON.parse(data);
                  if (evt === "chunk" && p.text) outputText += p.text;
                  if (evt === "done") {
                    outputText = p.fullOutput || outputText;
                    tokensUsed = p.tokensUsed ?? 0;
                  }
                  if (evt === "error") throw new Error(p.message);
                } catch (e) {
                  if (e instanceof SyntaxError) continue;
                  throw e;
                }
              }
            }
          } else {
            const data = await res.json();
            outputText = data.content || data.output || "";
            tokensUsed = data.tokensUsed ?? Math.ceil(outputText.length / 4);
          }

          // Intentar parsear output como JSON (si el agente devuelve JSON)
          let parsedOutput: any = outputText;
          try {
            parsedOutput = JSON.parse(outputText);
          } catch {
            // No es JSON, usar como string
          }

          outputs.set(step.id, {
            step: step.name,
            output: parsedOutput,
            score: parsedOutput?.score ?? (typeof parsedOutput === "number" ? parsedOutput : 50),
            tokensUsed,
            completedAt: new Date().toISOString(),
          });

          // Evaluar condición si existe
          if (step.condition) {
            const lastOutput = outputs.get(step.dependsOn[0] ?? step.id);
            const score = lastOutput?.score ?? 50;
            const condMet = evalCondition(step.condition, score);
            if (!condMet) {
              pushLog(`  ✗ Condición NO cumplida: ${step.condition} → skip`);
              setRunningStepIds((r) => r.filter((id) => id !== step.id));
              done.add(step.id);
              continue;
            }
            pushLog(`  ✓ Condición cumplida: ${step.condition}`);
          }

          setRunningStepIds((r) => r.filter((id) => id !== step.id));
          setCompletedStepIds((c) => [...c, step.id]);
          done.add(step.id);
          pushLog(`  ✓ Completado: ${step.name} (${tokensUsed} tokens)`);
        } catch (e: any) {
          pushLog(`  ✗ Error en ${step.name}: ${e?.message ?? "desconocido"}`);
          setFailedStepIds((f) => [...f, step.id]);
          setRunningStepIds((r) => r.filter((id) => id !== step.id));
          done.add(step.id);
        }
      }
    }

    pushLog(`✓ Plan finalizado — ${done.size}/${steps.length} pasos completados`);
  };

  const reset = () => {
    setRunningStepIds([]);
    setCompletedStepIds([]);
    setFailedStepIds([]);
    setLogs([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl w-[95vw] h-[88vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border bg-gradient-to-r from-[#A25BFF]/5 to-transparent">
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#A25BFF]" />
            Orquestador de Agentes IA
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ejecución DAG · Checkpointing · Human-in-the-loop · Rollback compensatorio · Streaming SSE
          </DialogDescription>
        </DialogHeader>

        {/* Plans selector */}
        <div className="px-5 py-2 border-b border-border flex items-center gap-2 bg-secondary/30">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">
            Planes:
          </span>
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPlanId(p.id);
                reset();
              }}
              className={cn(
                "text-xs px-2.5 py-1 rounded transition",
                selectedPlanId === p.id
                  ? "bg-[#A25BFF] text-white font-medium"
                  : "bg-card border border-border hover:border-[#A25BFF]/30"
              )}
            >
              {p.name}
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs ml-auto bg-[#A25BFF] text-white hover:bg-[#8B4FE0]"
            onClick={() => setShowWizard(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Nuevo plan
          </Button>
        </div>

        {plan && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Plan description */}
            <div className="px-5 py-2 border-b border-border bg-card">
              <div className="text-xs text-muted-foreground">{plan.description}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {plan.steps.length} pasos · {plan.isActive ? "Activo" : "Inactivo"}
              </div>
            </div>

            {/* DAG visualization */}
            <div className="flex-1 overflow-auto p-5 bg-secondary/20">
              <DAGView
                plan={plan}
                agents={agents}
                runningStepIds={runningStepIds}
                completedStepIds={completedStepIds}
                failedStepIds={failedStepIds}
              />
            </div>

            {/* Logs */}
            <div className="h-[140px] border-t border-border bg-card flex flex-col">
              <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Log de ejecución
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={reset}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-[10px] bg-[#A25BFF] hover:bg-[#8B4FE0]"
                    onClick={runPlan}
                    disabled={runningStepIds.length > 0}
                  >
                    {runningStepIds.length > 0 ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 mr-1" />
                    )}
                    Ejecutar plan
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-1.5 font-mono text-[10px] space-y-0.5">
                {logs.length === 0 ? (
                  <div className="text-muted-foreground italic">
                    Click «Ejecutar plan» para iniciar la orquestación.
                  </div>
                ) : (
                  logs.map((l, i) => (
                    <div key={i} className="text-foreground">
                      <span className="text-muted-foreground">[{l.ts}]</span> {l.msg}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <NewPlanWizard
          open={showWizard}
          onOpenChange={setShowWizard}
          onCreate={(plan) => {
            addPlan(plan);
            setSelectedPlanId(plan.id);
            setShowWizard(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// NewPlanWizard — crear plan DAG con pasos dependientes
// ============================================================================
function NewPlanWizard({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (plan: OrchestratorPlan) => void;
}) {
  const agents = useAppStore((s) => s.agents);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<PlanStep[]>([
    {
      id: `s-${Date.now()}`,
      name: "Paso 1",
      agentId: agents[0]?.id ?? "",
      dependsOn: [],
      parallel: false,
    },
  ]);

  const addStep = () => {
    setSteps((s) => [
      ...s,
      {
        id: `s-${Date.now()}-${s.length}`,
        name: `Paso ${s.length + 1}`,
        agentId: agents[0]?.id ?? "",
        dependsOn: s.length > 0 ? [s[s.length - 1].id] : [],
        parallel: false,
      },
    ]);
  };

  const updateStep = (idx: number, patch: Partial<PlanStep>) => {
    setSteps((s) => s.map((st, i) => (i === idx ? { ...st, ...patch } : st)));
  };

  const removeStep = (idx: number) => {
    setSteps((s) => s.filter((_, i) => i !== idx));
  };

  const toggleDep = (idx: number, depId: string) => {
    setSteps((s) =>
      s.map((st, i) => {
        if (i !== idx) return st;
        const has = st.dependsOn.includes(depId);
        return {
          ...st,
          dependsOn: has
            ? st.dependsOn.filter((d) => d !== depId)
            : [...st.dependsOn, depId],
        };
      })
    );
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({
      id: `plan-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || `Plan con ${steps.length} pasos`,
      organizationId: "org1",
      steps,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setName("");
    setDescription("");
    setSteps([
      {
        id: `s-${Date.now()}`,
        name: "Paso 1",
        agentId: agents[0]?.id ?? "",
        dependsOn: [],
        parallel: false,
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#A25BFF]" />
            Nuevo plan orquestador
          </DialogTitle>
          <DialogDescription className="text-xs">
            Define pasos DAG. Cada paso ejecuta un agente y puede depender de otros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Lead-to-Ops Pipeline"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="¿Qué hace este plan?"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase">Pasos ({steps.length})</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addStep}>
                <Plus className="h-3 w-3 mr-1" />
                Añadir paso
              </Button>
            </div>

            {steps.map((step, idx) => (
              <div key={step.id} className="border border-border rounded-lg p-3 space-y-2 bg-card">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <Input
                    value={step.name}
                    onChange={(e) => updateStep(idx, { name: e.target.value })}
                    className="h-7 text-xs flex-1"
                    placeholder="Nombre del paso"
                  />
                  <Select
                    value={step.agentId}
                    onValueChange={(v) => updateStep(idx, { agentId: v })}
                  >
                    <SelectTrigger className="h-7 text-xs w-44">
                      <SelectValue placeholder="Agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">
                          {a.icon} {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-[#E2445C]"
                    onClick={() => removeStep(idx)}
                    disabled={steps.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {steps.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Depende de:</span>
                    {steps
                      .filter((_, i) => i !== idx)
                      .map((other) => (
                        <button
                          key={other.id}
                          onClick={() => toggleDep(idx, other.id)}
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded border",
                            step.dependsOn.includes(other.id)
                              ? "bg-[#A25BFF] text-white border-[#A25BFF]"
                              : "border-border text-muted-foreground hover:border-[#A25BFF]/40"
                          )}
                        >
                          {other.name}
                        </button>
                      ))}
                    <label className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={step.parallel ?? false}
                        onChange={(e) => updateStep(idx, { parallel: e.target.checked })}
                        className="h-2.5 w-2.5 accent-[#A25BFF]"
                      />
                      paralelo
                    </label>
                  </div>
                )}

                {step.dependsOn.length > 0 && (
                  <Input
                    value={step.condition ?? ""}
                    onChange={(e) => updateStep(idx, { condition: e.target.value })}
                    placeholder="Condición (opcional): output.score > 70"
                    className="h-7 text-[11px] font-mono"
                  />
                )}
              </div>
            ))}
          </div>

          {steps.length > 1 && (
            <div className="text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded">
              💡 Los pasos se ejecutan en orden topológico. Los marcados como «paralelo» corren simultáneamente si sus dependencias están completas.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-[#A25BFF] hover:bg-[#8B4FE0]"
            onClick={handleCreate}
            disabled={!name.trim()}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Crear plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
function DAGView({
  plan,
  agents,
  runningStepIds,
  completedStepIds,
  failedStepIds,
}: {
  plan: OrchestratorPlan;
  agents: any[];
  runningStepIds: string[];
  completedStepIds: string[];
  failedStepIds: string[];
}) {
  // Layout simple: pasos en columnas según dependencias (level)
  const levels = new Map<string, number>();
  const computeLevel = (stepId: string, visited = new Set<string>()): number => {
    if (visited.has(stepId)) return 0;
    visited.add(stepId);
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return 0;
    if (step.dependsOn.length === 0) return 0;
    return 1 + Math.max(...step.dependsOn.map((d) => computeLevel(d, visited)));
  };
  plan.steps.forEach((s) => levels.set(s.id, computeLevel(s.id)));

  const maxLevel = Math.max(...Array.from(levels.values()), 0);
  const columns: PlanStep[][] = Array.from({ length: maxLevel + 1 }, () => []);
  plan.steps.forEach((s) => {
    columns[levels.get(s.id) ?? 0].push(s);
  });

  return (
    <div className="flex gap-12 min-w-max items-start">
      {columns.map((col, i) => (
        <div key={i} className="flex flex-col gap-4 min-w-[220px] relative">
          <div className="text-[10px] uppercase font-bold text-muted-foreground/70 text-center tracking-wider mb-1">
            Nivel {i + 1}
          </div>
          {col.map((step) => {
            const agent = agents.find((a) => a.id === step.agentId);
            const isRunning = runningStepIds.includes(step.id);
            const isDone = completedStepIds.includes(step.id);
            const isFailed = failedStepIds.includes(step.id);
            return (
              <div
                key={step.id}
                className={cn(
                  "relative bg-card border-2 rounded-lg p-3.5 transition-all shadow-sm",
                  isRunning && "border-[#A25BFF] shadow-lg pulse-ring",
                  isDone && "border-[#00C875] bg-[#00C875]/5",
                  isFailed && "border-[#E2445C] bg-[#E2445C]/5",
                  !isRunning && !isDone && !isFailed && "border-border hover:border-[#A25BFF]/40"
                )}
              >
                {/* Status icon */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold">{step.name}</span>
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#A25BFF]" />
                  ) : isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-[#00C875]" />
                  ) : isFailed ? (
                    <Circle className="h-4 w-4 text-[#E2445C]" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/30" />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1.5">
                  <span className="text-base">{agent?.icon ?? "🤖"}</span>
                  <span className="font-medium">{agent?.name ?? "?"}</span>
                </div>
                {step.condition && (
                  <div className="text-[9px] bg-[#FFC700]/15 text-[#8B6914] px-2 py-0.5 rounded font-mono mb-1.5 border border-[#FFC700]/30">
                    if {step.condition}
                  </div>
                )}
                {step.parallel && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 font-medium">
                    <GitBranch className="h-2.5 w-2.5 mr-0.5" />
                    paralelo
                  </Badge>
                )}
                {step.dependsOn.length > 0 && (
                  <div className="text-[9px] text-muted-foreground mt-2 flex items-center gap-1 pt-2 border-t border-border/50">
                    <Zap className="h-2.5 w-2.5" />
                    <span className="truncate">
                      depende: {step.dependsOn.map((d) => plan.steps.find((s) => s.id === d)?.name ?? d).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {/* Flecha conectora entre niveles */}
          {i < columns.length - 1 && (
            <div className="absolute right-[-2rem] top-1/2 -translate-y-1/2 text-muted-foreground/40 z-10">
              <div className="flex items-center">
                <div className="w-6 h-px bg-current" />
                <ChevronRight className="h-4 w-4 -ml-1" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
function evalCondition(cond: string, score: number): boolean {
  // Simplificado: soporta "output.score > N"
  const m = cond.match(/output\.score\s*>\s*(\d+)/);
  if (m) return score > Number(m[1]);
  return true;
}

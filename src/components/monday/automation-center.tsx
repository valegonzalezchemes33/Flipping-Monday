"use client";
// ============================================================================
// AutomationCenter — lista de recipes + wizard crear + Switch funcional
// ============================================================================
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { AutomationRecipe, AutomationTriggerKind, AutomationActionKind } from "@/lib/types";
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Plus, Bot, ArrowRight, Sparkles, Trash2, Copy, CheckCircle2 } from "lucide-react";

const TRIGGER_OPTIONS: { value: AutomationTriggerKind; label: string; desc: string }[] = [
  { value: "when_status_changes", label: "Cuando cambia estado", desc: "Dispara cuando un item cambia de status" },
  { value: "when_item_created", label: "Cuando se crea item", desc: "Dispara al crear un item nuevo" },
  { value: "when_column_changes", label: "Cuando cambia columna", desc: "Dispara al editar cualquier columna" },
  { value: "when_date_arrives", label: "Cuando llega fecha", desc: "Dispara en la fecha de una columna date" },
  { value: "when_assignee_changes", label: "Cuando cambia asignado", desc: "Dispara al cambiar people" },
  { value: "every_day", label: "Cada día", desc: "Cron diario a las 9am UTC" },
  { value: "every_week", label: "Cada semana", desc: "Cron semanal lunes 9am" },
  { value: "manual", label: "Manual", desc: "Solo vía botón o API" },
];

const ACTION_OPTIONS: { value: AutomationActionKind; label: string; desc: string; isAI?: boolean }[] = [
  { value: "run_agent", label: "Ejecutar agente IA", desc: "Llama a un agente con el contexto del item", isAI: true },
  { value: "run_orchestrator", label: "Ejecutar orquestador", desc: "Lanza un plan DAG completo", isAI: true },
  { value: "create_item", label: "Crear item", desc: "Crea un nuevo item en un board" },
  { value: "change_status", label: "Cambiar estado", desc: "Modifica la columna status" },
  { value: "notify", label: "Notificar", desc: "Envía notificación al owner/equipo" },
  { value: "move_item", label: "Mover item", desc: "Cambia el item a otro grupo" },
  { value: "assign_person", label: "Asignar persona", desc: "Asigna user a columna people" },
  { value: "create_update", label: "Crear update", desc: "Publica comentario automático" },
  { value: "http_request", label: "HTTP request", desc: "Llama API externa (webhook)" },
  { value: "archive_item", label: "Archivar item", desc: "Marca item como archivado" },
];

export function AutomationCenter() {
  const open = useAppStore((s) => s.showAutomations);
  const setOpen = useAppStore((s) => s.setShowAutomations);
  const automations = useAppStore((s) => s.automations);
  const agents = useAppStore((s) => s.agents);
  const plans = useAppStore((s) => s.plans);
  const boards = useAppStore((s) => s.boards);
  const toggleAutomation = useAppStore((s) => s.toggleAutomation);
  const deleteAutomation = useAppStore((s) => s.deleteAutomation);
  const addAutomation = useAppStore((s) => s.addAutomation);

  const [showWizard, setShowWizard] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-[95vw] h-[80vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-5 py-3 border-b border-border">
            <DialogTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#FFC700]" />
              Centro de Automatizaciones
            </DialogTitle>
            <DialogDescription className="text-xs">
              Recetas trigger → condition → action · acciones de agente IA híbridas
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed h-9"
              onClick={() => setShowWizard(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Crear nueva automatización
            </Button>

            {automations.map((auto) => {
              const board = boards.find((b) => b.id === auto.boardId);
              const isAgentAction = auto.action.kind === "run_agent" || auto.action.kind === "run_orchestrator";
              const agent = agents.find((a) => a.id === auto.action.config.agentId);
              const plan = plans.find((p) => p.id === auto.action.config.planId);
              return (
                <div
                  key={auto.id}
                  className="border border-border rounded-lg p-3.5 hover:border-[#FFC700]/40 hover:shadow-sm transition group bg-card"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-black/5",
                        isAgentAction
                          ? "bg-[#0072E5]/12 text-[#0072E5]"
                          : "bg-[#FFC700]/15 text-[#FFC700]"
                      )}
                    >
                      {isAgentAction ? <Bot className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{auto.name}</span>
                        {isAgentAction && (
                          <Badge className="text-[9px] h-4 bg-[#0072E5] hover:bg-[#0072E5] text-white gap-0.5 font-medium">
                            <Sparkles className="h-2.5 w-2.5" />
                            IA
                          </Badge>
                        )}
                        {!auto.isActive && (
                          <Badge variant="secondary" className="text-[9px] h-4">
                            Pausada
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {auto.description}
                      </div>
                      {/* Recipe visualization */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {auto.trigger.kind.replace(/_/g, " ")}
                        </Badge>
                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                        {auto.conditions.length > 0 ? (
                          <>
                            <Badge variant="outline" className="text-[9px] font-mono">
                              {auto.conditions.length} cond.
                            </Badge>
                            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                          </>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-mono",
                            isAgentAction && "border-[#0072E5] text-[#0072E5]"
                          )}
                        >
                          {auto.action.kind.replace(/_/g, " ")}
                          {agent && ` → ${agent.name}`}
                          {plan && ` → ${plan.name}`}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          · {board?.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={auto.isActive}
                          onCheckedChange={() => toggleAutomation(auto.id)}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {auto.isActive ? "Activa" : "Pausada"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                        title="Duplicar"
                        onClick={() =>
                          addAutomation({
                            ...auto,
                            id: `auto-${Date.now()}`,
                            name: `${auto.name} (copia)`,
                            isActive: false,
                            createdAt: new Date().toISOString(),
                          })
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[#E2445C] opacity-0 group-hover:opacity-100"
                        title="Eliminar"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar automatización «${auto.name}»?`)) {
                            deleteAutomation(auto.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="text-[10px] text-muted-foreground bg-secondary/30 rounded p-3 mt-4">
              <div className="font-semibold mb-1">Recetas híbridas IA + Automatización</div>
              Las acciones <span className="font-mono">run_agent</span> y <span className="font-mono">run_orchestrator</span> permiten
              ejecutar agentes como paso de automatizaciones. Ejemplo: <em>«When item created in group X → run Lead Scorer → if score &gt; 70 → notify owner»</em>.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AutomationWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onCreate={(recipe) => {
          addAutomation(recipe);
          setShowWizard(false);
        }}
      />
    </>
  );
}

// ============================================================================
// AutomationWizard — crear nueva automatización
// ============================================================================
function AutomationWizard({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (recipe: AutomationRecipe) => void;
}) {
  const agents = useAppStore((s) => s.agents);
  const plans = useAppStore((s) => s.plans);
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<AutomationTriggerKind>("when_status_changes");
  const [action, setAction] = useState<AutomationActionKind>("run_agent");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [message, setMessage] = useState("Item {{item.name}} actualizado");

  const reset = () => {
    setName("");
    setDescription("");
    setTrigger("when_status_changes");
    setAction("run_agent");
    setAgentId(agents[0]?.id ?? "");
    setPlanId(plans[0]?.id ?? "");
    setMessage("Item {{item.name}} actualizado");
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    const config: any = {};
    if (action === "run_agent") config.agentId = agentId;
    if (action === "run_orchestrator") config.planId = planId;
    if (action === "notify") config.message = message;
    if (action === "move_item") config.groupId = "g1";
    if (action === "change_status") config.labelId = "0";

    onCreate({
      id: `auto-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || `${trigger} → ${action}`,
      trigger: { kind: trigger, config: {} },
      conditions: [],
      action: { kind: action, config },
      isActive: true,
      boardId: activeBoardId,
      createdAt: new Date().toISOString(),
    });
    reset();
  };

  const isAI = action === "run_agent" || action === "run_orchestrator";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#FFC700]" />
            Nueva automatización
          </DialogTitle>
          <DialogDescription className="text-xs">
            Trigger → Action. Conecta acciones de IA o clásicas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Auto-score leads"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Qué hace esta automatización"
              />
            </div>
          </div>

          {/* Trigger */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase">When (Trigger)</Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto">
              {TRIGGER_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTrigger(t.value)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 p-2 rounded border text-left transition",
                    trigger === t.value
                      ? "border-[#FFC700] bg-[#FFC700]/5"
                      : "border-border hover:border-[#FFC700]/30"
                  )}
                >
                  <span className="text-xs font-medium">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
          </div>

          {/* Action */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase">Then (Action)</Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-[180px] overflow-y-auto">
              {ACTION_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAction(a.value)}
                  className={cn(
                    "flex items-start gap-1.5 p-2 rounded border text-left transition",
                    action === a.value
                      ? a.isAI
                        ? "border-[#0072E5] bg-[#0072E5]/5"
                        : "border-[#FFC700] bg-[#FFC700]/5"
                      : "border-border hover:border-[#FFC700]/30"
                  )}
                >
                  {a.isAI && <Sparkles className="h-3 w-3 mt-0.5 text-[#0072E5] shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{a.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action-specific config */}
          {action === "run_agent" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Agente a ejecutar</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-sm">
                      {a.icon} {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {action === "run_orchestrator" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Plan orquestador</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {action === "notify" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Mensaje</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="text-xs min-h-[60px]"
              />
              <p className="text-[10px] text-muted-foreground">
                Variables: {`{{item.name}}`}, {`{{user.name}}`}, {`{{board.name}}`}
              </p>
            </div>
          )}

          {isAI && (
            <div className="flex items-center gap-2 text-[11px] text-[#0072E5] bg-[#0072E5]/10 p-2 rounded">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Esta automatización ejecutará IA — los costes de tokens se contabilizarán.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-[#0072E5] hover:bg-[#0058B5]"
            onClick={handleCreate}
            disabled={!name.trim()}
          >
            <Zap className="h-3.5 w-3.5 mr-1" />
            Crear automatización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

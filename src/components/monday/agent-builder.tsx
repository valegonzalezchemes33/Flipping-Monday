"use client";
// ============================================================================
// AgentBuilder — REDISEÑADO: plantillas + configuración simplificada
// ============================================================================
// En lugar de un wizard técnico de 5 pasos, ahora es:
// 1. Elegir plantilla (o empezar desde cero)
// 2. Personalizar (nombre, descripción, qué debe hacer)
// 3. Test & Deploy
// Mucho más intuitivo, como crear un agente en Monday.com

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Agent, AgentTool, AgentTriggerType, AgentScope } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Check,
  Sparkles,
  Play,
  Loader2,
  ArrowRight,
  Bot,
  Target,
  Mail,
  FileText,
  AlertTriangle,
  Search,
  PenTool,
  Languages,
  BarChart3,
  Plus,
  Lightbulb,
  Zap,
} from "lucide-react";

// ---- PLANTILLAS PREDEFINIDAS (como Monday AI presets) ----
interface AgentTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  systemPrompt: string;
  triggers: AgentTriggerType[];
  tools: AgentTool[];
  category: "ventas" | "producto" | "operaciones" | "contenido" | "general";
}

const TEMPLATES: AgentTemplate[] = [
  {
    id: "lead-scorer",
    name: "Calificador de Leads",
    icon: "🎯",
    color: "#0072E5",
    description: "Analiza leads y les asigna un score 0-100 con justificación",
    systemPrompt: "Eres un analista de ventas B2B. Recibes el contexto de un lead: nombre, valor potencial, fecha límite, estado de pipeline. Devuelve un JSON: {\"score\": number, \"label\": \"Crítico|Alto|Medio|Bajo\", \"reasoning\": string}.",
    triggers: ["manual", "item_created"],
    tools: [],
    category: "ventas",
  },
  {
    id: "email-drafter",
    name: "Redactor de Emails",
    icon: "✉️",
    color: "#FF642E",
    description: "Redacta emails personalizados basados en el contexto del item",
    systemPrompt: "Eres un copywriter senior de ventas. Recibes el historial de updates de un item y el contexto del lead. Redacta un email de seguimiento profesional, conciso, con CTA claro. Devuelve JSON: {\"subject\": string, \"body\": string}.",
    triggers: ["manual"],
    tools: [],
    category: "ventas",
  },
  {
    id: "spec-generator",
    name: "Generador de Specs",
    icon: "📝",
    color: "#A25BFF",
    description: "Genera PRDs técnicos a partir del nombre del feature y contexto",
    systemPrompt: "Eres un PM técnico senior. Recibes el nombre de un feature, el contexto del board y los updates. Genera un PRD en markdown: Resumen, Objetivos, Requisitos funcionales, Criterios de aceptación, Dependencias, Riesgos.",
    triggers: ["manual"],
    tools: [],
    category: "producto",
  },
  {
    id: "doc-extractor",
    name: "Extractor de Documentos",
    icon: "📎",
    color: "#00C875",
    description: "Extrae datos estructurados de PDFs y archivos adjuntos",
    systemPrompt: "Eres un asistente de extracción documental. Recibes el texto extraído de un documento. Devuelve un JSON con los campos clave encontrados. Si un campo no está presente, devuelve null.",
    triggers: ["manual", "webhook"],
    tools: [],
    category: "operaciones",
  },
  {
    id: "risk-analyzer",
    name: "Analizador de Riesgos",
    icon: "⚠️",
    color: "#E2445C",
    description: "Analiza items cross-board y detecta riesgos: deadlines, items stuck",
    systemPrompt: "Eres un PMO. Recibes datos consolidados de boards: items stuck, deadlines próximos, owners sobrecargados. Devuelve un reporte de riesgos priorizado con recomendaciones accionables.",
    triggers: ["schedule", "manual"],
    tools: [],
    category: "operaciones",
  },
  {
    id: "summarizer",
    name: "Resumidor de Updates",
    icon: "📋",
    color: "#579BFC",
    description: "Resume los updates de un item en 3 puntos clave",
    systemPrompt: "Eres un asistente que resume información. Recibes los updates de un item. Devuelve un resumen en 3 puntos clave, cada uno en una línea empezando con •.",
    triggers: ["manual", "column_change"],
    tools: [],
    category: "contenido",
  },
  {
    id: "translator",
    name: "Traductor",
    icon: "🌐",
    color: "#FFC700",
    description: "Traduce el contenido del item al idioma especificado",
    systemPrompt: "Eres un traductor profesional. Recibes texto del item y el idioma objetivo. Devuelve solo la traducción, sin comentarios adicionales.",
    triggers: ["manual"],
    tools: [],
    category: "contenido",
  },
  {
    id: "sentiment",
    name: "Análisis de Sentimiento",
    icon: "😊",
    color: "#FF158A",
    description: "Analiza el sentimiento de los updates (positivo/negativo/neutral)",
    systemPrompt: "Eres un analista de sentimiento. Recibes los updates de un item. Devuelve JSON: {\"sentiment\": \"Positivo|Negativo|Neutral\", \"confidence\": number, \"key_phrases\": string[]}.",
    triggers: ["manual", "column_change"],
    tools: [],
    category: "contenido",
  },
  {
    id: "blank",
    name: "Desde Cero",
    icon: "✨",
    color: "#676879",
    description: "Crea un agente personalizado desde cero",
    systemPrompt: "",
    triggers: ["manual"],
    tools: [],
    category: "general",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  ventas: "Ventas & CRM",
  producto: "Producto",
  operaciones: "Operaciones",
  contenido: "Contenido",
  general: "General",
};

export function AgentBuilder() {
  const open = useAppStore((s) => s.showAgentBuilder);
  const setOpen = useAppStore((s) => s.setShowAgentBuilder);
  const addAgent = useAppStore((s) => s.addAgent);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const activeBoardId = useAppStore((s) => s.activeBoardId);

  const [step, setStep] = useState<"templates" | "configure" | "deploy">("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [draft, setDraft] = useState<Agent | null>(null);
  const [testOutput, setTestOutput] = useState("");
  const [testing, setTesting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  // Prompt-to-agent (como Monday.com)
  const [promptInput, setPromptInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const groqApiKey = useAppStore((s) => s.sidekickGroqApiKey);
  const workspaces = useAppStore((s) => s.workspaces);

  // Ejemplos rápidos para el prompt
  const PROMPT_EXAMPLES = [
    { icon: "🏷️", text: "Un agente que categorice automáticamente los items nuevos" },
    { icon: "📊", text: "Un agente que genere reportes semanales del board" },
    { icon: "😊", text: "Un agente que analice el sentimiento de los updates" },
    { icon: "📧", text: "Un agente que redacte emails para clientes" },
    { icon: "⚡", text: "Un agente que priorice items según urgencia" },
    { icon: "🔍", text: "Un agente que detecte items duplicados" },
  ];

  const reset = () => {
    setStep("templates");
    setSelectedTemplate(null);
    setDraft(null);
    setTestOutput("");
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      reset();
    }
    setOpen(v);
  };

  const handleSelectTemplate = (template: AgentTemplate) => {
    setSelectedTemplate(template);
    const newDraft: Agent = {
      id: "draft",
      name: template.name,
      description: template.description,
      systemPrompt: template.systemPrompt,
      tools: template.tools,
      model: "glm-4.6",
      temperature: 0.4,
      maxTokens: 1500,
      version: 1,
      isActive: true,
      createdById: currentUserId,
      organizationId: "org1",
      boardId: activeBoardId,
      scope: "board",
      triggers: template.triggers,
      icon: template.icon,
      color: template.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDraft(newDraft);
    setStep("configure");
  };

  const update = (patch: Partial<Agent>) => {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
  };

  // ===== PROMPT-TO-AGENT: genera un agente desde un prompt en lenguaje natural =====
  const handleGenerateAgent = async () => {
    if (!promptInput.trim() || generating) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptInput.trim(),
          groqApiKey,
          context: {
            boardName: useAppStore.getState().boards.find((b) => b.id === activeBoardId)?.name,
            workspaceName: workspaces[0]?.name,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.agent) {
        throw new Error(data.error || "Error generando agente");
      }
      const a = data.agent;
      const newDraft: Agent = {
        id: "draft",
        name: a.name,
        description: a.description,
        systemPrompt: a.systemPrompt,
        tools: a.tools,
        model: a.model || "glm-4.6",
        temperature: a.temperature ?? 0.4,
        maxTokens: 1500,
        version: 1,
        isActive: true,
        createdById: currentUserId,
        organizationId: "org1",
        boardId: activeBoardId,
        scope: a.scope || "global",
        triggers: a.triggers,
        icon: a.icon,
        color: a.color,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDraft(newDraft);
      setStep("configure");
    } catch (e: any) {
      setGenerateError(e?.message ?? "Error desconocido");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeploy = () => {
    if (!draft) return;
    addAgent({ ...draft, id: `a-${Date.now()}` });
    handleClose(false);
  };

  const handleTest = async () => {
    if (!draft) return;
    setTesting(true);
    setTestOutput("");
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "test",
          agentName: draft.name,
          systemPrompt: draft.systemPrompt,
          model: draft.model,
          temperature: draft.temperature,
          maxTokens: draft.maxTokens,
          userPrompt: `Test del agente. Descripción: ${draft.description}. Devuelve una respuesta breve de ejemplo.`,
        }),
      });
      if (!res.body) throw new Error("Sin response");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
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
            if (evt === "chunk" && p.text) {
              acc += p.text;
              setTestOutput(acc);
            }
            if (evt === "error") {
              acc += `\n\n⚠️ ${p.message}`;
              setTestOutput(acc);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setTestOutput(`Error: ${e?.message ?? "desconocido"}`);
    } finally {
      setTesting(false);
    }
  };

  const filteredTemplates = filterCategory === "all"
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === filterCategory);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#0072E5]" />
            {step === "templates" && "Crear Agente IA"}
            {step === "configure" && "Personalizar Agente"}
            {step === "deploy" && "Probar y Desplegar"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "templates" && "Elige una plantilla o empieza desde cero"}
            {step === "configure" && "Personaliza el comportamiento del agente"}
            {step === "deploy" && "Prueba el agente antes de desplegarlo"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator simplificado */}
        <div className="px-5 py-2 border-b border-border bg-secondary/20 flex items-center gap-2">
          {["Plantillas", "Personalizar", "Desplegar"].map((label, i) => {
            const stepIdx = step === "templates" ? 0 : step === "configure" ? 1 : 2;
            const isActive = i === stepIdx;
            const isDone = i < stepIdx;
            return (
              <div key={i} className="flex items-center">
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition",
                  isActive && "bg-[#0072E5] text-white font-medium",
                  isDone && "text-[#0072E5]",
                  !isActive && !isDone && "text-muted-foreground/50"
                )}>
                  <span className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                    isActive ? "bg-white text-[#0072E5]" : isDone ? "bg-[#00C875] text-white" : "bg-secondary"
                  )}>
                    {isDone ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
                  </span>
                  {label}
                </div>
                {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 mx-0.5" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1: TEMPLATES */}
        {step === "templates" && (
          <div className="flex-1 overflow-y-auto p-5">
            {/* ===== PROMPT-TO-AGENT (como Monday.com) ===== */}
            <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-[#0072E5]/[0.04] to-[#A25BFF]/[0.04] border border-[#0072E5]/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0072E5] to-[#A25BFF] flex items-center justify-center text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#323338]">Crear agente con IA</div>
                  <div className="text-[11px] text-[#676879]">Describe qué quieres que haga y la IA genera el agente completo</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <textarea
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleGenerateAgent();
                    }
                  }}
                  placeholder="Ej: Un agente que categorice los items automáticamente y notifique al equipo cuando haya items urgentes..."
                  className="flex-1 min-h-[60px] max-h-[120px] text-sm px-3 py-2 rounded-lg border border-[#E5E8EE] bg-white resize-none focus:outline-none focus:border-[#0072E5] focus:ring-2 focus:ring-[#0072E5]/10"
                  disabled={generating}
                />
                <Button
                  onClick={handleGenerateAgent}
                  disabled={!promptInput.trim() || generating}
                  className="bg-[#0072E5] hover:bg-[#0058B5] text-white px-4 self-stretch"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1.5" />
                      Generar
                    </>
                  )}
                </Button>
              </div>
              {generateError && (
                <div className="mt-2 text-xs text-[#E2445C] bg-[#E2445C]/10 px-2 py-1 rounded">
                  ⚠️ {generateError}
                </div>
              )}
              {/* Ejemplos rápidos */}
              <div className="mt-3">
                <div className="text-[10px] text-[#676879] mb-1.5 font-medium uppercase tracking-wider">Ejemplos rápidos:</div>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setPromptInput(ex.text)}
                      disabled={generating}
                      className="text-[11px] px-2 py-1 rounded-full bg-white border border-[#E5E8EE] hover:border-[#0072E5]/40 hover:bg-[#0072E5]/5 text-[#323338] transition disabled:opacity-50"
                    >
                      {ex.icon} {ex.text.slice(0, 40)}{ex.text.length > 40 ? "..." : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Divisor */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#E5E8EE]" />
              <span className="text-[10px] text-[#676879] font-medium uppercase tracking-wider">o usa una plantilla</span>
              <div className="flex-1 h-px bg-[#E5E8EE]" />
            </div>

            {/* Filtro por categoría */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              <button
                onClick={() => setFilterCategory("all")}
                className={cn(
                  "text-[11px] px-2.5 py-1 rounded-full font-medium transition",
                  filterCategory === "all" ? "bg-[#0072E5] text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
              >
                Todos
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilterCategory(key)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full font-medium transition",
                    filterCategory === key ? "bg-[#0072E5] text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Grid de plantillas */}
            <div className="grid grid-cols-2 gap-2.5">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="text-left p-3 rounded-lg border border-border hover:border-[#0072E5]/40 hover:shadow-sm transition group bg-card"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 ring-1 ring-black/5"
                      style={{ background: `${template.color}18` }}
                    >
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{template.name}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                        {template.description}
                      </div>
                    </div>
                  </div>
                  {template.triggers.length > 0 && template.triggers[0] !== "manual" && (
                    <div className="flex items-center gap-1 mt-2">
                      <Zap className="h-2.5 w-2.5 text-[#FFC700]" />
                      <span className="text-[9px] text-muted-foreground">
                        Auto: {template.triggers.filter(t => t !== "manual").join(", ")}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: CONFIGURE */}
        {step === "configure" && draft && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Preview del agente */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ring-1 ring-black/5"
                style={{ background: `${draft.color}18` }}
              >
                {draft.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{draft.name || "Sin nombre"}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-1">{draft.description || "Sin descripción"}</div>
              </div>
              {/* Selector de ícono rápido */}
              <div className="flex gap-0.5">
                {["🎯", "✉️", "📝", "📎", "⚠️", "📋", "🌐", "😊", "🤖", "🔍"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => update({ icon: emoji })}
                    className={cn(
                      "w-6 h-6 rounded text-xs hover:bg-card transition",
                      draft.icon === emoji && "bg-[#0072E5]/20 ring-1 ring-[#0072E5]/30"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Nombre */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre del agente</Label>
              <Input
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Ej: Calificador de Leads"
                className="h-9 text-sm"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">¿Qué hace este agente?</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Ej: Analiza leads y les asigna un score 0-100 con justificación"
                className="min-h-[50px] text-sm resize-none"
              />
            </div>

            {/* Instrucciones (system prompt simplificado) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Lightbulb className="h-3 w-3 text-[#FFC700]" />
                Instrucciones para el agente
              </Label>
              <Textarea
                value={draft.systemPrompt}
                onChange={(e) => update({ systemPrompt: e.target.value })}
                placeholder="Describe en lenguaje natural qué debe hacer el agente. Ej: 'Eres un analista de ventas. Analiza el lead y devuelve un score 0-100, una etiqueta (Crítico/Alto/Medio/Bajo) y una justificación breve.'"
                className="min-h-[100px] text-xs font-mono resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                💡 Escribe en lenguaje natural. El agente recibirá automáticamente el contexto del item (nombre, columnas, updates).
              </p>
            </div>

            {/* Triggers simplificado */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">¿Cuándo debe ejecutarse?</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "manual", label: "🖱️ Manual (botón Ejecutar)" },
                  { value: "item_created", label: "➕ Al crear item" },
                  { value: "column_change", label: "✏️ Al cambiar columna" },
                  { value: "schedule", label: "⏰ Programado" },
                ].map((trigger) => {
                  const selected = draft.triggers.includes(trigger.value as AgentTriggerType);
                  return (
                    <button
                      key={trigger.value}
                      onClick={() => {
                        const next = selected
                          ? draft.triggers.filter((t) => t !== trigger.value)
                          : [...draft.triggers, trigger.value as any];
                        update({ triggers: next as any });
                      }}
                      className={cn(
                        "text-[11px] px-2.5 py-1.5 rounded-md border transition font-medium",
                        selected
                          ? "border-[#0072E5] bg-[#0072E5]/5 text-[#0072E5]"
                          : "border-border text-muted-foreground hover:border-[#0072E5]/30"
                      )}
                    >
                      {trigger.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configuración avanzada (colapsable) */}
            <details className="border border-border rounded-lg">
              <summary className="px-3 py-2 text-xs font-medium cursor-pointer hover:bg-secondary/30 rounded-lg">
                ⚙️ Configuración avanzada (modelo, temperatura)
              </summary>
              <div className="px-3 py-3 space-y-3 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium">Modelo LLM</Label>
                    <select
                      value={draft.model}
                      onChange={(e) => update({ model: e.target.value as any })}
                      className="w-full h-8 text-xs rounded border border-border bg-card px-2"
                    >
                      <option value="glm-4.6">GLM-4.6 (recomendado)</option>
                      <option value="glm-4.5-air">GLM-4.5 Air (rápido)</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="claude-sonnet-5">Claude Sonnet 5</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium">
                      Creatividad: {draft.temperature}
                    </Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={draft.temperature}
                      onChange={(e) => update({ temperature: Number(e.target.value) })}
                      className="w-full h-8 accent-[#0072E5]"
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>Preciso</span>
                      <span>Creativo</span>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* STEP 3: DEPLOY */}
        {step === "deploy" && draft && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Resumen */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#00C875]/5 border border-[#00C875]/20">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: `${draft.color}18` }}
              >
                {draft.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{draft.name}</div>
                <div className="text-[11px] text-muted-foreground">{draft.description}</div>
              </div>
              <Check className="h-5 w-5 text-[#00C875]" />
            </div>

            {/* Config summary */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-secondary/30 rounded p-2">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Modelo</div>
                <div className="font-medium">{draft.model}</div>
              </div>
              <div className="bg-secondary/30 rounded p-2">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Triggers</div>
                <div className="font-medium">{draft.triggers.join(", ") || "manual"}</div>
              </div>
            </div>

            {/* Test */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Probar agente</Label>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-[#0072E5] hover:bg-[#0058B5]"
                  onClick={handleTest}
                  disabled={testing || !draft.systemPrompt}
                >
                  {testing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  {testing ? "Probando…" : "Probar"}
                </Button>
              </div>
              <div className="bg-card border border-border rounded-md p-3 min-h-[100px] max-h-[200px] overflow-y-auto">
                <pre className="text-[11px] font-mono whitespace-pre-wrap break-words">
                  {testOutput || (testing ? "Ejecutando…" : "Click en Probar para ver una respuesta de ejemplo.")}
                </pre>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground bg-[#FFC700]/10 border border-[#FFC700]/30 rounded p-2.5 flex gap-2">
              <span>🔒</span>
              <div>
                <div className="font-semibold">Seguridad aplicada</div>
                <div>Sandbox execution · Token limits · Audit trail · Cost tracking</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-card">
          <span className="text-[11px] text-muted-foreground">
            {step === "templates" && "Paso 1 de 3"}
            {step === "configure" && "Paso 2 de 3"}
            {step === "deploy" && "Paso 3 de 3"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            {step === "configure" && (
              <Button variant="ghost" size="sm" onClick={() => setStep("templates")}>
                <ChevronRight className="h-3 w-3 rotate-180 mr-1" />
                Atrás
              </Button>
            )}
            {step === "deploy" && (
              <Button variant="ghost" size="sm" onClick={() => setStep("configure")}>
                <ChevronRight className="h-3 w-3 rotate-180 mr-1" />
                Atrás
              </Button>
            )}
            {step === "configure" && (
              <Button
                size="sm"
                className="bg-[#0072E5] hover:bg-[#0058B5] text-white"
                onClick={() => setStep("deploy")}
                disabled={!draft?.name.trim() || !draft?.systemPrompt.trim()}
              >
                Siguiente
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            {step === "deploy" && (
              <Button
                size="sm"
                className="bg-[#00C875] hover:bg-[#00A85F] text-white"
                onClick={handleDeploy}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Desplegar agente
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";
// ============================================================================
// CommandPalette — Cmd+K search + comandos de acción con navegación teclado
// ============================================================================
import { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Search,
  Bot,
  Zap,
  Sparkles,
  LayoutGrid,
  ArrowRight,
  Plus,
  Table2,
  Calendar,
  ListChecks,
  Clock,
  Columns3,
  Download,
} from "lucide-react";

interface CmdItem {
  id: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const boards = useAppStore((s) => s.boards);
  const agents = useAppStore((s) => s.agents);
  const plans = useAppStore((s) => s.plans);
  const automations = useAppStore((s) => s.automations);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const setShowAgentBuilder = useAppStore((s) => s.setShowAgentBuilder);
  const setShowOrchestrator = useAppStore((s) => s.setShowOrchestrator);
  const setShowAutomations = useAppStore((s) => s.setShowAutomations);
  const setShowAddBoard = useAppStore((s) => s.setShowAddBoard);
  const setShowAddColumn = useAppStore((s) => s.setShowAddColumn);
  const setShowAddView = useAppStore((s) => s.setShowAddView);
  const setShowExportImport = useAppStore((s) => s.setShowExportImport);
  const addItem = useAppStore((s) => s.addItem);
  const activeBoardId = useAppStore((s) => s.activeBoardId);

  const [q, setQ] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items: CmdItem[] = useMemo(() => {
    const list: CmdItem[] = [];

    // Commands
    list.push({
      id: "cmd-new-agent",
      label: "Crear nuevo agente IA",
      sub: "Comando · Wizard 5 pasos",
      icon: <Bot className="h-4 w-4 text-[#0072E5]" />,
      category: "Comandos",
      action: () => {
        setShowAgentBuilder(true);
        setOpen(false);
      },
    });
    list.push({
      id: "cmd-new-board",
      label: "Crear nuevo board",
      sub: "Comando · Plantilla básica",
      icon: <LayoutGrid className="h-4 w-4 text-[#00C875]" />,
      category: "Comandos",
      action: () => {
        setShowAddBoard(true);
        setOpen(false);
      },
    });
    list.push({
      id: "cmd-new-item",
      label: "Agregar item al board actual",
      sub: "Comando",
      icon: <Plus className="h-4 w-4 text-muted-foreground" />,
      category: "Comandos",
      action: () => {
        const b = boards.find((x) => x.id === activeBoardId);
        if (b) addItem(b.id, b.groups[0]?.id ?? "", "Nuevo item");
        setOpen(false);
      },
    });
    list.push({
      id: "cmd-new-column",
      label: "Añadir columna al board",
      sub: "Comando · Column Center",
      icon: <Columns3 className="h-4 w-4 text-[#A25BFF]" />,
      category: "Comandos",
      action: () => {
        setShowAddColumn(true);
        setOpen(false);
      },
    });
    list.push({
      id: "cmd-new-view",
      label: "Añadir vista al board",
      sub: "Comando · Kanban, Gantt, Calendar…",
      icon: <Table2 className="h-4 w-4 text-[#FF642E]" />,
      category: "Comandos",
      action: () => {
        setShowAddView(true);
        setOpen(false);
      },
    });
    list.push({
      id: "cmd-open-orchestrator",
      label: "Abrir orquestador",
      sub: "Comando · DAG de agentes",
      icon: <Sparkles className="h-4 w-4 text-[#A25BFF]" />,
      category: "Comandos",
      action: () => {
        setShowOrchestrator(true);
        setOpen(false);
      },
    });
    list.push({
      id: "cmd-open-automations",
      label: "Ver automatizaciones",
      sub: "Comando",
      icon: <Zap className="h-4 w-4 text-[#FFC700]" />,
      category: "Comandos",
      action: () => {
        setShowAutomations(true);
        setOpen(false);
      },
    });
    list.push({
      id: "cmd-export",
      label: "Exportar / Importar JSON v2.0",
      sub: "Comando · Compatibilidad Monday",
      icon: <Download className="h-4 w-4 text-muted-foreground" />,
      category: "Comandos",
      action: () => {
        setShowExportImport(true);
        setOpen(false);
      },
    });

    // Boards
    boards.forEach((b) =>
      list.push({
        id: `board-${b.id}`,
        label: b.name,
        sub: `Board · ${b.items.length} items`,
        icon: <LayoutGrid className="h-4 w-4" style={{ color: "#0072E5" }} />,
        category: "Boards",
        action: () => {
          setActiveBoard(b.id);
          setOpen(false);
        },
      })
    );

    // Agents
    agents.forEach((a) =>
      list.push({
        id: `agent-${a.id}`,
        label: a.name,
        sub: `Agente IA · ${a.scope}`,
        icon: <span className="text-base">{a.icon ?? "🤖"}</span>,
        category: "Agentes",
        action: () => {
          setShowAgentBuilder(true);
          setOpen(false);
        },
      })
    );

    // Plans
    plans.forEach((p) =>
      list.push({
        id: `plan-${p.id}`,
        label: p.name,
        sub: "Plan orquestador",
        icon: <Sparkles className="h-4 w-4 text-[#A25BFF]" />,
        category: "Planes",
        action: () => {
          setShowOrchestrator(true);
          setOpen(false);
        },
      })
    );

    // Automations
    automations.forEach((a) =>
      list.push({
        id: `auto-${a.id}`,
        label: a.name,
        sub: "Automatización",
        icon: <Zap className="h-4 w-4 text-[#FFC700]" />,
        category: "Automatizaciones",
        action: () => {
          setShowAutomations(true);
          setOpen(false);
        },
      })
    );

    if (!q) return list;
    const lower = q.toLowerCase();
    return list.filter(
      (r) =>
        r.label.toLowerCase().includes(lower) ||
        r.sub.toLowerCase().includes(lower) ||
        r.category.toLowerCase().includes(lower)
    );
  }, [q, boards, agents, plans, automations, activeBoardId]);

  // Reset selection cuando cambia la query
  useEffect(() => {
    setSelectedIndex(0);
  }, [q]);

  // Focus input al abrir
  useEffect(() => {
    if (open) {
      setQ("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Auto-scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item) item.action();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Group items by category for display
  const grouped = items.reduce((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {} as Record<string, CmdItem[]>);

  let flatIdx = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0 top-[15%] translate-y-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Buscar</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar boards, agentes, planes… o usa comandos"
            className="border-0 focus-visible:ring-0 text-sm h-7"
          />
          <kbd className="text-[10px] bg-secondary px-1.5 py-0.5 rounded border border-border">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
              Sin resultados para «{q}»
            </div>
          ) : (
            Object.entries(grouped).map(([category, catItems]) => (
              <div key={category} className="mb-3 last:mb-0">
                <div className="text-[10px] uppercase font-bold text-muted-foreground/70 px-2 py-1.5 tracking-wider">
                  {category}
                </div>
                {catItems.map((r) => {
                  flatIdx++;
                  const isSelected = flatIdx === selectedIndex;
                  const idx = flatIdx;
                  return (
                    <button
                      key={r.id}
                      data-idx={idx}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={r.action}
                      className={cn(
                        "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition",
                        isSelected
                          ? "bg-[#0072E5]/10 ring-1 ring-[#0072E5]/20"
                          : "hover:bg-secondary/60"
                      )}
                    >
                      <span className={cn("shrink-0", isSelected && "text-[#0072E5]")}>
                        {r.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm truncate", isSelected ? "font-semibold text-[#0072E5]" : "font-medium")}>
                          {r.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{r.sub}</div>
                      </div>
                      {isSelected && (
                        <ArrowRight className="h-3 w-3 text-[#0072E5] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{items.length} resultados</span>
          <span className="flex items-center gap-2">
            <span>↑↓ navegar</span>
            <span>↵ abrir</span>
            <span>esc cerrar</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

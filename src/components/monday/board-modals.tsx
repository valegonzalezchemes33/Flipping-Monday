"use client";
// ============================================================================
// Board modals — AddBoard, AddColumn, AddView controlados por store
// (Compartidos entre sidebar, header, command palette y board-view)
// ============================================================================
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { ViewType, ColumnType } from "@/lib/types";
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table2,
  KanbanSquare,
  Calendar,
  ListChecks,
  Clock,
  BarChart3,
  Plus,
} from "lucide-react";

const VIEW_TYPES: { type: ViewType; label: string; icon: React.ReactNode }[] = [
  { type: "main_table", label: "Tabla principal", icon: <Table2 className="h-4 w-4" /> },
  { type: "kanban", label: "Kanban", icon: <KanbanSquare className="h-4 w-4" /> },
  { type: "calendar", label: "Calendario", icon: <Calendar className="h-4 w-4" /> },
  { type: "gantt", label: "Gantt", icon: <ListChecks className="h-4 w-4" /> },
  { type: "timeline", label: "Timeline", icon: <ListChecks className="h-4 w-4" /> },
  { type: "workload", label: "Carga de trabajo", icon: <Clock className="h-4 w-4" /> },
  { type: "chart", label: "Gráfico", icon: <BarChart3 className="h-4 w-4" /> },
];

const COLUMN_TYPES: { type: ColumnType; label: string; icon: string }[] = [
  { type: "text", label: "Texto", icon: "📝" },
  { type: "long_text", label: "Texto largo", icon: "📄" },
  { type: "numbers", label: "Números", icon: "🔢" },
  { type: "status", label: "Estado", icon: "🚦" },
  { type: "priority", label: "Prioridad", icon: "🚨" },
  { type: "date", label: "Fecha", icon: "📅" },
  { type: "people", label: "Personas", icon: "👤" },
  { type: "dropdown", label: "Dropdown", icon: "▾" },
  { type: "checkbox", label: "Checkbox", icon: "✓" },
  { type: "rating", label: "Rating", icon: "★" },
  { type: "progress", label: "Progreso", icon: "▓" },
  { type: "email", label: "Email", icon: "✉" },
  { type: "phone", label: "Teléfono", icon: "☎" },
  { type: "link", label: "Link", icon: "🔗" },
  { type: "file", label: "Archivo", icon: "📎" },
  { type: "tags", label: "Tags", icon: "🏷" },
  { type: "time_tracking", label: "Time tracking", icon: "⏱" },
  { type: "ai_agent", label: "Agente IA", icon: "🤖" },
];

// ============================================================================
// AddBoardDialog
// ============================================================================
export function AddBoardDialog() {
  const open = useAppStore((s) => s.showAddBoard);
  const setOpen = useAppStore((s) => s.setShowAddBoard);
  const workspaces = useAppStore((s) => s.workspaces);
  const addBoard = useAppStore((s) => s.addBoard);

  const [name, setName] = useState("");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");

  const close = () => {
    setName("");
    setOpen(false);
  };

  const handleCreate = () => {
    if (!name.trim() || !workspaceId) return;
    addBoard(workspaceId, name.trim());
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Crear board</DialogTitle>
          <DialogDescription className="text-xs">
            Plantilla básica (name, status, people, date) con grupo inicial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre del board *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Pipeline Q4"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Workspace</Label>
            <Select value={workspaceId} onValueChange={setWorkspaceId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecciona workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id} className="text-sm">
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={close}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-[#0072E5] hover:bg-[#0058B5]"
            onClick={handleCreate}
            disabled={!name.trim() || !workspaceId}
          >
            Crear board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// AddColumnDialog
// ============================================================================
export function AddColumnDialog() {
  const open = useAppStore((s) => s.showAddColumn);
  const setOpen = useAppStore((s) => s.setShowAddColumn);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const addColumn = useAppStore((s) => s.addColumn);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ColumnType>("text");

  const close = () => {
    setTitle("");
    setType("text");
    setOpen(false);
  };

  const handleCreate = () => {
    if (!title.trim() || !activeBoardId) return;
    const col: any = { title: title.trim(), type, width: 140 };
    if (type === "status") {
      col.labels = {
        "0": { name: "Working on it", color: "#FFC700" },
        "1": { name: "Done", color: "#00C875" },
        "2": { name: "Stuck", color: "#E2445C" },
        "3": { name: "Not Started", color: "#C4C4C4" },
      };
    } else if (type === "priority") {
      col.labels = {
        "0": { name: "Critical", color: "#401694" },
        "1": { name: "High", color: "#5559DF" },
        "2": { name: "Medium", color: "#5AB1FF" },
        "3": { name: "Low", color: "#9CD326" },
      };
    } else if (type === "ai_agent") {
      col.agentIds = [];
    }
    addColumn(activeBoardId, col);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Añadir columna</DialogTitle>
          <DialogDescription className="text-xs">
            Elige tipo y título. Podrás editar labels después.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Budget"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <div className="grid grid-cols-3 gap-1.5 max-h-[260px] overflow-y-auto">
              {COLUMN_TYPES.map((c) => (
                <button
                  key={c.type}
                  onClick={() => setType(c.type)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 p-2 rounded border text-[11px] transition text-left",
                    type === c.type
                      ? "border-[#0072E5] bg-[#0072E5]/5 text-[#0072E5]"
                      : "border-border hover:border-[#0072E5]/30"
                  )}
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="font-medium">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={close}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-[#0072E5] hover:bg-[#0058B5]"
            onClick={handleCreate}
            disabled={!title.trim()}
          >
            Crear columna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// AddViewDialog
// ============================================================================
export function AddViewDialog() {
  const open = useAppStore((s) => s.showAddView);
  const setOpen = useAppStore((s) => s.setShowAddView);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const addView = useAppStore((s) => s.addView);

  const [name, setName] = useState("");
  const [type, setType] = useState<ViewType>("kanban");

  const close = () => {
    setName("");
    setType("kanban");
    setOpen(false);
  };

  const handleCreate = () => {
    if (!name.trim() || !activeBoardId) return;
    addView(activeBoardId, { name: name.trim(), type });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Añadir vista</DialogTitle>
          <DialogDescription className="text-xs">
            Selecciona el tipo de vista y dale un nombre
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mi Kanban"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {VIEW_TYPES.map((v) => (
                <button
                  key={v.type}
                  onClick={() => setType(v.type)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded border text-xs transition text-left",
                    type === v.type
                      ? "border-[#0072E5] bg-[#0072E5]/5 text-[#0072E5]"
                      : "border-border hover:border-[#0072E5]/30"
                  )}
                >
                  {v.icon}
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={close}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-[#0072E5] hover:bg-[#0058B5]"
            onClick={handleCreate}
            disabled={!name.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Crear vista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";
// ============================================================================
// BoardView — toolbar (views, filter, sort, group, hide, AI) + container de vista
// ============================================================================
import { useState, useMemo } from "react";
import {
  Filter,
  SortDesc,
  Group as GroupIcon,
  Eye,
  Plus,
  Sparkles,
  Download,
  Upload,
  MoreHorizontal,
  Table2,
  KanbanSquare,
  Calendar,
  BarChart3,
  Clock,
  Map,
  FileText,
  ListChecks,
  Check,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MainTableView } from "./main-table-view";
import { KanbanView } from "./kanban-view";
import { CalendarView } from "./calendar-view";
import { GanttView } from "./gantt-view";
import { WorkloadView } from "./workload-view";
import { ChartView } from "./chart-view";
import { TimelineView } from "./timeline-view";
import { ExportImportDialog } from "./export-import-dialog";
import type { ViewType, ColumnType } from "@/lib/types";

const VIEW_ICONS: Record<string, React.ReactNode> = {
  main_table: <Table2 className="h-3.5 w-3.5" />,
  kanban: <KanbanSquare className="h-3.5 w-3.5" />,
  calendar: <Calendar className="h-3.5 w-3.5" />,
  gantt: <ListChecks className="h-3.5 w-3.5" />,
  workload: <Clock className="h-3.5 w-3.5" />,
  chart: <BarChart3 className="h-3.5 w-3.5" />,
  timeline: <ListChecks className="h-3.5 w-3.5" />,
  map: <Map className="h-3.5 w-3.5" />,
  form: <FileText className="h-3.5 w-3.5" />,
};

const VIEW_LABELS: Record<string, string> = {
  main_table: "Tabla principal",
  kanban: "Kanban",
  calendar: "Calendario",
  gantt: "Gantt",
  workload: "Carga de trabajo",
  chart: "Gráfico",
  map: "Mapa",
  form: "Formulario",
  timeline: "Timeline",
  files: "Archivos",
  docs: "Docs",
};

const COLUMN_TYPES_AVAILABLE: { type: ColumnType; label: string; icon: string }[] = [
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

export function BoardView() {
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const board = boards.find((b) => b.id === activeBoardId);
  const activeViewId = useAppStore((s) => s.activeViewId);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const setShowAgentBuilder = useAppStore((s) => s.setShowAgentBuilder);
  const setShowOrchestrator = useAppStore((s) => s.setShowOrchestrator);
  const setShowAutomations = useAppStore((s) => s.setShowAutomations);
  const addItem = useAppStore((s) => s.addItem);
  const addView = useAppStore((s) => s.addView);
  const addColumn = useAppStore((s) => s.addColumn);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const sorts = useAppStore((s) => s.sorts);
  const setSorts = useAppStore((s) => s.setSorts);
  const groupBy = useAppStore((s) => s.groupBy);
  const setGroupBy = useAppStore((s) => s.setGroupBy);
  const hiddenColumns = useAppStore((s) => s.hiddenColumns);
  const setHiddenColumns = useAppStore((s) => s.setHiddenColumns);

  const [showExport, setShowExport] = useState(false);
  const setShowAddView = useAppStore((s) => s.setShowAddView);
  const setShowAddColumn = useAppStore((s) => s.setShowAddColumn);

  if (!board) return null;

  const activeView = board.views.find((v) => v.id === activeViewId) ?? board.views[0];

  const renderView = () => {
    switch (activeView?.type) {
      case "kanban":
        return <KanbanView />;
      case "calendar":
        return <CalendarView />;
      case "gantt":
        return <GanttView />;
      case "workload":
        return <WorkloadView />;
      case "chart":
        return <ChartView />;
      case "timeline":
        return <TimelineView />;
      case "main_table":
      default:
        return <MainTableView />;
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* Board header — estilo Monday Vibe */}
      <div className="border-b border-[#D0D4E4] bg-white px-4 pt-3">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] font-bold text-[#323338] truncate leading-tight" style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
              {board.name}
            </h1>
            {board.description && (
              <p className="text-[12px] text-[#676879] mt-0.5 truncate">
                {board.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <TooltipProvider delayDuration={300}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        <span className="hidden sm:inline">Compartir</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Compartir tablero y permisos</TooltipContent>
                  </Tooltip>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <div className="px-3 py-2">
                    <div className="text-xs font-semibold mb-1">Compartir tablero</div>
                    <div className="text-[10px] text-muted-foreground mb-2 capitalize">
                      Tablero {board.boardKind} · {board.items.length} tareas
                    </div>
                    <Input
                      readOnly
                      value={`https://monday-ai.local/boards/${board.id}`}
                      className="h-7 text-[11px] font-mono"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <div className="flex items-center gap-1.5 mt-2">
                      <Button size="sm" className="h-7 text-[11px] flex-1 bg-[#0072E5] hover:bg-[#0058B5] text-white">
                        <Plus className="h-3 w-3 mr-1" />
                        Invitar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        navigator.clipboard?.writeText(`https://monday-ai.local/boards/${board.id}`);
                      }}
                    >
                      Copiar link
                    </Button>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <div className="px-3 py-1.5">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Permisos de acceso</div>
                  <DropdownMenuItem className="text-xs">Público — cualquiera en el workspace</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs">Solo invitados</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs">Solo owners</DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            </TooltipProvider>
            <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowExport(true)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar tablero a JSON/Excel</TooltipContent>
            </Tooltip>
            {/* Acción primaria: Nueva tarea — verde Monday #00C875 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 text-[13px] bg-[#00C875] hover:bg-[#00B564] text-white font-medium shadow-sm"
                  style={{ borderRadius: "4px" }}
                  onClick={() =>
                addItem(board.id, board.groups[0]?.id ?? "", "Nuevo item")
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nueva tarea
            </Button>
              </TooltipTrigger>
              <TooltipContent>Crear una nueva tarea en este tablero</TooltipContent>
            </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* View tabs + toolbar — estilo Monday Vibe (underline azul) */}
        <div className="flex items-center gap-1 -mb-px mt-2">
          {/* View switcher — underline estilo Monday */}
          <div className="flex items-stretch">
            {board.views.map((v) => {
              const isActive = activeView?.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setActiveView(v.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 text-[13px] font-medium border-b-2 -mb-px transition-colors duration-100 min-w-[80px] justify-center",
                    isActive
                      ? "text-[#0073EA]"
                      : "border-transparent text-[#676879] hover:text-[#323338]"
                  )}
                  style={
                    isActive
                      ? { borderColor: "#0073EA", height: "40px" }
                      : { borderColor: "transparent", height: "40px" }
                  }
                >
                  {VIEW_ICONS[v.type] ?? <Table2 className="h-3.5 w-3.5" />}
                  {v.name}
                </button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-2 text-[#676879] hover:text-[#323338] hover:bg-[rgba(103,104,121,0.1)]"
              onClick={() => setShowAddView(true)}
              title="Añadir vista"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1" />

          {/* Toolbar actions */}
          <div className="hidden md:flex items-center gap-0.5 pb-1">
            <FilterPopover
              boardId={board.id}
              columns={board.columns}
              filters={filters}
              setFilters={setFilters}
            />
            <SortPopover
              columns={board.columns}
              sorts={sorts}
              setSorts={setSorts}
            />
            <GroupPopover
              columns={board.columns}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
            />
            <HidePopover
              columns={board.columns}
              hiddenColumns={hiddenColumns}
              setHiddenColumns={setHiddenColumns}
              onAddColumn={() => setShowAddColumn(true)}
            />
            {(filters.length > 0 || sorts.length > 0 || groupBy || hiddenColumns.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] text-[#E2445C] h-8"
                onClick={() => {
                  setFilters([]);
                  setSorts([]);
                  setGroupBy(null);
                  setHiddenColumns([]);
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-8 gap-1"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#0072E5]" />
                      <span className="hidden lg:inline">IA</span>
                      <span className="text-[10px]">▾</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Acciones de IA del tablero</TooltipContent>
                </Tooltip>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">Acciones IA</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowAgentBuilder(true)}>
                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                  Crear agente IA
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowOrchestrator(true)}>
                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                  Abrir orquestador
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAutomations(true)}>
                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                  Ver automatizaciones
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground"
                      title="Más opciones"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Más opciones del tablero</TooltipContent>
                </Tooltip>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Acciones del board</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowAddColumn(true)}>
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  Añadir columna
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddView(true)}>
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  Añadir vista
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowExport(true)}>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Exportar board
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAgentBuilder(true)}>
                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                  Crear agente IA
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAutomations(true)}>
                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                  Ver automatizaciones
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[#E2445C]"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar board «${board.name}»? Esta acción no se puede deshacer.`)) {
                      useAppStore.getState().deleteBoard(board.id);
                    }
                  }}
                >
                  Eliminar board
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Active view body */}
      <div className="flex-1 overflow-hidden">{renderView()}</div>

      <ExportImportDialog open={showExport} onOpenChange={setShowExport} />
    </div>
  );
}

// ============================================================================
// Toolbar Popovers: Filtrar / Ordenar / Agrupar / Ocultar
// ============================================================================

function FilterPopover({
  boardId,
  columns,
  filters,
  setFilters,
}: {
  boardId: string;
  columns: any[];
  filters: { columnId: string; op: string; value: any }[];
  setFilters: (f: any[]) => void;
}) {
  const [local, setLocal] = useState(filters);

  const update = (i: number, patch: any) => {
    const next = [...local];
    next[i] = { ...next[i], ...patch };
    setLocal(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "text-xs h-8 gap-1",
            filters.length > 0 ? "text-[#0072E5]" : "text-muted-foreground"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Filtrar</span>
          {filters.length > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1">
              {filters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="text-xs font-semibold mb-2">Filtros</div>
        {local.length === 0 && (
          <div className="text-[11px] text-muted-foreground mb-2">
            Sin filtros activos
          </div>
        )}
        <div className="space-y-2">
          {local.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Select
                value={f.columnId}
                onValueChange={(v) => update(i, { columnId: v })}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Columna" />
                </SelectTrigger>
                <SelectContent>
                  {columns
                    .filter((c) => c.id !== "name")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select
                value={f.op}
                onValueChange={(v) => update(i, { op: v })}
              >
                <SelectTrigger className="h-7 text-xs w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq" className="text-xs">=</SelectItem>
                  <SelectItem value="neq" className="text-xs">≠</SelectItem>
                  <SelectItem value="contains" className="text-xs">contiene</SelectItem>
                  <SelectItem value="empty" className="text-xs">vacío</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={f.value ?? ""}
                onChange={(e) => update(i, { value: e.target.value })}
                className="h-7 text-xs w-20"
                placeholder="valor"
                disabled={f.op === "empty"}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => setLocal(local.filter((_, x) => x !== i))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              setLocal([...local, { columnId: columns[1]?.id ?? "", op: "eq", value: "" }])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Añadir filtro
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-[#0072E5] hover:bg-[#0058B5] ml-auto"
            onClick={() => setFilters(local)}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortPopover({
  columns,
  sorts,
  setSorts,
}: {
  columns: any[];
  sorts: { columnId: string; dir: "asc" | "desc" }[];
  setSorts: (s: any[]) => void;
}) {
  const [local, setLocal] = useState(sorts);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "text-xs h-8 gap-1",
            sorts.length > 0 ? "text-[#0072E5]" : "text-muted-foreground"
          )}
        >
          <SortDesc className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Ordenar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="text-xs font-semibold mb-2">Ordenar por</div>
        {local.length === 0 && (
          <div className="text-[11px] text-muted-foreground mb-2">Sin orden activo</div>
        )}
        <div className="space-y-2">
          {local.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Select
                value={s.columnId}
                onValueChange={(v) => {
                  const next = [...local];
                  next[i] = { ...next[i], columnId: v };
                  setLocal(next);
                }}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns
                    .filter((c) => c.id !== "name")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select
                value={s.dir}
                onValueChange={(v: any) => {
                  const next = [...local];
                  next[i] = { ...next[i], dir: v };
                  setLocal(next);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc" className="text-xs">Ascendente</SelectItem>
                  <SelectItem value="desc" className="text-xs">Descendente</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => setLocal(local.filter((_, x) => x !== i))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              setLocal([...local, { columnId: columns[1]?.id ?? "", dir: "asc" as const }])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Añadir nivel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-[#0072E5] hover:bg-[#0058B5] ml-auto"
            onClick={() => setSorts(local)}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GroupPopover({
  columns,
  groupBy,
  setGroupBy,
}: {
  columns: any[];
  groupBy: string | null;
  setGroupBy: (g: string | null) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "text-xs h-8 gap-1",
            groupBy ? "text-[#0072E5]" : "text-muted-foreground"
          )}
        >
          <GroupIcon className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Agrupar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1.5">
          Agrupar por
        </div>
        <DropdownMenuCheckboxItem
          checked={!groupBy}
          onCheckedChange={() => setGroupBy(null)}
          className="text-xs"
        >
          Sin agrupar
        </DropdownMenuCheckboxItem>
        {columns
          .filter((c) => c.id !== "name")
          .map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={groupBy === c.id}
              onCheckedChange={() => setGroupBy(c.id)}
              className="text-xs"
            >
              {c.title}
            </DropdownMenuCheckboxItem>
          ))}
      </PopoverContent>
    </Popover>
  );
}

function HidePopover({
  columns,
  hiddenColumns,
  setHiddenColumns,
  onAddColumn,
}: {
  columns: any[];
  hiddenColumns: string[];
  setHiddenColumns: (cols: string[]) => void;
  onAddColumn: () => void;
}) {
  const toggle = (colId: string) => {
    if (hiddenColumns.includes(colId)) {
      setHiddenColumns(hiddenColumns.filter((c) => c !== colId));
    } else {
      setHiddenColumns([...hiddenColumns, colId]);
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "text-xs h-8 gap-1",
            hiddenColumns.length > 0 ? "text-[#0072E5]" : "text-muted-foreground"
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Ocultar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1.5">
          Columnas ({columns.length - hiddenColumns.length}/{columns.length} visibles)
        </div>
        {columns.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={!hiddenColumns.includes(c.id)}
            onCheckedChange={() => toggle(c.id)}
            className="text-xs"
            disabled={c.id === "name"}
          >
            {c.title}
            {c.id === "name" && <span className="text-[9px] text-muted-foreground ml-1">(required)</span>}
          </DropdownMenuCheckboxItem>
        ))}
        <div className="border-t border-border mt-1 pt-1">
          <button
            onClick={onAddColumn}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-secondary text-[#0072E5]"
          >
            <Plus className="h-3 w-3" />
            Añadir columna
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

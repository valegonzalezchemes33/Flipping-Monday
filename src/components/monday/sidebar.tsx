"use client";
// ============================================================================
// Sidebar Monday — Workspaces → Boards → Dashboards → Docs → Automations → Agentes
// ============================================================================
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  LayoutGrid,
  Users,
  Zap,
  Bot,
  Settings,
  Sparkles,
  Folder,
  Search,
  FileText,
  BarChart3,
  Home,
  MoreHorizontal,
  Download,
  Star,
  Clock,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Sidebar() {
  const workspaces = useAppStore((s) => s.workspaces);
  // FIX: filtrar boards archivados del sidebar
  const boards = useAppStore((s) => s.boards.filter((b) => !b.archived));
  const agents = useAppStore((s) => s.agents);
  const automations = useAppStore((s) => s.automations);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const setShowAgentBuilder = useAppStore((s) => s.setShowAgentBuilder);
  const setShowOrchestrator = useAppStore((s) => s.setShowOrchestrator);
  const setShowAutomations = useAppStore((s) => s.setShowAutomations);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const sidebarView = useAppStore((s) => s.sidebarView);
  const setSidebarView = useAppStore((s) => s.setSidebarView);
  const users = useAppStore((s) => s.users);
  const currentUser = useAppStore((s) => s.currentUserId);
  const addBoard = useAppStore((s) => s.addBoard);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const setShowMondayConnect = useAppStore((s) => s.setShowMondayConnect);
  const setShowMondayImport = useAppStore((s) => s.setShowMondayImport);
  const mondayConnected = useAppStore((s) => s.mondayConnected);
  const mondayAccount = useAppStore((s) => s.mondayAccount);
  const deleteBoard = useAppStore((s) => s.deleteBoard);
  const favoriteBoardIds = useAppStore((s) => s.favoriteBoardIds);
  const recentBoardIds = useAppStore((s) => s.recentBoardIds);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(workspaces.map((w) => [w.id, true]))
  );
  const [showAddBoard, setShowAddBoard] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardWs, setNewBoardWs] = useState("");

  const me = users.find((u) => u.id === currentUser);

  const handleAddBoard = () => {
    if (!newBoardName.trim() || !newBoardWs) return;
    addBoard(newBoardWs, newBoardName.trim());
    setExpanded((e) => ({ ...e, [newBoardWs]: true }));
    setNewBoardName("");
    setShowAddBoard(null);
  };

  const handleNav = (view: typeof sidebarView) => {
    setSidebarView(view);
  };

  return (
    <aside className="flex flex-col w-[260px] h-screen bg-white border-r border-[#D0D4E4] shrink-0">
      {/* Workspace header — más limpio */}
      <button
        className="px-3 py-3 border-b border-sidebar-border flex items-center gap-2.5 hover:bg-sidebar-accent/40 transition group"
        title="Click para crear nuevo workspace"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0072E5] to-[#0058B5] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
          A
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-semibold text-foreground truncate leading-tight">
            Acme Workspace
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00C875]" />
            Plan Pro · 5 seats
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
      </button>

      {/* Search / Cmd+K */}
      <div className="px-3 py-2.5 border-b border-sidebar-border">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Buscar…</span>
          <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Quick nav — más compacto y alineado */}
      <nav className="px-2 py-2 border-b border-sidebar-border space-y-0.5">
        <SidebarNavItem
          icon={<Home className="h-4 w-4" />}
          label="Inicio"
          active={sidebarView === "home"}
          onClick={() => handleNav("home")}
        />
        <SidebarNavItem
          icon={<Bot className="h-4 w-4" />}
          label="Agentes IA"
          badge={agents.length}
          onClick={() => setShowAgentBuilder(true)}
        />
        <SidebarNavItem
          icon={<Sparkles className="h-4 w-4" />}
          label="Orquestador"
          onClick={() => setShowOrchestrator(true)}
        />
        <SidebarNavItem
          icon={<Zap className="h-4 w-4" />}
          label="Automatizaciones"
          badge={automations.length}
          onClick={() => setShowAutomations(true)}
        />
        <SidebarNavItem
          icon={<BarChart3 className="h-4 w-4" />}
          label="Dashboards"
          active={sidebarView === "dashboards"}
          onClick={() => handleNav("dashboards")}
        />
        <SidebarNavItem
          icon={<FileText className="h-4 w-4" />}
          label="Docs"
          active={sidebarView === "docs"}
          onClick={() => handleNav("docs")}
        />
        <SidebarNavItem
          icon={<Users className="h-4 w-4" />}
          label="Equipo"
          badge={users.length}
          active={sidebarView === "team"}
          onClick={() => handleNav("team")}
        />
      </nav>

      {/* Favoritos y Recents — como Monday */}
      {!collapsed && ((favoriteBoardIds ?? []).length > 0 || (recentBoardIds ?? []).length > 0) && (
        <div className="px-2 py-2 border-b border-sidebar-border space-y-2">
          {(favoriteBoardIds ?? []).length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground/70 px-2 py-1 tracking-wider flex items-center gap-1">
                <Star className="h-2.5 w-2.5" />
                Favoritos
              </div>
              {(favoriteBoardIds ?? []).map((boardId) => {
                const board = boards.find((b) => b.id === boardId);
                if (!board) return null;
                const ws = workspaces.find((w) => w.id === board.workspaceId);
                return (
                  <div key={boardId} className="flex items-center group">
                    <button
                      onClick={() => setActiveBoard(boardId)}
                      className={cn(
                        "flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-sm transition min-w-0",
                        activeBoardId === boardId
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-foreground/80 hover:bg-sidebar-accent/40"
                      )}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 shrink-0" style={{ color: ws?.color ?? "#0072E5" }} />
                      <span className="flex-1 truncate text-[13px]">{board.name}</span>
                    </button>
                    <button
                      onClick={() => toggleFavorite(boardId)}
                      className="p-1 text-[#FFC700] opacity-0 group-hover:opacity-100 transition shrink-0"
                      title="Quitar de favoritos"
                    >
                      <Star className="h-3 w-3 fill-current" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {(recentBoardIds ?? []).length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground/70 px-2 py-1 tracking-wider flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                Recientes
              </div>
              {(recentBoardIds ?? []).map((boardId) => {
                const board = boards.find((b) => b.id === boardId);
                if (!board) return null;
                const ws = workspaces.find((w) => w.id === board.workspaceId);
                const isFavorite = (favoriteBoardIds ?? []).includes(boardId);
                return (
                  <div key={boardId} className="flex items-center group">
                    <button
                      onClick={() => setActiveBoard(boardId)}
                      className={cn(
                        "flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-sm transition min-w-0",
                        activeBoardId === boardId
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-foreground/80 hover:bg-sidebar-accent/40"
                      )}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 shrink-0" style={{ color: ws?.color ?? "#0072E5" }} />
                      <span className="flex-1 truncate text-[13px]">{board.name}</span>
                    </button>
                    <button
                      onClick={() => toggleFavorite(boardId)}
                      className={cn(
                        "p-1 transition shrink-0",
                        isFavorite ? "text-[#FFC700] opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                      )}
                      title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                    >
                      <Star className={cn("h-3 w-3", isFavorite && "fill-current")} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Integraciones — Monday.com connect */}
      <div className="px-2 py-2 border-b border-sidebar-border">
        <div className="text-[10px] uppercase font-bold text-muted-foreground/70 px-2 py-1 tracking-wider">
          Integraciones
        </div>
        <button
          onClick={() => setShowMondayConnect(true)}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition group",
            mondayConnected
              ? "bg-[#00C875]/10 hover:bg-[#00C875]/15 text-foreground"
              : "bg-gradient-to-r from-[#0072E5]/10 to-[#A25BFF]/10 hover:from-[#0072E5]/15 hover:to-[#A25BFF]/15 text-foreground border border-[#0072E5]/20"
          )}
        >
          <div
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0 text-xs font-bold",
              mondayConnected ? "bg-[#00C875]" : "bg-gradient-to-br from-[#0072E5] to-[#A25BFF]"
            )}
          >
            M
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-xs font-semibold truncate flex items-center gap-1">
              Monday.com
              {mondayConnected && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00C875]" />
              )}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {mondayConnected
                ? mondayAccount?.name ?? "Conectado"
                : "Conectar e importar"}
            </div>
          </div>
        </button>
        {mondayConnected && (
          <button
            onClick={() => setShowMondayImport(true)}
            className="w-full mt-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#0072E5] hover:bg-[#0072E5]/10 transition font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            Importar datos
          </button>
        )}
      </div>

      {/* Workspaces + boards — scroll area */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {workspaces.map((ws) => {
          const wsBoards = boards.filter((b) => b.workspaceId === ws.id);
          const isExpanded = expanded[ws.id];
          return (
            <div key={ws.id} className="mb-2">
              <div className="flex items-center group">
                <button
                  onClick={() =>
                    setExpanded((e) => ({ ...e, [ws.id]: !e[ws.id] }))
                  }
                  className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-sidebar-accent/50 transition min-w-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: ws.color }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left truncate">
                    {ws.name}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setNewBoardWs(ws.id);
                    setShowAddBoard(ws.id);
                  }}
                  className="p-1 rounded hover:bg-sidebar-accent text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0"
                  title="Añadir board"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {isExpanded && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-1.5">
                  {wsBoards.length === 0 && (
                    <button
                      onClick={() => {
                        setNewBoardWs(ws.id);
                        setShowAddBoard(ws.id);
                      }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-[#0072E5] rounded-md hover:bg-sidebar-accent/40 transition"
                    >
                      <Plus className="h-3 w-3" />
                      Crear primer board
                    </button>
                  )}
                  {wsBoards.map((b) => (
                    <div key={b.id} className="group/board flex items-center">
                      <button
                        onClick={() => {
                          setActiveBoard(b.id);
                          setSidebarView("boards");
                        }}
                        className={cn(
                          "flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition min-w-0",
                          activeBoardId === b.id && sidebarView === "boards"
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-foreground/80 hover:bg-sidebar-accent/40"
                        )}
                      >
                        <LayoutGrid
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: ws.color }}
                        />
                        <span className="flex-1 text-left truncate text-[13px]">
                          {b.name}
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFavorite(b.id)}
                        className={cn(
                          "p-1 rounded transition shrink-0",
                          (favoriteBoardIds ?? []).includes(b.id)
                            ? "text-[#FFC700] opacity-100"
                            : "text-muted-foreground opacity-0 group-hover/board:opacity-100 hover:text-[#FFC700]"
                        )}
                        title={(favoriteBoardIds ?? []).includes(b.id) ? "Quitar de favoritos" : "Añadir a favoritos"}
                      >
                        <Star className={cn("h-3 w-3", (favoriteBoardIds ?? []).includes(b.id) && "fill-current")} />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1 rounded text-muted-foreground opacity-0 group-hover/board:opacity-100 hover:bg-sidebar-accent transition shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setNewBoardWs(ws.id);
                              setNewBoardName(`${b.name} (copia)`);
                              setShowAddBoard(ws.id);
                            }}
                          >
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-[#E2445C]"
                            onClick={() => {
                              if (window.confirm(`¿Eliminar board «${b.name}»?`)) {
                                deleteBoard(b.id);
                              }
                            }}
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Add workspace — al final, sutil */}
        <button
          onClick={() => addWorkspace("New Workspace")}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-2 text-[11px] text-muted-foreground hover:text-[#0072E5] rounded-md hover:bg-sidebar-accent/40 transition"
        >
          <Plus className="h-3 w-3" />
          Nuevo workspace
        </button>
      </div>

      {/* User — más limpio */}
      <div className="border-t border-sidebar-border p-2 flex items-center gap-2.5 hover:bg-sidebar-accent/30 rounded-none transition cursor-pointer">
        <Avatar className="h-8 w-8 ring-2 ring-background">
          <AvatarFallback
            className="text-white text-xs font-semibold"
            style={{ background: me?.color }}
          >
            {me?.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{me?.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{me?.email}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Add Board modal */}
      <Dialog open={!!showAddBoard} onOpenChange={(o) => !o && setShowAddBoard(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-[#0072E5]" />
              Crear board
            </DialogTitle>
            <DialogDescription className="text-xs">
              Plantilla básica (name, status, people, date) con grupo inicial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre del board *</Label>
              <Input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Ej: Pipeline Q4"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddBoard()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Workspace</Label>
              <Select value={newBoardWs} onValueChange={setNewBoardWs}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecciona workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-sm">
                      <span className="flex items-center gap-2">
                        <Folder className="h-3 w-3" style={{ color: w.color }} />
                        {w.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowAddBoard(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-[#0072E5] hover:bg-[#0058B5] text-white"
              onClick={handleAddBoard}
              disabled={!newBoardName.trim() || !newBoardWs}
            >
              Crear board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function SidebarNavItem({
  icon,
  label,
  badge,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-[9px] rounded text-[14px] transition-colors duration-100 group",
        active
          ? "bg-[#CCE5FF] text-[#0073EA] font-semibold"
          : "text-[#323338] hover:bg-[rgba(103,104,121,0.1)]"
      )}
    >
      <span className={cn("shrink-0 transition-colors", active ? "text-[#0073EA]" : "text-[#676879] group-hover:text-[#323338]")}>
        {icon}
      </span>
      <span className="flex-1 text-left leading-tight">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "text-[11px] font-semibold px-1.5 py-0.5 rounded min-w-[20px] text-center",
            active
              ? "bg-[#0073EA] text-white"
              : "bg-[#F0F1F5] text-[#676879]"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

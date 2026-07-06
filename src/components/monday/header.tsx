"use client";
// ============================================================================
// Header Monday — Search global, Notifications (del store), Profile
// ============================================================================
import { useMemo } from "react";
import {
  Bell,
  HelpCircle,
  Plus,
  Sparkles,
  Search,
  Inbox,
  ChevronRight,
  Check,
  Bot,
  Clock,
  Zap,
  AtSign,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const NOTIF_ICONS = {
  mention: <AtSign className="h-3.5 w-3.5 text-[#FF642E]" />,
  agent_completed: <Bot className="h-3.5 w-3.5 text-[#00C875]" />,
  agent_failed: <Bot className="h-3.5 w-3.5 text-[#E2445C]" />,
  automation: <Zap className="h-3.5 w-3.5 text-[#FFC700]" />,
  item_updated: <Inbox className="h-3.5 w-3.5 text-muted-foreground" />,
  deadline: <Clock className="h-3.5 w-3.5 text-[#E2445C]" />,
};

export function Header() {
  // OPTIMIZACIÓN: subscribirse solo al board activo (no a todo el array)
  // y solo a primitivos/objetos pequeños.
  const board = useAppStore((s) =>
    s.boards.find((b) => b.id === s.activeBoardId)
  );
  const notifications = useAppStore((s) => s.notifications);
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const selectItem = useAppStore((s) => s.selectItem);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const setShowAgentBuilder = useAppStore((s) => s.setShowAgentBuilder);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setShowExportImport = useAppStore((s) => s.setShowExportImport);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const theme = useAppStore((s) => s.settings.theme);
  const hasApiKey = useAppStore((s) => !!(s.settings.groqApiKey || s.settings.openaiApiKey || s.settings.anthropicApiKey));
  // Solo el nombre del workspace activo (primitivo, estable)
  const wsName = useAppStore((s) => {
    const b = s.boards.find((x) => x.id === s.activeBoardId);
    if (!b) return undefined;
    return s.workspaces.find((w) => w.id === b.workspaceId)?.name;
  });
  // Lista de boards solo con id+name para el dropdown (estable).
  // Patrón correcto: subscribirse al array original (referencia estable) y
  // derivar con useMemo. NO usar selectores con .map()/.filter() directamente
  // en useAppStore — causan infinite loop con useSyncExternalStore.
  const rawBoards = useAppStore((s) => s.boards);
  const boardList = useMemo(
    () => rawBoards.map((b) => ({ id: b.id, name: b.name, workspaceId: b.workspaceId })),
    [rawBoards]
  );
  const workspaces = useAppStore((s) => s.workspaces);

  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <header className="h-11 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
      {/* Breadcrumb — más limpio */}
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        <span className="text-muted-foreground truncate max-w-[160px]">{wsName}</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{board?.name}</span>
      </div>

      {/* Center: search */}
      <div className="hidden md:flex flex-1 justify-center">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full max-w-md flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/60 hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Buscar en todo el workspace…</span>
          <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right actions — jerarquía clara: secundarias primero, primaria al final */}
      <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 ml-auto">
        {/* Importar Excel — botón independiente */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex items-center gap-1.5 text-[#00C875] hover:bg-[#00C875]/10 h-8 font-medium"
              onClick={() => {
                // Crear input file temporal y disparar
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".xlsx,.xls";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  // Subir al endpoint
                  const formData = new FormData();
                  formData.append("file", file);
                  try {
                    const res = await fetch("/api/excel/import", {
                      method: "POST",
                      body: formData,
                    });
                    const data = await res.json();
                    if (data.ok && data.board) {
                      useAppStore.getState().mergeImportedData({ boards: [data.board] });
                      const imported = useAppStore.getState().boards.find((b) => b.id === data.board.id);
                      if (imported) {
                        useAppStore.getState().setActiveBoard(imported.id);
                        useAppStore.getState().setSidebarView("boards");
                      }
                      toast.success("Excel importado", {
                        description: `${data.summary.items} tareas en ${data.summary.groups} grupos`,
                      });
                    } else {
                      toast.error("Error al importar", { description: data.error });
                    }
                  } catch (err: any) {
                    toast.error("Error", { description: err?.message });
                  }
                };
                input.click();
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Importar Excel</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Importar tablero desde un Excel de Monday.com</TooltipContent>
        </Tooltip>

        {/* Importar/Exportar JSON */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hidden lg:flex items-center gap-1.5 text-muted-foreground hover:text-foreground h-8"
              onClick={() => setShowExportImport(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Importar / Exportar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Importar datos de Monday o Excel</TooltipContent>
        </Tooltip>

        {/* Acción secundaria: crear agente */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex items-center gap-1.5 h-8 border-[#0072E5]/30 text-[#0072E5] hover:bg-[#0072E5]/5 hover:border-[#0072E5]/50"
              onClick={() => setShowAgentBuilder(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Crear Agente IA
            </Button>
          </TooltipTrigger>
          <TooltipContent>Crear un nuevo agente IA con plantillas</TooltipContent>
        </Tooltip>

        {/* Inbox dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 relative hover:bg-secondary"
                >
                  <Inbox className="h-4 w-4" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full bg-[#E2445C] text-white flex items-center justify-center ring-2 ring-card">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bandeja de entrada · {unread} sin leer</TooltipContent>
            </Tooltip>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="px-3 py-2 flex items-center justify-between border-b border-border">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Inbox · {unread} sin leer
              </span>
              {unread > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="text-[10px] text-[#0072E5] hover:underline flex items-center gap-1 font-medium"
                >
                  <Check className="h-3 w-3" />
                  Marcar todo
                </button>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {notifications.length === 0 && (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  <Inbox className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  Sin notificaciones
                </div>
              )}
              {notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markNotificationRead(n.id);
                    if (n.itemId) {
                      // Buscar el board que contiene el item sin subscribirse a todo el array
                      const allBoards = useAppStore.getState().boards;
                      for (const b of allBoards) {
                        if (b.items.some((i) => i.id === n.itemId)) {
                          setActiveBoard(b.id);
                          selectItem(n.itemId);
                          break;
                        }
                      }
                    }
                  }}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-secondary/50 text-left border-b border-border last:border-b-0 transition",
                    !n.read && "bg-[#0072E5]/[0.04]"
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    {NOTIF_ICONS[n.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-xs truncate", !n.read && "font-semibold")}>
                      {n.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                      {n.body}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                    </div>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-[#0072E5] shrink-0 mt-1.5" />
                  )}
                </button>
              ))}
            </div>
            <DropdownMenuSeparator className="my-0" />
            <DropdownMenuItem className="text-xs text-[#0072E5] justify-center font-medium cursor-pointer">
              Ver todas las notificaciones
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bell — notificaciones recientes */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-secondary">
                  <Bell className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notificaciones recientes</TooltipContent>
            </Tooltip>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Actividad reciente
              </span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="px-3 py-2 border-b border-border last:border-b-0 hover:bg-secondary/40">
                  <div className="text-xs font-medium truncate">{n.title}</div>
                  <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  Sin actividad reciente
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-secondary"
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                updateSettings({ theme: next });
              }}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-secondary relative"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4" />
              {hasApiKey && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#0072E5] ring-2 ring-card" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Configuración{hasApiKey ? " · API keys activas" : ""}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-secondary"
              onClick={() => window.open("https://support.monday.com", "_blank")}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ayuda y documentación</TooltipContent>
        </Tooltip>
      </div>
      </TooltipProvider>
    </header>
  );
}

"use client";
// ============================================================================
// SidebarViews — vistas alternativas (Home, MyWork, Dashboards, Docs, Team) para sidebar nav
// ============================================================================
import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Item, Board } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bot,
  Zap,
  Sparkles,
  Activity,
  Users,
  Mail,
  Phone,
  Crown,
  Shield,
  Eye,
  User as UserIcon,
  FileText,
  BarChart3,
  Plus,
  ArrowRight,
  Boxes,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  member: <UserIcon className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
  guest: <UserIcon className="h-3 w-3" />,
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
  guest: "Guest",
};

export function HomeView() {
  const users = useAppStore((s) => s.users);
  const boards = useAppStore((s) => s.boards);
  const agents = useAppStore((s) => s.agents);
  const executions = useAppStore((s) => s.executions);
  const notifications = useAppStore((s) => s.notifications);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const selectItem = useAppStore((s) => s.selectItem);
  const currentUser = useAppStore((s) => s.currentUserId);
  const me = users.find((u) => u.id === currentUser);
  const setShowAgentBuilder = useAppStore((s) => s.setShowAgentBuilder);

  const myRecent = executions.slice(0, 5);
  const myItems = boards
    .flatMap((b) =>
      b.items.map((i) => ({ item: i, board: b }))
    )
    .filter(({ item, board }) => {
      const peopleCol = board.columns.find((c) => c.type === "people");
      const cv = item.columnValues.find((v) => v.columnId === peopleCol?.id);
      return cv?.value?.userIds?.includes(currentUser);
    })
    .slice(0, 6);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-background">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold">Hola, {me?.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tienes {notifications.filter((n) => !n.read).length} notificaciones sin leer ·{" "}
            {myItems.length} tareas asignadas · {myRecent.length} ejecuciones recientes de IA
          </p>
        </div>

        {/* Quick actions — CTAs claros */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            className="bg-[#0072E5] hover:bg-[#0058B5] text-white text-xs h-8"
            onClick={() => useAppStore.getState().setShowAgentBuilder(true)}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Crear Agente IA
          </Button>
          <Button
            variant="outline"
            className="text-xs h-8"
            onClick={() => useAppStore.getState().setShowSidekick(true)}
          >
            <Bot className="h-3.5 w-3.5 mr-1.5" />
            Abrir Sidekick
          </Button>
          <Button
            variant="outline"
            className="text-xs h-8"
            onClick={() => useAppStore.getState().setShowMondayConnect(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Conectar Monday.com
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Bot className="h-4 w-4" />}
            label="Agentes activos"
            value={agents.filter((a) => a.isActive).length}
            color="#0072E5"
          />
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Ejecuciones"
            value={executions.length}
            color="#00C875"
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Boards"
            value={boards.length}
            color="#A25BFF"
          />
          <StatCard
            icon={<Zap className="h-4 w-4" />}
            label="Tokens usados"
            value={executions.reduce((a, e) => a + (e.tokensUsed ?? 0), 0).toLocaleString()}
            color="#FFC700"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* My items */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Mis items asignados</h3>
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                Ver todos
              </Button>
            </div>
            <div className="space-y-2">
              {myItems.length === 0 && (
                <div className="text-xs text-muted-foreground italic py-4 text-center">
                  No tienes items asignados
                </div>
              )}
              {myItems.map(({ item: it, board }) => {
                return (
                  <button
                    key={it.id}
                    onClick={() => {
                      setActiveBoard(it.boardId);
                      selectItem(it.id);
                    }}
                    className="w-full text-left p-2 rounded-md hover:bg-secondary/60 transition flex items-center gap-2"
                  >
                    <span
                      className="w-1 h-8 rounded shrink-0"
                      style={{ background: board?.groups.find((g) => g.id === it.groupId)?.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{it.name}</div>
                      <div className="text-[10px] text-muted-foreground">{board?.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Recent agent executions */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Ejecuciones recientes de IA</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-[#0072E5]"
                onClick={() => setShowAgentBuilder(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Nuevo
              </Button>
            </div>
            <div className="space-y-2">
              {myRecent.length === 0 && (
                <div className="text-xs text-muted-foreground italic py-4 text-center">
                  Sin ejecuciones
                </div>
              )}
              {myRecent.map((ex) => {
                const agent = agents.find((a) => a.id === ex.agentId);
                return (
                  <div key={ex.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/60">
                    <span className="text-base">{agent?.icon ?? "🤖"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{agent?.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(ex.startedAt), { addSuffix: true, locale: es })}
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "text-[9px] h-5",
                        ex.status === "completed"
                          ? "bg-[#00C875] hover:bg-[#00C875] text-white"
                          : ex.status === "failed"
                          ? "bg-[#E2445C] hover:bg-[#E2445C] text-white"
                          : "bg-[#0072E5] hover:bg-[#0072E5] text-white"
                      )}
                    >
                      {ex.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Boards grid */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Tus boards</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {boards.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBoard(b.id)}
                className="text-left p-4 rounded-lg border border-border hover:border-[#0072E5]/40 hover:shadow-sm transition bg-card"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#0072E5] to-[#0058B5] flex items-center justify-center text-white">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-semibold truncate">{b.name}</div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {b.items.length} items · {b.groups.length} grupos
                </div>
              </button>
            ))}
            <button
              onClick={() => useAppStore.getState().setShowAddBoard(true)}
              className="p-4 rounded-lg border-2 border-dashed border-border hover:border-[#0072E5]/40 hover:bg-[#0072E5]/5 transition flex flex-col items-center justify-center text-muted-foreground hover:text-[#0072E5] text-xs"
            >
              <Plus className="h-5 w-5 mb-1" />
              Nuevo board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card className="p-4 card-hover">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm"
          style={{ background: color }}
        >
          {icon}
        </div>
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </Card>
  );
}

// ============================================================================
// MyWorkView — vista de "Mi Trabajo": items asignados a través de todos los boards
// ============================================================================
export function MyWorkView() {
  const users = useAppStore((s) => s.users);
  const boards = useAppStore((s) => s.boards);
  const agents = useAppStore((s) => s.agents);
  const executions = useAppStore((s) => s.executions);
  const currentUser = useAppStore((s) => s.currentUserId);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const selectItem = useAppStore((s) => s.selectItem);
  const setSidebarView = useAppStore((s) => s.setSidebarView);

  const me = users.find((u) => u.id === currentUser);

  // Todos los items asignados al usuario actual
  const assignedItems = useMemo(() => {
    const result: { item: Item; board: Board }[] = [];
    for (const board of boards) {
      const peopleCol = board.columns.find((c) => c.type === "people");
      if (!peopleCol) continue;
      for (const item of board.items.filter((i) => !i.archived)) {
        const cv = item.columnValues.find((v) => v.columnId === peopleCol?.id);
        if (cv?.value?.userIds?.includes(currentUser)) {
          result.push({ item, board });
        }
      }
    }
    return result.sort(
      (a, b) => new Date(b.item.updatedAt).getTime() - new Date(a.item.updatedAt).getTime()
    );
  }, [boards, currentUser]);

  // Items vencidos
  const overdue = assignedItems.filter(({ item, board }) => {
    const dateCol = board.columns.find((c) => c.type === "date");
    const cv = item.columnValues.find((v) => v.columnId === dateCol?.id);
    if (!cv?.value?.date) return false;
    return new Date(cv.value.date) < new Date();
  });

  // Items con deadline próximo (7 días)
  const dueSoon = assignedItems.filter(({ item, board }) => {
    const dateCol = board.columns.find((c) => c.type === "date");
    const cv = item.columnValues.find((v) => v.columnId === dateCol?.id);
    if (!cv?.value?.date) return false;
    const d = new Date(cv.value.date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    return diff > 0 && diff < 7 * 86400000;
  });

  const navigateToItem = (boardId: string, itemId: string) => {
    setActiveBoard(boardId);
    selectItem(itemId);
    setSidebarView("boards");
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-background">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Mi Trabajo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {assignedItems.length} items asignados{me ? ` · ${me.name.split(" ")[0]}` : ""}
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Asignados"
            value={assignedItems.length}
            color="#0072E5"
          />
          <StatCard
            icon={<Zap className="h-4 w-4" />}
            label="Por vencer"
            value={dueSoon.length}
            color="#FFC700"
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="Vencidos"
            value={overdue.length}
            color="#E2445C"
          />
        </div>

        {/* Overdue */}
        {overdue.length > 0 && (
          <Card className="p-4 border-[#E2445C]/30">
            <h3 className="text-sm font-semibold text-[#E2445C] flex items-center gap-1.5 mb-3">
              <AlertCircle className="h-4 w-4" />
              Vencidos
            </h3>
            <div className="space-y-2">
              {overdue.slice(0, 5).map(({ item, board }) => (
                <button
                  key={item.id}
                  onClick={() => navigateToItem(item.boardId, item.id)}
                  className="w-full text-left p-2 rounded-md hover:bg-[#E2445C]/5 transition flex items-center gap-2"
                >
                  <span className="w-0.5 h-8 rounded bg-[#E2445C] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">{board.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Due soon */}
        {dueSoon.length > 0 && (
          <Card className="p-4 border-[#FFC700]/30">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <Zap className="h-4 w-4 text-[#FFC700]" />
              Próximos a vencer
            </h3>
            <div className="space-y-2">
              {dueSoon.slice(0, 5).map(({ item, board }) => {
                const dateCol = board.columns.find((c) => c.type === "date");
                const cv = item.columnValues.find((v) => v.columnId === dateCol?.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateToItem(item.boardId, item.id)}
                    className="w-full text-left p-2 rounded-md hover:bg-[#FFC700]/5 transition flex items-center gap-2"
                  >
                    <span className="w-0.5 h-8 rounded bg-[#FFC700] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground">{board.name}</div>
                    </div>
                    {cv?.value?.date && (
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(cv.value.date), "dd MMM")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* All assigned items */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Todos mis items</h3>
          {assignedItems.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-8 text-center">
              No tienes items asignados
            </div>
          ) : (
            <div className="space-y-1">
              {assignedItems.map(({ item, board }) => {
                const statusCol = board.columns.find((c) => c.type === "status");
                const statusCv = item.columnValues.find((v) => v.columnId === statusCol?.id);
                const statusLabel = statusCol?.labels?.[statusCv?.value?.labelId];
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateToItem(item.boardId, item.id)}
                    className="w-full text-left p-2 rounded-md hover:bg-secondary/60 transition flex items-center gap-3"
                  >
                    <span
                      className="w-0.5 h-8 rounded shrink-0"
                      style={{ background: statusLabel?.color ?? board.groups.find((g) => g.id === item.groupId)?.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground">{board.name}</div>
                    </div>
                    {statusLabel && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium shrink-0"
                        style={{ background: statusLabel.color }}
                      >
                        {statusLabel.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// TeamView
// ============================================================================
export function TeamView() {
  const users = useAppStore((s) => s.users);
  const teams = useAppStore((s) => s.teams);
  const boards = useAppStore((s) => s.boards);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-background">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Equipo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {users.length} miembros · {teams.length} equipos
            </p>
          </div>
          <Button className="bg-[#0072E5] hover:bg-[#0058B5]">
            <Plus className="h-4 w-4 mr-1" />
            Invitar miembro
          </Button>
        </div>

        {/* Members */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="text-sm font-semibold">Miembros</h3>
          </div>
          <div className="divide-y divide-border">
            {users.map((u) => {
              const assignedItems = boards
                .flatMap((b) =>
                  b.items.map((i) => ({
                    item: i,
                    peopleCol: b.columns.find((c) => c.type === "people"),
                  }))
                )
                .filter(({ item, peopleCol }) => {
                  const cv = item.columnValues.find((v) => v.columnId === peopleCol?.id);
                  return cv?.value?.userIds?.includes(u.id);
                }).length;
              return (
                <div key={u.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/30">
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className="text-white font-semibold"
                        style={{ background: u.color }}
                      >
                        {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    {u.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#00C875] rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {u.name}
                      {u.online && (
                        <span className="text-[10px] text-[#00C875] font-medium">En línea</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Mail className="h-2.5 w-2.5" />
                      {u.email}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">{assignedItems} items</div>
                    <div className="text-[10px] text-muted-foreground">asignados</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1 capitalize">
                    {ROLE_ICONS[u.role]}
                    {ROLE_LABELS[u.role]}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Teams */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Equipos</h3>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Nuevo equipo
            </Button>
          </div>
          <div className="divide-y divide-border">
            {teams.map((t) => {
              const members = users.filter((u) => t.memberIds.includes(u.id));
              return (
                <div key={t.id} className="px-4 py-3 hover:bg-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {members.length} miembros
                    </Badge>
                  </div>
                  <div className="flex -space-x-2">
                    {members.map((m) => (
                      <Avatar key={m.id} className="h-7 w-7 border-2 border-card">
                        <AvatarFallback
                          className="text-white text-[10px] font-semibold"
                          style={{ background: m.color }}
                        >
                          {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// DocsView (placeholder con notas)
// ============================================================================
export function DocsView() {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-background">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Docs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Documentación colaborativa con rich text
            </p>
          </div>
          <Button className="bg-[#0072E5] hover:bg-[#0058B5]">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo doc
          </Button>
        </div>

        <Card className="p-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <div className="text-sm font-medium mb-1">Sin documentos</div>
          <div className="text-xs">Crea tu primer doc con click en «Nuevo doc»</div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// DashboardsView configurable con widgets draggeables
// ============================================================================

type DashboardWidgetType =
  | "stat_boards"
  | "stat_items"
  | "stat_executions"
  | "stat_members"
  | "chart_status"
  | "chart_items_per_board"
  | "chart_agent_usage"
  | "board_summary"
  | "recent_activity"
  | "overdue_items";

interface WidgetDef {
  id: DashboardWidgetType;
  title: string;
  icon: React.ReactNode;
  defaultEnabled: boolean;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: "stat_boards", title: "Total Boards", icon: <Boxes className="h-3.5 w-3.5" />, defaultEnabled: true },
  { id: "stat_items", title: "Items totales", icon: <FileSpreadsheet className="h-3.5 w-3.5" />, defaultEnabled: true },
  { id: "stat_executions", title: "Ejecuciones IA", icon: <Bot className="h-3.5 w-3.5" />, defaultEnabled: true },
  { id: "stat_members", title: "Miembros", icon: <Users className="h-3.5 w-3.5" />, defaultEnabled: true },
  { id: "chart_status", title: "Distribución por estado", icon: <Boxes className="h-3.5 w-3.5" />, defaultEnabled: true },
  { id: "chart_items_per_board", title: "Items por board", icon: <BarChart3 className="h-3.5 w-3.5" />, defaultEnabled: true },
  { id: "chart_agent_usage", title: "Uso de agentes IA", icon: <Bot className="h-3.5 w-3.5" />, defaultEnabled: true },
  { id: "board_summary", title: "Resumen de boards", icon: <FileSpreadsheet className="h-3.5 w-3.5" />, defaultEnabled: true },
  { id: "recent_activity", title: "Actividad reciente", icon: <Activity className="h-3.5 w-3.5" />, defaultEnabled: false },
  { id: "overdue_items", title: "Items vencidos", icon: <AlertCircle className="h-3.5 w-3.5" />, defaultEnabled: false },
];

export function DashboardsView() {
  const boards = useAppStore((s) => s.boards);
  const agents = useAppStore((s) => s.agents);
  const executions = useAppStore((s) => s.executions);
  const users = useAppStore((s) => s.users);
  const activities = useAppStore((s) => s.activities);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const selectItem = useAppStore((s) => s.selectItem);
  const setSidebarView = useAppStore((s) => s.setSidebarView);

  // Widget state: enabled widgets in order
  const [enabledWidgets, setEnabledWidgets] = useState<DashboardWidgetType[]>(
    ALL_WIDGETS.filter((w) => w.defaultEnabled).map((w) => w.id)
  );
  const [showConfig, setShowConfig] = useState(false);

  const toggleWidget = (widgetId: DashboardWidgetType) => {
    setEnabledWidgets((prev) =>
      prev.includes(widgetId)
        ? prev.filter((id) => id !== widgetId)
        : [...prev, widgetId]
    );
  };

  const moveWidget = (widgetId: DashboardWidgetType, direction: -1 | 1) => {
    setEnabledWidgets((prev) => {
      const idx = prev.indexOf(widgetId);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  // Compute data for widgets
  const statusCounts: Record<string, { count: number; color: string }> = {};
  boards.forEach((b) => {
    const statusCol = b.columns.find((c) => c.type === "status");
    if (!statusCol) return;
    b.items.forEach((i) => {
      const cv = i.columnValues.find((v) => v.columnId === statusCol.id);
      const labelId = cv?.value?.labelId;
      const label = statusCol.labels?.[labelId]?.name ?? "Sin estado";
      const color = statusCol.labels?.[labelId]?.color ?? "#C4C4C4";
      if (!statusCounts[label]) statusCounts[label] = { count: 0, color };
      statusCounts[label].count++;
    });
  });

  const itemsPerBoard = boards.map((b) => ({
    name: b.name.length > 15 ? b.name.slice(0, 15) + "…" : b.name,
    items: b.items.length,
    color: "#0072E5",
  }));

  const agentUsage = agents
    .map((a) => ({
      name: a.name,
      value: executions.filter((e) => e.agentId === a.id).length,
      color: a.color ?? "#0072E5",
    }))
    .filter((a) => a.value > 0);

  // Overdue items
  const overdueItems = boards.flatMap((b) =>
    b.items
      .filter((i) => {
        const dateCol = b.columns.find((c) => c.type === "date");
        if (!dateCol) return false;
        const cv = i.columnValues.find((v) => v.columnId === dateCol.id);
        if (!cv?.value?.date) return false;
        return new Date(cv.value.date) < new Date();
      })
      .map((i) => ({ item: i, board: b }))
  ).slice(0, 5);

  const renderWidget = (widgetId: DashboardWidgetType) => {
    const widgetMeta = ALL_WIDGETS.find((w) => w.id === widgetId);

    switch (widgetId) {
      case "stat_boards":
        return <StatCard icon={<Boxes className="h-4 w-4" />} label="Boards" value={boards.length} color="#0072E5" />;
      case "stat_items":
        return <StatCard icon={<FileSpreadsheet className="h-4 w-4" />} label="Items totales" value={boards.reduce((a, b) => a + b.items.length, 0)} color="#00C875" />;
      case "stat_executions":
        return <StatCard icon={<Bot className="h-4 w-4" />} label="Ejecuciones IA" value={executions.length} color="#A25BFF" />;
      case "stat_members":
        return <StatCard icon={<Users className="h-4 w-4" />} label="Miembros" value={users.length} color="#FF642E" />;

      case "chart_status":
        return (
          <Card className="p-4 relative group">
            <h3 className="text-sm font-semibold mb-3">Distribución por estado</h3>
            {Object.keys(statusCounts).length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={Object.entries(statusCounts).map(([name, v]) => ({ name, value: v.count, fill: v.color }))}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}
                    label={(entry: any) => `${entry.name}: ${entry.value}`} labelLine={false}
                  >
                    {Object.entries(statusCounts).map(([name, v]) => (<Cell key={name} fill={v.color} />))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-muted-foreground italic py-8 text-center">Sin datos de estado</div>
            )}
          </Card>
        );

      case "chart_items_per_board":
        return (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Items por board</h3>
            {itemsPerBoard.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={itemsPerBoard}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Bar dataKey="items" fill="#0072E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-muted-foreground italic py-8 text-center">Sin boards</div>
            )}
          </Card>
        );

      case "chart_agent_usage":
        return (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Uso de agentes IA</h3>
            {agentUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={agentUsage} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={40}
                    label={(entry: any) => `${entry.name}: ${entry.value}`} labelLine={false}
                  >
                    {agentUsage.map((a, i) => (<Cell key={i} fill={a.color} />))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-muted-foreground italic py-8 text-center">Sin ejecuciones todavía</div>
            )}
          </Card>
        );

      case "board_summary":
        return (
          <>
            {boards.map((b) => (
              <Card key={b.id} className="p-4 cursor-pointer hover:shadow-md transition" onClick={() => { setActiveBoard(b.id); setSidebarView("boards"); }}>
                <h3 className="text-sm font-semibold mb-2 truncate">{b.name}</h3>
                <div className="text-2xl font-bold">{b.items.length}</div>
                <div className="text-[10px] text-muted-foreground">items totales</div>
                <div className="mt-2 flex gap-1 flex-wrap">
                  {b.groups.map((g) => (
                    <span key={g.id} className="text-[9px] px-1.5 py-0.5 rounded text-white font-medium" style={{ background: g.color }}>
                      {b.items.filter((i) => i.groupId === g.id).length} {g.title}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </>
        );

      case "recent_activity":
        return (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Actividad reciente</h3>
            <div className="space-y-2">
              {activities.slice(0, 10).map((act) => {
                const user = users.find((u) => u.id === act.userId);
                const actionLabel = act.type === "update_posted" ? "publicó update" :
                  act.type === "column_changed" ? "cambió columna" :
                  act.type === "item_created" ? "creó item" :
                  act.type === "agent_completed" ? "agente completó" : "actividad";
                return (
                  <div key={act.id} className="text-xs flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0072E5] mt-1.5 shrink-0" />
                    <div>
                      <span className="font-medium">{user?.name ?? "Sistema"}</span>
                      <span className="text-muted-foreground"> {actionLabel}</span>
                      <span className="text-muted-foreground/60 ml-1">{formatDistanceToNow(new Date(act.createdAt), { addSuffix: true, locale: es })}</span>
                    </div>
                  </div>
                );
              })}
              {activities.length === 0 && <div className="text-xs text-muted-foreground italic">Sin actividad</div>}
            </div>
          </Card>
        );

      case "overdue_items":
        return (
          <Card className="p-4 border-[#E2445C]/30">
            <h3 className="text-sm font-semibold text-[#E2445C] mb-3 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Items vencidos
            </h3>
            {overdueItems.length > 0 ? (
              <div className="space-y-2">
                {overdueItems.map(({ item, board }) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs">
                    <span className="w-0.5 h-6 rounded bg-[#E2445C] shrink-0" />
                    <span className="truncate flex-1">{item.name}</span>
                    <span className="text-muted-foreground">{board.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic">Sin items vencidos ✅</div>
            )}
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-background">
      <div className="max-w-5xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboards</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Widgets configurables · {enabledWidgets.length} activos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowConfig(!showConfig)}
            >
              {showConfig ? "Listo" : "Configurar widgets"}
            </Button>
          </div>
        </div>

        {/* Widget configuration panel */}
        {showConfig && (
          <Card className="p-4 border-[#0072E5]/40 bg-[#0072E5]/5">
            <h3 className="text-sm font-semibold mb-3">Widgets disponibles</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {ALL_WIDGETS.map((w) => {
                const isEnabled = enabledWidgets.includes(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleWidget(w.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition ${
                      isEnabled
                        ? "bg-[#0072E5] text-white border-[#0072E5]"
                        : "bg-card text-muted-foreground border-border hover:border-[#0072E5]/40"
                    }`}
                  >
                    {w.icon}
                    <span className={isEnabled ? "text-white" : ""}>{w.title}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Render widgets en orden */}
        <div className="space-y-4">
          {/* Stats row — first 4 stat widgets */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {enabledWidgets.filter((id) => id.startsWith("stat_")).map((id) => (
              <div key={id} className="relative group">
                {renderWidget(id)}
              </div>
            ))}
          </div>

          {/* Chart widgets — 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enabledWidgets.filter((id) => id.startsWith("chart_")).map((id) => (
              <div key={id} className="relative group">
                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => moveWidget(id, -1)}
                    className="w-6 h-6 bg-background border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title="Mover izquierda"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => moveWidget(id, 1)}
                    className="w-6 h-6 bg-background border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title="Mover derecha"
                  >
                    →
                  </button>
                  <button
                    onClick={() => toggleWidget(id)}
                    className="w-6 h-6 bg-background border border-border rounded flex items-center justify-center text-[#E2445C] hover:bg-[#E2445C]/10"
                    title="Remover widget"
                  >
                    ✕
                  </button>
                </div>
                {renderWidget(id)}
              </div>
            ))}
          </div>

          {/* Other widgets — full width */}
          {enabledWidgets.filter((id) => !id.startsWith("stat_") && !id.startsWith("chart_")).map((id) => (
            <div key={id} className="relative group">
              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => moveWidget(id, -1)}
                  className="w-6 h-6 bg-background border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                  title="Mover arriba"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveWidget(id, 1)}
                  className="w-6 h-6 bg-background border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                  title="Mover abajo"
                >
                  ↓
                </button>
                <button
                  onClick={() => toggleWidget(id)}
                  className="w-6 h-6 bg-background border border-border rounded flex items-center justify-center text-[#E2445C] hover:bg-[#E2445C]/10"
                  title="Remover widget"
                >
                  ✕
                </button>
              </div>
              {renderWidget(id)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

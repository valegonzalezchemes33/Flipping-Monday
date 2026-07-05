"use client";
// ============================================================================
// SidebarViews — vistas alternativas (Home, Dashboards, Docs, Team) para sidebar nav
// ============================================================================
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
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
                  <Avatar className="h-10 w-10">
                    <AvatarFallback
                      className="text-white font-semibold"
                      style={{ background: u.color }}
                    >
                      {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{u.name}</div>
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
// DashboardsView
// ============================================================================
export function DashboardsView() {
  const boards = useAppStore((s) => s.boards);
  const agents = useAppStore((s) => s.agents);
  const executions = useAppStore((s) => s.executions);
  const users = useAppStore((s) => s.users);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);

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

  // Items per board (para bar chart)
  const itemsPerBoard = boards.map((b) => ({
    name: b.name.length > 15 ? b.name.slice(0, 15) + "…" : b.name,
    items: b.items.length,
    color: "#0072E5",
  }));

  // Agent usage (para pie chart)
  const agentUsage = agents
    .map((a) => ({
      name: a.name,
      value: executions.filter((e) => e.agentId === a.id).length,
      color: a.color ?? "#0072E5",
    }))
    .filter((a) => a.value > 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-background">
      <div className="max-w-5xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboards</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Métricas cross-board en tiempo real
            </p>
          </div>
          <Button className="bg-[#0072E5] hover:bg-[#0058B5]">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo dashboard
          </Button>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Boxes className="h-4 w-4" />}
            label="Boards"
            value={boards.length}
            color="#0072E5"
          />
          <StatCard
            icon={<FileSpreadsheet className="h-4 w-4" />}
            label="Items totales"
            value={boards.reduce((a, b) => a + b.items.length, 0)}
            color="#00C875"
          />
          <StatCard
            icon={<Bot className="h-4 w-4" />}
            label="Ejecuciones IA"
            value={executions.length}
            color="#A25BFF"
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Miembros"
            value={users.length}
            color="#FF642E"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status distribution — pie chart */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Distribución por estado</h3>
            {Object.keys(statusCounts).length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={Object.entries(statusCounts).map(([name, v]) => ({
                      name,
                      value: v.count,
                      fill: v.color,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={40}
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                    labelLine={false}
                  >
                    {Object.entries(statusCounts).map(([name, v]) => (
                      <Cell key={name} fill={v.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-muted-foreground italic py-8 text-center">
                Sin datos de estado
              </div>
            )}
          </Card>

          {/* Items per board — bar chart */}
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
              <div className="text-xs text-muted-foreground italic py-8 text-center">
                Sin boards
              </div>
            )}
          </Card>

          {/* Agent usage — donut */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Uso de agentes IA</h3>
            {agentUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={agentUsage}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={40}
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                    labelLine={false}
                  >
                    {agentUsage.map((a, i) => (
                      <Cell key={i} fill={a.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-muted-foreground italic py-8 text-center">
                Sin ejecuciones todavía
              </div>
            )}
          </Card>

          {/* Boards summary */}
          {boards.map((b) => (
            <Card
              key={b.id}
              className="p-4 cursor-pointer hover:shadow-md transition"
              onClick={() => setActiveBoard(b.id)}
            >
              <h3 className="text-sm font-semibold mb-2 truncate">{b.name}</h3>
              <div className="text-2xl font-bold">{b.items.length}</div>
              <div className="text-[10px] text-muted-foreground">items totales</div>
              <div className="mt-2 flex gap-1 flex-wrap">
                {b.groups.map((g) => (
                  <span
                    key={g.id}
                    className="text-[9px] px-1.5 py-0.5 rounded text-white font-medium"
                    style={{ background: g.color }}
                  >
                    {b.items.filter((i) => i.groupId === g.id).length} {g.title}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

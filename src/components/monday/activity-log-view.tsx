"use client";
// ============================================================================
// ActivityLogView — timeline global de actividad cross-board (tipo Pulse de Monday)
// ============================================================================
import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  Bot,
  MessageSquare,
  Clock,
  Plus,
  Trash2,
  ArrowRight,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  agent_completed: <Bot className="h-3.5 w-3.5 text-[#00C875]" />,
  agent_failed: <Bot className="h-3.5 w-3.5 text-[#E2445C]" />,
  agent_run: <Bot className="h-3.5 w-3.5 text-[#0072E5]" />,
  update_posted: <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />,
  column_changed: <Activity className="h-3.5 w-3.5 text-[#FFC700]" />,
  item_created: <Plus className="h-3.5 w-3.5 text-[#00C875]" />,
  item_archived: <Trash2 className="h-3.5 w-3.5 text-[#E2445C]" />,
  subitem_created: <Plus className="h-3.5 w-3.5 text-[#A25BFF]" />,
  file_attached: <span className="text-sm">📎</span>,
};

export function ActivityLogView() {
  const activities = useAppStore((s) => s.activities);
  const users = useAppStore((s) => s.users);
  const agents = useAppStore((s) => s.agents);
  const boards = useAppStore((s) => s.boards);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);
  const selectItem = useAppStore((s) => s.selectItem);
  const setSidebarView = useAppStore((s) => s.setSidebarView);

  const sorted = useMemo(
    () =>
      [...activities].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [activities]
  );

  const findItemAndBoard = (itemId: string) => {
    for (const b of boards) {
      const item = b.items.find((i) => i.id === itemId);
      if (item) return { item, board: b };
    }
    return null;
  };

  const getEventLabel = (event: typeof sorted[0]) => {
    switch (event.type) {
      case "agent_completed":
        return `completó ejecución: ${event.data?.score ? `Score ${event.data.score}/100` : ""}`;
      case "agent_failed":
        return "falló en la ejecución";
      case "agent_run":
        return "inició ejecución";
      case "update_posted":
        return `publicó un update: ${(event.data?.body ?? "").slice(0, 60)}`;
      case "column_changed":
        return `cambió una columna`;
      case "item_created":
        return `creó el item: ${event.data?.name ?? ""}`;
      case "item_archived":
        return "archivó el item";
      case "subitem_created":
        return `creó un subitem: ${event.data?.name ?? ""}`;
      default:
        return "realizó una acción";
    }
  };

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 bg-background">
        <div className="max-w-3xl mx-auto w-full">
          <h1 className="text-2xl font-bold mb-2">Actividad</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Timeline global de todas las acciones en el workspace
          </p>
          <Card className="p-12 text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <div className="text-sm font-medium mb-1">Sin actividad registrada</div>
            <div className="text-xs">
              Los cambios en boards, items y agentes aparecerán aquí
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-background">
      <div className="max-w-3xl mx-auto w-full space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Actividad</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sorted.length} eventos · timeline global del workspace
          </p>
        </div>

        <div className="relative">
          {/* Timeline vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-3">
            {sorted.slice(0, 200).map((event) => {
              const user = users.find((u) => u.id === event.userId);
              const agent = agents.find((a) => a.id === event.agentId);
              const found = findItemAndBoard(event.itemId);
              const icon = EVENT_ICONS[event.type] ?? (
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              );

              return (
                <div key={event.id} className="relative pl-12 group">
                  {/* Timeline dot */}
                  <div className="absolute left-3.5 top-1.5 w-3 h-3 rounded-full bg-card border-2 border-border flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  </div>

                  <Card
                    className={cn(
                      "p-3 transition cursor-pointer hover:shadow-sm",
                      event.type === "agent_completed" && "border-[#00C875]/20",
                      event.type === "agent_failed" && "border-[#E2445C]/20"
                    )}
                    onClick={() => {
                      if (found) {
                        setActiveBoard(found.board.id);
                        setSidebarView("boards");
                        selectItem(found.item.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-2 shrink-0 min-w-[100px]">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback
                            className="text-white text-[9px] font-semibold"
                            style={{ background: user?.color ?? "#888" }}
                          >
                            {user?.name
                              ?.split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("") ?? "🤖"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate max-w-[80px]">
                          {user?.name ?? agent?.name ?? "Sistema"}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-relaxed">
                          {getEventLabel(event)}
                        </p>
                        {found && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                background:
                                  found.board.groups.find(
                                    (g) => g.id === found.item.groupId
                                  )?.color ?? "#888",
                              }}
                            />
                            <span className="text-[10px] text-muted-foreground truncate">
                              {found.board.name} · {found.item.name}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          {formatDistanceToNow(new Date(event.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>

                      <span className="text-[10px] text-muted-foreground shrink-0 translate-y-0.5 opacity-0 group-hover:opacity-100 transition">
                        Ver item →
                      </span>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
// ============================================================================
// WorkloadView — heatmap de carga por persona y semana
// ============================================================================
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  format,
  startOfWeek,
  addWeeks,
  parseISO,
  isValid,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

const WEEKS = 6;

export function WorkloadView() {
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const users = useAppStore((s) => s.users);
  const selectItem = useAppStore((s) => s.selectItem);
  const board = boards.find((b) => b.id === activeBoardId);

  const [startWeek, setStartWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const dateColumn = board?.columns.find((c) => c.type === "date");
  const peopleColumn = board?.columns.find((c) => c.type === "people");

  // Calculate weekly workload per user
  const workload = useMemo(() => {
    const map = new Map<string, { week: number; items: string[] }>();
    if (!board || !dateColumn || !peopleColumn) return map;
    board.items.forEach((it) => {
      const dCv = it.columnValues.find((v) => v.columnId === dateColumn.id);
      const pCv = it.columnValues.find((v) => v.columnId === peopleColumn.id);
      const dateStr = dCv?.value?.date;
      const userIds: string[] = pCv?.value?.userIds ?? [];
      if (!dateStr || userIds.length === 0) return;
      const d = parseISO(dateStr);
      if (!isValid(d)) return;
      const weekOffset = Math.floor(differenceInCalendarDays(d, startWeek) / 7);
      if (weekOffset < 0 || weekOffset >= WEEKS) return;
      userIds.forEach((uid) => {
        const key = `${uid}-${weekOffset}`;
        const entry = map.get(key) ?? { week: weekOffset, items: [] };
        entry.items.push(it.id);
        map.set(key, entry);
      });
    });
    return map;
  }, [board, dateColumn, peopleColumn, startWeek]);

  if (!board) return null;
  if (!dateColumn || !peopleColumn) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Necesitas columnas «date» y «people» para mostrar la carga de trabajo.
      </div>
    );
  }

  const weeks = Array.from({ length: WEEKS }, (_, i) => addWeeks(startWeek, i));

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <span className="text-sm font-semibold">Carga de trabajo</span>
        <span className="text-[11px] text-muted-foreground">
          Items asignados por persona y semana (capacidad sugerida: 5/sem)
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[200px_repeat(6,1fr)] border-b border-border bg-secondary/30">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground">
              Persona
            </div>
            {weeks.map((w, i) => (
              <div
                key={i}
                className="px-2 py-2 text-[10px] text-center border-l border-border"
              >
                <div className="font-semibold capitalize">
                  {format(w, "dd MMM", { locale: es })}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  - {format(addWeeks(w, 1), "dd MMM", { locale: es })}
                </div>
              </div>
            ))}
          </div>

          {/* Rows */}
          {users.map((u, idx) => (
            <div
              key={u.id}
              className={cn(
                "grid grid-cols-[200px_repeat(6,1fr)] border-b border-border last:border-b-0",
                idx % 2 === 0 && "bg-secondary/10"
              )}
            >
              <div className="px-3 py-3 flex items-center gap-2">
                <Avatar className="h-7 w-7 text-[10px] font-semibold shrink-0">
                  <AvatarFallback
                    style={{ background: u.color }}
                    className="text-white"
                  >
                    {u.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{u.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>
                </div>
              </div>
              {weeks.map((_, wIdx) => {
                const entry = workload.get(`${u.id}-${wIdx}`);
                const count = entry?.items.length ?? 0;
                const intensity = Math.min(count / 5, 1);
                const color =
                  count === 0
                    ? "transparent"
                    : count <= 2
                    ? `rgba(0, 200, 117, 0.25)`
                    : count <= 5
                    ? `rgba(0, 200, 117, ${0.4 + intensity * 0.4})`
                    : `rgba(226, 68, 92, ${intensity})`;
                return (
                  <div
                    key={wIdx}
                    className="border-l border-border p-1.5 min-h-[60px] flex flex-col justify-center"
                    style={{ background: color }}
                  >
                    <div className="text-center">
                      <div
                        className={cn(
                          "text-lg font-bold",
                          count > 5 ? "text-white" : "text-foreground"
                        )}
                      >
                        {count}
                      </div>
                      <div
                        className={cn(
                          "text-[9px]",
                          count > 5 ? "text-white/90" : "text-muted-foreground"
                        )}
                      >
                        {count > 5 ? "Sobrecargado" : count > 0 ? "items" : "—"}
                      </div>
                    </div>
                    {count > 0 && entry && (
                      <div className="mt-1 space-y-0.5">
                        {entry.items.slice(0, 2).map((itemId) => {
                          const it = board.items.find((x) => x.id === itemId);
                          if (!it) return null;
                          return (
                            <button
                              key={itemId}
                              onClick={() => selectItem(itemId)}
                              className="w-full text-[9px] bg-card/90 hover:bg-card px-1 py-0.5 rounded truncate text-left"
                              title={it.name}
                            >
                              {it.name}
                            </button>
                          );
                        })}
                        {count > 2 && (
                          <div className="text-[9px] text-center opacity-80">
                            +{count - 2}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: "rgba(0, 200, 117, 0.25)" }} />
            ≤2 items
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: "rgba(0, 200, 117, 0.8)" }} />
            3-5 items
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: "rgba(226, 68, 92, 0.8)" }} />
            &gt;5 sobrecargado
          </div>
        </div>
      </div>
    </div>
  );
}

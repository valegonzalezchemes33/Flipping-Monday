"use client";
// ============================================================================
// CalendarView — vista calendario mensual con items posicionados por date
// ============================================================================
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
  isValid,
  addMonths,
  isToday,
} from "date-fns";
import { es } from "date-fns/locale";

export function CalendarView() {
  const boards = useAppStore((s) => s.boards);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const users = useAppStore((s) => s.users);
  const selectItem = useAppStore((s) => s.selectItem);
  const board = boards.find((b) => b.id === activeBoardId);

  const [cursor, setCursor] = useState(new Date());

  const dateColumn = board?.columns.find((c) => c.type === "date");

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    if (!board || !dateColumn) return map;
    board.items.forEach((it) => {
      const cv = it.columnValues.find((v) => v.columnId === dateColumn.id);
      const dateStr = cv?.value?.date;
      if (!dateStr) return;
      const d = parseISO(dateStr);
      if (!isValid(d)) return;
      const key = format(d, "yyyy-MM-dd");
      (map.get(key) ?? map.set(key, []).get(key)!)?.push(it);
    });
    return map;
  }, [board, dateColumn]);

  if (!board) return null;
  if (!dateColumn) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Sin columna de fecha para mostrar el calendario. Añade una columna «date».
      </div>
    );
  }

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setCursor(new Date())}>
          Hoy
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCursor((c) => addMonths(c, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCursor((c) => addMonths(c, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold capitalize">
          {format(cursor, "MMMM yyyy", { locale: es })}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {board.items.filter((i: any) => !i.archived).filter((i) => {
            const cv = i.columnValues.find((v) => v.columnId === dateColumn.id);
            return cv?.value?.date;
          }).length}{" "}
          items con fecha
        </span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-card text-[11px] font-semibold text-muted-foreground uppercase">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-center border-r border-border last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          return (
            <div
              key={i}
              className={cn(
                "border-r border-b border-border p-1.5 overflow-hidden flex flex-col gap-1 min-h-[80px] transition",
                !inMonth && "bg-secondary/20",
                today && "bg-[#0072E5]/5 ring-1 ring-inset ring-[#0072E5]/20"
              )}
            >
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "text-[11px] font-medium flex items-center justify-center",
                    !inMonth ? "text-muted-foreground/40" : "text-foreground",
                    today && "bg-[#0072E5] text-white rounded-full w-5 h-5 font-bold"
                  )}
                >
                  {format(day, "d")}
                </div>
                {dayItems.length > 0 && inMonth && (
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {dayItems.length}
                  </span>
                )}
              </div>
              <div className="space-y-1 overflow-y-auto">
                {dayItems.slice(0, 4).map((it) => {
                  const statusCol = board.columns.find((c) => c.type === "status");
                  const statusCv = it.columnValues.find((v) => v.columnId === statusCol?.id);
                  const statusLabel = statusCol?.labels?.[statusCv?.value?.labelId];
                  const peopleCol = board.columns.find((c) => c.type === "people");
                  const peopleCv = it.columnValues.find((v) => v.columnId === peopleCol?.id);
                  const assignee = users.find((u) => u.id === peopleCv?.value?.userIds?.[0]);
                  return (
                    <button
                      key={it.id}
                      onClick={() => selectItem(it.id)}
                      className="w-full text-left text-[10px] px-1.5 py-1 rounded border-l-2 hover:shadow-sm transition truncate flex items-center gap-1 bg-card hover:bg-secondary/40"
                      style={{
                        borderLeftColor: statusLabel?.color ?? "#C4C4C4",
                      }}
                    >
                      <span className="flex-1 truncate font-medium">{it.name}</span>
                      {assignee && (
                        <Avatar className="h-3.5 w-3.5 text-[7px] font-semibold shrink-0">
                          <AvatarFallback
                            style={{ background: assignee.color }}
                            className="text-white"
                          >
                            {assignee.name
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </button>
                  );
                })}
                {dayItems.length > 4 && (
                  <div className="text-[9px] text-muted-foreground px-1.5">
                    +{dayItems.length - 4} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
